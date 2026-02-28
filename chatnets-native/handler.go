package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Handler handles HTTP requests from the Chrome extension
type Handler struct {
	config *Config
	writer *Writer
}

// NewHandler creates a new handler
func NewHandler(config *Config) *Handler {
	return &Handler{
		config: config,
		writer: NewWriter(config),
	}
}

// handleWrite processes a write_message request via HTTP
func (h *Handler) handleWrite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req Data
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request: %v", err)
		respondError(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Platform == "" || req.SessionID == "" || req.Content == "" {
		respondError(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Set default timestamp if not provided, otherwise convert to local timezone
	if req.Timestamp.IsZero() {
		req.Timestamp = h.now().Local()
	} else {
		req.Timestamp = req.Timestamp.Local()
	}

	// Set default title if not provided
	if req.Title == "" {
		req.Title = "Untitled"
	}

	// Write message
	filePath, err := h.writer.WriteMessage(&req)
	if err != nil {
		log.Printf("Error writing message: %v", err)
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]any{
		"status":    "success",
		"message":   "Message written",
		"file_path": filePath,
	})
}

// handleStatus returns server status
func (h *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, map[string]any{
		"status":         "ok",
		"save_directory": h.config.SaveDirectory,
		"platforms":      h.config.Platforms,
		"version":        "1.0.0",
	})
}

// respondJSON writes a JSON response
func respondJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// respondError writes an error response
func respondError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]any{
		"status":  "error",
		"message": message,
	})
}

// now returns current time
func (h *Handler) now() time.Time {
	return time.Now()
}
