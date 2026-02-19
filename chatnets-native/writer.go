package main

import (
	"encoding/json"
	"fmt"
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
	config      *Config
	fileIndex   map[string]string       // session_id -> file_path
	sessionMeta map[string]*SessionMeta // session_id -> metadata
	mu          sync.RWMutex
}

// NewWriter creates a new writer
func NewWriter(config *Config) *Writer {
	return &Writer{
		config:      config,
		fileIndex:   make(map[string]string),
		sessionMeta: make(map[string]*SessionMeta),
	}
}

// WriteMessage writes a chat message to the appropriate markdown file
func (w *Writer) WriteMessage(data *Data) (string, error) {
	// Get date from timestamp
	date := data.Timestamp.Format("2006-01-02")

	// Create directory: {root}/{platform}/{date}/
	dir := filepath.Join(w.config.SaveDirectory, data.Platform, date)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create directory: %w", err)
	}

	// Get file path
	filePath := w.getOrCreateFilePath(dir, data)

	// Format message as markdown
	markdown := formatMessage(data)

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

// getOrCreateFilePath gets or creates the file path for a session
func (w *Writer) getOrCreateFilePath(dir string, data *Data) string {
	w.mu.RLock()
	existingPath, exists := w.fileIndex[data.SessionID]
	w.mu.RUnlock()

	if exists {
		// Verify file still exists
		if _, err := os.Stat(existingPath); err == nil {
			return existingPath
		}
	}

	// Generate filename from title
	filename := sanitizeFilename(data.Title) + ".md"
	filePath := filepath.Join(dir, filename)

	// Handle duplicates
	counter := 1
	for {
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			break
		}
		base := sanitizeFilename(data.Title)
		filename = fmt.Sprintf("%s_%d.md", base, counter)
		filePath = filepath.Join(dir, filename)
		counter++
	}

	return filePath
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

	// Check if file has existing metadata comment
	contentStr := string(content)
	newMetaComment := w.formatMetaComment(data.SessionID, meta.MessageCount, data.Timestamp)

	// Remove old meta comment if exists
	re := regexp.MustCompile(`\n\n<!-- chatnets-meta:.*?-->`)
	contentStr = re.ReplaceAllString(contentStr, "")

	// Append new message and updated metadata
	newContent := contentStr + fmt.Sprintf("\n---\n\n%s\n\n%s", message, newMetaComment)

	return os.WriteFile(filePath, []byte(newContent), 0644)
}

// messageExists checks if a message with the same role and content already exists
func (w *Writer) messageExists(filePath string, data *Data) bool {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	// Check if the specific message (role + content) already exists
	// Format: "## [HH:MM:SS] Role\n\nContent"
	contentStr := string(content)

	// Escape special regex characters in content
	contentEscaped := regexp.QuoteMeta(data.Content)
	// Use a more specific pattern: role + content (more reliable than just timestamp)
	pattern := fmt.Sprintf(`## \[[\d:]+\] %s\n\n%s`, capitalize(data.Role), contentEscaped)

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
