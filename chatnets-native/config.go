package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"gopkg.in/yaml.v3"
)

// Config represents the application configuration
type Config struct {
	SaveDirectory string              `yaml:"save_directory"`
	ObsidianVault string              `yaml:"obsidian_vault"`
	Platforms     map[string]Platform `yaml:"platforms"`
	HTTPPort      int                 `yaml:"http_port"`
	HTTPEnabled   bool                `yaml:"http_enabled"`
	LogLevel      string              `yaml:"log_level"`

	mu sync.RWMutex
}

// Platform represents a platform configuration
type Platform struct {
	Enabled bool `yaml:"enabled"`
}

// configPath returns the path to the config file
func configPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".chatnets", "config.yaml")
}

// LoadConfig loads the configuration from the config file
func LoadConfig() (*Config, error) {
	path := configPath()

	// Check if config file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Create default config
		config := DefaultConfig()
		if err := config.Save(); err != nil {
			return nil, fmt.Errorf("create default config: %w", err)
		}
		return config, nil
	}

	// Read config file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	// Parse YAML
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Set defaults for missing values
	if config.SaveDirectory == "" {
		homeDir, _ := os.UserHomeDir()
		// Default to vault/_chats directory if obsidian_vault is set
		if config.ObsidianVault != "" {
			config.SaveDirectory = filepath.Join(config.ObsidianVault, "_chats")
		} else {
			config.SaveDirectory = filepath.Join(homeDir, "Chatnets")
		}
	}
	if config.Platforms == nil {
		config.Platforms = map[string]Platform{
			"deepseek": {Enabled: true},
			"chatgpt":  {Enabled: true},
		}
	}
	if config.HTTPPort == 0 {
		config.HTTPPort = 8766
	}
	if config.LogLevel == "" {
		config.LogLevel = "info"
	}

	return &config, nil
}

// Save saves the configuration to the config file
func (c *Config) Save() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	path := configPath()

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	// Marshal to YAML
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	// Write file
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}

	return nil
}

// DefaultConfig returns a default configuration
func DefaultConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	vaultPath := filepath.Join(homeDir, "Chatnets/chatnets-vault")
	return &Config{
		SaveDirectory: filepath.Join(vaultPath, "_chats"),
		ObsidianVault: vaultPath,
		Platforms: map[string]Platform{
			"deepseek": {Enabled: true},
			"chatgpt":  {Enabled: true},
		},
		HTTPPort:    8766,
		HTTPEnabled: true,
		LogLevel:    "info",
	}
}
