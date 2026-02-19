package main

import "time"

// Data represents a chat message from the Chrome extension
type Data struct {
	Platform  string    `json:"platform"`   // deepseek, chatgpt
	SessionID string    `json:"session_id"` // unique session identifier
	Title     string    `json:"title"`      // session title
	Timestamp time.Time `json:"timestamp"`  // message timestamp
	Role      string    `json:"role"`       // user, assistant
	Content   string    `json:"content"`    // message content
}

// Platform constants
const (
	PlatformDeepSeek = "deepseek"
	PlatformChatGPT  = "chatgpt"
)

// Role constants
const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
)
