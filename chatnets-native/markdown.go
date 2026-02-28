package main

import (
	"fmt"
	"regexp"
	"strings"
)

// formatMessage formats a chat message as markdown
func formatMessage(data *Data, messageIndex int) string {
	role := capitalize(data.Role)
	timestamp := data.Timestamp.Format("15:04:05")

	if role == "User" {
		// Extract first line of text for the outline heading
		titleLine := extractTitleFromContent(data.Content, 40)
		content := escapeMarkdown(data.Content)

		// Render User message as a heading so it appears in Obsidian Outline
		return fmt.Sprintf("### [%s] %s ^message-%d\n\n%s", timestamp, titleLine, messageIndex, content)
	}

	// For Assistant or other roles:
	// Render Assistant header as bold plain text (not heading) to keep outline clean
	content := escapeMarkdown(data.Content)
	// Downgrade headings inside Assistant messages to bold text
	content = downgradeHeadings(content)

	return fmt.Sprintf("**[%s] %s** ^message-%d\n\n%s", timestamp, role, messageIndex, content)
}

// extractTitleFromContent extracts the first sensible line from the user's prompt
func extractTitleFromContent(content string, maxLength int) string {
	lines := strings.Split(strings.TrimSpace(content), "\n")
	if len(lines) == 0 {
		return "User Message"
	}

	firstLine := strings.TrimSpace(lines[0])

	// Convert to runes for utf8-aware length checking
	runes := []rune(firstLine)
	if len(runes) > maxLength {
		return string(runes[:maxLength]) + "..."
	}
	if len(runes) == 0 {
		return "User Message"
	}
	return string(runes)
}

// downgradeHeadings converts standard markdown headings (# text) to bold text (**text**)
func downgradeHeadings(content string) string {
	var result strings.Builder
	inCodeBlock := false
	lines := strings.Split(content, "\n")

	// Regex to match markdown headings: 1 to 6 hashes following by space and text
	headingRegex := regexp.MustCompile(`^(#{1,6})\s+(.+)$`)

	for i, line := range lines {
		trimmed := strings.TrimLeft(line, " \t")
		if strings.HasPrefix(trimmed, "```") {
			inCodeBlock = !inCodeBlock
		}

		if !inCodeBlock {
			if headingRegex.MatchString(line) {
				line = headingRegex.ReplaceAllString(line, "**$2**")
			}
		}

		result.WriteString(line)
		if i < len(lines)-1 {
			result.WriteString("\n")
		}
	}

	return result.String()
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
