package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// SessionMeta tracks metadata for a session
type SessionMeta struct {
	SessionID    string    `json:"session_id"`
	MessageCount int       `json:"message_count"`
	LastUpdated  time.Time `json:"last_updated"`
	Title        string    `json:"title,omitempty"`
}

// Writer handles writing chat messages to markdown files
type Writer struct {
	config        *Config
	fileIndex     map[string]string       // session_id -> file_path
	sessionMeta   map[string]*SessionMeta // session_id -> metadata
	stateFilePath string                  // path to state file
	mu            sync.RWMutex
}

// NewWriter creates a new writer
func NewWriter(config *Config) *Writer {
	// Create _meta directory for state storage
	metaDir := filepath.Join(config.SaveDirectory, "meta")
	os.MkdirAll(metaDir, 0755)

	stateFile := filepath.Join(metaDir, "writer-state.json")

	w := &Writer{
		config:        config,
		fileIndex:     make(map[string]string),
		sessionMeta:   make(map[string]*SessionMeta),
		stateFilePath: stateFile,
	}

	// Load existing state
	w.loadState()

	return w
}

// WriteMessage writes a chat message to the appropriate markdown file
func (w *Writer) WriteMessage(data *Data) (string, error) {
	// Create directory: {root}/{platform}/
	dir := filepath.Join(w.config.SaveDirectory, data.Platform)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create directory: %w", err)
	}

	// Get file path
	filePath := w.getOrCreateFilePath(dir, data)

	// Get message index for this session (1-indexed for display)
	messageIndex := w.getNextMessageIndex(data.SessionID)

	// Format message as markdown with anchor
	markdown := formatMessage(data, messageIndex)

	// Check if file exists to determine header or append
	_, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		// New file - write with header
		if err := w.writeNewFile(filePath, data, markdown); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", fmt.Errorf("stat file: %w", err)
	} else {
		// Existing file - append message
		// Check if message already exists (deduplication by role + content)
		if w.messageExists(filePath, data) {
			return filePath, nil // Skip duplicate
		}
		if err := w.appendToFile(filePath, data, markdown); err != nil {
			return "", err
		}
	}

	// Update index
	w.mu.Lock()
	w.fileIndex[data.SessionID] = filePath
	w.mu.Unlock()

	return filePath, nil
}

// getNextMessageIndex returns the next message index for a session (1-indexed)
func (w *Writer) getNextMessageIndex(sessionID string) int {
	w.mu.RLock()
	meta, exists := w.sessionMeta[sessionID]
	w.mu.RUnlock()

	if !exists {
		return 1
	}
	return meta.MessageCount + 1
}

// getOrCreateFilePath gets or creates the file path for a session
func (w *Writer) getOrCreateFilePath(dir string, data *Data) string {
	w.mu.RLock()
	existingPath, exists := w.fileIndex[data.SessionID]
	w.mu.RUnlock()

	if exists {
		// Verify file still exists
		if _, err := os.Stat(existingPath); err == nil {
			// File exists and is mapped to this sessionID
			// Update session title in metadata if it has changed
			w.mu.Lock()
			if meta, ok := w.sessionMeta[data.SessionID]; ok && meta.Title != data.Title {
				log.Printf("[Chatnets] Session title changed for %s: %s -> %s",
					data.SessionID, meta.Title, data.Title)
				meta.Title = data.Title
			}
			w.mu.Unlock()
			return existingPath
		}
		// File was deleted, remove from index
		w.mu.Lock()
		delete(w.fileIndex, data.SessionID)
		w.mu.Unlock()
	}

	// Generate filename from title
	filename := sanitizeFilename(data.Title) + ".md"
	filePath := filepath.Join(dir, filename)

	// Handle duplicates: check if file exists with same name but different sessionID
	counter := 1
	for {
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			// File doesn't exist, we can use this path
			break
		}

		// File exists - check if it belongs to a different session
		existingSessionID := w.getSessionIDFromFile(filePath)
		if existingSessionID == data.SessionID {
			// Same session! This file should be reused
			log.Printf("[Chatnets] Found existing file for sessionID %s: %s", data.SessionID, filePath)
			w.mu.Lock()
			w.fileIndex[data.SessionID] = filePath
			w.mu.Unlock()
			return filePath
		}

		// Different session with same title - add counter suffix
		base := sanitizeFilename(data.Title)
		filename = fmt.Sprintf("%s_%d.md", base, counter)
		filePath = filepath.Join(dir, filename)
		counter++
	}

	return filePath
}

// getSessionIDFromFile extracts sessionID from an existing file
func (w *Writer) getSessionIDFromFile(filePath string) string {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}
	return extractSessionIDFromMeta(string(content))
}

// writeNewFile writes a new file with header and first message
func (w *Writer) writeNewFile(filePath string, data *Data, message string) error {
	// Initialize session metadata
	w.mu.Lock()
	w.sessionMeta[data.SessionID] = &SessionMeta{
		SessionID:    data.SessionID,
		MessageCount: 1,
		LastUpdated:  data.Timestamp,
		Title:        data.Title,
	}
	w.mu.Unlock()

	// Persist state
	w.saveState()

	metaComment := w.formatMetaComment(data.SessionID, 1, data.Timestamp)

	content := fmt.Sprintf(`# %s

Platform: %s
Date: %s
Created: %s

---

%s

%s
`,
		data.Title,
		capitalize(data.Platform),
		data.Timestamp.Format("2006-01-02"),
		data.Timestamp.Format("15:04:05"),
		message,
		metaComment,
	)

	return os.WriteFile(filePath, []byte(content), 0644)
}

// appendToFile appends a message to an existing file
func (w *Writer) appendToFile(filePath string, data *Data, message string) error {
	// Read existing content to find and update metadata
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	// Update session metadata
	w.mu.Lock()
	meta, exists := w.sessionMeta[data.SessionID]
	if !exists {
		meta = &SessionMeta{
			SessionID: data.SessionID,
		}
		w.sessionMeta[data.SessionID] = meta
	}
	meta.MessageCount++
	meta.LastUpdated = data.Timestamp
	w.mu.Unlock()

	// Persist state
	w.saveState()

	// Check if file has existing metadata comment
	contentStr := string(content)
	newMetaComment := w.formatMetaComment(data.SessionID, meta.MessageCount, data.Timestamp)

	// Remove old meta comment if exists
	re := regexp.MustCompile(`\n\n<!-- chatnets-meta:.*?-->`)
	contentStr = re.ReplaceAllString(contentStr, "")

	// Append new message and updated metadata
	newContent := contentStr + fmt.Sprintf("\n\n---\n\n%s\n\n%s", message, newMetaComment)

	return os.WriteFile(filePath, []byte(newContent), 0644)
}

// messageExists checks if a message with the same role and content already exists
func (w *Writer) messageExists(filePath string, data *Data) bool {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	// Check if the specific message (role + content) already exists
	// Format: "## ^message-N [HH:MM:SS] Role\n\nContent"
	contentStr := string(content)

	// Escape special regex characters in content
	contentEscaped := regexp.QuoteMeta(data.Content)
	// Pattern should match the new format and the old format
	// New User: ### [HH:MM:SS] Title... ^message-N
	// New Assistant: **[HH:MM:SS] Role** ^message-N
	// Old: **[HH:MM:SS] Role** ^message-N or ## [HH:MM:SS] Role ^message-N

	// To make this robust, we just look for the anchor ^message-\d+\n\n followed exactly by the content
	// This avoids parsing the complex prefix entirely, since the anchor + exact content is essentially a unique signature
	pattern := fmt.Sprintf(`\^message-[\d]+\n\n%s`, contentEscaped)

	matched, _ := regexp.MatchString(pattern, contentStr)
	return matched
}

// sanitizeFilename removes/replaces characters that are unsafe for filenames
func sanitizeFilename(name string) string {
	// Remove or replace unsafe characters
	unsafe := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, ch := range unsafe {
		result = strings.ReplaceAll(result, ch, "_")
	}

	// Limit length
	if len(result) > 100 {
		result = result[:100]
	}

	// Remove leading/trailing spaces and dots
	result = strings.Trim(result, " .")

	// Handle empty result
	if result == "" {
		result = "untitled"
	}

	return result
}

// capitalize capitalizes the first letter
func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// formatMetaComment formats the metadata as an HTML comment
func (w *Writer) formatMetaComment(sessionID string, messageCount int, timestamp time.Time) string {
	meta := SessionMeta{
		SessionID:    sessionID,
		MessageCount: messageCount,
		LastUpdated:  timestamp,
	}
	metaJSON, _ := json.Marshal(meta)
	return fmt.Sprintf("<!-- chatnets-meta: %s -->", string(metaJSON))
}

// loadState loads session metadata from disk
func (w *Writer) loadState() {
	// First, load from JSON state file (if exists)
	content, err := os.ReadFile(w.stateFilePath)
	if err == nil {
		var state map[string]*SessionMeta
		if json.Unmarshal(content, &state) == nil {
			w.mu.Lock()
			w.sessionMeta = state
			w.mu.Unlock()
			log.Printf("[Chatnets] Loaded state for %d sessions from JSON", len(state))
		}
	}

	// Then, scan existing chat files to rebuild fileIndex
	// This handles the case where chatnets-native was restarted
	w.scanExistingFiles()
}

// scanExistingFiles scans existing chat files and rebuilds the fileIndex
func (w *Writer) scanExistingFiles() {
	// Get platform directories
	saveDir := w.config.SaveDirectory
	platforms := []string{"deepseek", "chatgpt"}

	w.mu.Lock()
	defer w.mu.Unlock()

	for _, platform := range platforms {
		platformDir := filepath.Join(saveDir, platform)
		entries, err := os.ReadDir(platformDir)
		if err != nil {
			continue // Directory doesn't exist yet
		}

		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}

			filePath := filepath.Join(platformDir, entry.Name())

			// Read file to find chatnets-meta comment
			content, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			// Extract session_id from chatnets-meta comment
			sessionID := extractSessionIDFromMeta(string(content))
			if sessionID == "" {
				continue
			}

			// Rebuild fileIndex
			w.fileIndex[sessionID] = filePath

			// Also restore sessionMeta if not already loaded
			if _, exists := w.sessionMeta[sessionID]; !exists {
				meta := extractFullMetaFromMeta(string(content))
				if meta != nil {
					w.sessionMeta[sessionID] = meta
				}
			}
		}
	}

	log.Printf("[Chatnets] Scanned existing files: %d sessions, %d file mappings",
		len(w.sessionMeta), len(w.fileIndex))
}

// extractSessionIDFromMeta extracts session_id from chatnets-meta comment
func extractSessionIDFromMeta(content string) string {
	// Pattern: <!-- chatnets-meta: {"session_id":"xxx",...} -->
	re := regexp.MustCompile(`<!-- chatnets-meta:\s*\{[^}]*"session_id"\s*:\s*"([^"]+)"`)
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// extractFullMetaFromMeta extracts full SessionMeta from chatnets-meta comment
func extractFullMetaFromMeta(content string) *SessionMeta {
	// Pattern: <!-- chatnets-meta: {...} -->
	re := regexp.MustCompile(`<!-- chatnets-meta:\s*(\{.*?\})\s*-->`)
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 {
		var meta SessionMeta
		if err := json.Unmarshal([]byte(matches[1]), &meta); err == nil {
			return &meta
		}
	}
	return nil
}

// saveState saves session metadata to disk
func (w *Writer) saveState() error {
	w.mu.RLock()
	state := w.sessionMeta
	w.mu.RUnlock()

	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(w.stateFilePath, content, 0644)
}
