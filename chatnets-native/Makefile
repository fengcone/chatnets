.PHONY: build clean run test help install deps

# Binary name
BINARY_NAME=chatnets-native
# Build directory
BUILD_DIR=build
# Go build flags
GO_BUILD=go build
# Version
VERSION?=0.2.0

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Download dependencies
	go mod download
	go mod tidy

build: deps ## Build the binary
	$(GO_BUILD) -ldflags "-X main.version=$(VERSION)" -o $(BINARY_NAME) .
	@echo "Built $(BINARY_NAME) successfully"

build-all: deps ## Build for multiple platforms
	@echo "Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)
	@GOOS=darwin GOARCH=amd64 $(GO_BUILD) -ldflags "-X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 .
	@GOOS=darwin GOARCH=arm64 $(GO_BUILD) -ldflags "-X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 .
	@GOOS=linux GOARCH=amd64 $(GO_BUILD) -ldflags "-X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	@GOOS=windows GOARCH=amd64 $(GO_BUILD) -ldflags "-X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	@echo "Built binaries in $(BUILD_DIR)/"

clean: ## Clean build artifacts
	@rm -f $(BINARY_NAME)
	@rm -rf $(BUILD_DIR)
	@echo "Cleaned build artifacts"

run: build ## Run the server
	@echo "Starting Chatnets server on http://127.0.0.1:8766"
	@./$(BINARY_NAME)

test: ## Run tests
	@echo "Running tests..."
	@go test -v ./...

fmt: ## Format Go code
	@echo "Formatting code..."
	@go fmt ./...

vet: ## Run go vet
	@echo "Running go vet..."
	@go vet ./...

lint: fmt vet ## Run linters

install: build ## Install binary to $HOME/.local/bin
	@echo "Installing $(BINARY_NAME) to $$HOME/.local/bin..."
	@mkdir -p $$HOME/.local/bin
	@cp $(BINARY_NAME) $$HOME/.local/bin/
	@echo "Installed successfully. Add $$HOME/.local/bin to your PATH if needed."

.DEFAULT_GOAL := help
