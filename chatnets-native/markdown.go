package main

import (
	"fmt"
	"strings"
)

// formatMessage formats a chat message as markdown
func formatMessage(data *Data, messageIndex int) string {
	role := capitalize(data.Role)
	timestamp := data.Timestamp.Format("15:04:05")

	// Escape markdown special characters in content
	content := escapeMarkdown(data.Content)

	// 使用 Obsidian 锚点格式：标题 ^message-N（锚点必须在标题末尾）
	return fmt.Sprintf("## [%s] %s ^message-%d\n\n%s", timestamp, role, messageIndex, content)
}

// escapeMarkdown escapes markdown special characters
func escapeMarkdown(text string) string {
	// Characters that need escaping in markdown
	// We're conservative and only escape when necessary for code blocks etc.
	// For general text, we leave most characters alone

	// Handle code blocks - don't escape content inside code blocks
	var result strings.Builder
	inCodeBlock := false
	lines := strings.Split(text, "\n")

	for i, line := range lines {
		trimmed := strings.TrimLeft(line, " \t")
		if strings.HasPrefix(trimmed, "```") {
			inCodeBlock = !inCodeBlock
		}

		if !inCodeBlock {
			// Escape certain characters outside code blocks
			line = strings.ReplaceAll(line, "<", "&lt;")
			line = strings.ReplaceAll(line, ">", "&gt;")
		}

		result.WriteString(line)
		if i < len(lines)-1 {
			result.WriteString("\n")
		}
	}

	return result.String()
}
