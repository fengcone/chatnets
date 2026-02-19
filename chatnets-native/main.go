package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	DEFAULT_PORT = 8766
	DEFAULT_HOST = "127.0.0.1"
)

func main() {
	// Load config
	config, err := LoadConfig()
	if err != nil {
		log.Printf("Warning: failed to load config, using defaults: %v", err)
		config = DefaultConfig()
	}

	// Override port if specified in config
	port := config.HTTPPort
	if port == 0 {
		port = DEFAULT_PORT
	}

	// Create handler
	handler := NewHandler(config)

	// Setup HTTP routes
	http.HandleFunc("/api/ping", handlePing)
	http.HandleFunc("/api/config", handleConfig(config))
	http.HandleFunc("/api/write", handler.handleWrite)
	http.HandleFunc("/api/status", handler.handleStatus)

	// Start server
	addr := fmt.Sprintf("%s:%d", DEFAULT_HOST, port)
	log.Printf("Chatnets server starting on http://%s", addr)
	log.Printf("Save directory: %s", config.SaveDirectory)
	log.Printf("Press Ctrl+C to stop")

	// Start server in goroutine
	server := &http.Server{
		Addr:         addr,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down server...")
	// Graceful shutdown would go here
	log.Println("Bye!")
}

// handlePing responds with pong
func handlePing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "pong"})
}

// handleConfig returns current configuration
func handleConfig(config *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":         "ok",
			"save_directory": config.SaveDirectory,
			"platforms":      config.Platforms,
			"version":        "1.0.0",
		})
	}
}
