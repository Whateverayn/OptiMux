# アプリ名とバージョン定義
APP_NAME := OptiMux
VERSION := $(shell grep '"version":' wails.json | cut -d '"' -f 4)
DIST_DIR := dist
BIN_DIR := build/bin

# ターゲット定義
.PHONY: all clean macos windows windows-amd64 windows-arm64 linux linux-amd64 linux-arm64

# デフォルト: 全部ビルド
all: clean macos windows linux

# クリーンアップ
clean:
	@echo "Cleaning up..."
	rm -rf $(DIST_DIR)
	rm -rf $(BIN_DIR)

# ---------------------------------------------------------
# macOS (Universal: Intel + Apple Silicon)
# ---------------------------------------------------------
macos:
	@echo "Building for macOS (Universal)..."
	wails build -platform darwin/universal -clean
	@mkdir -p $(DIST_DIR)
	@echo "Zipping macOS bundle..."
	cd $(BIN_DIR) && zip -r -q ../../$(DIST_DIR)/$(APP_NAME)_v$(VERSION)_macOS_universal.zip $(APP_NAME).app
	@echo "macOS build done."

# ---------------------------------------------------------
# Windows (AMD64 & ARM64)
# ---------------------------------------------------------
windows: windows-amd64 windows-arm64

windows-amd64:
	@echo "Building for Windows (amd64)..."
	wails build -platform windows/amd64 -clean
	@mkdir -p $(DIST_DIR)
	@echo "Zipping Windows (amd64)..."
	cd $(BIN_DIR) && zip -q ../../$(DIST_DIR)/$(APP_NAME)_v$(VERSION)_windows_amd64.zip $(APP_NAME).exe
	@echo "Windows (amd64) build done."

windows-arm64:
	@echo "Building for Windows (arm64)..."
	wails build -platform windows/arm64 -clean
	@mkdir -p $(DIST_DIR)
	@echo "Zipping Windows (arm64)..."
	cd $(BIN_DIR) && zip -q ../../$(DIST_DIR)/$(APP_NAME)_v$(VERSION)_windows_arm64.zip $(APP_NAME).exe
	@echo "Windows (arm64) build done."

# ---------------------------------------------------------
# Linux (AMD64 & ARM64)
# ---------------------------------------------------------
linux: linux-amd64 linux-arm64

linux-amd64:
	@echo "Building for Linux (amd64)..."
	wails build -platform linux/amd64 -clean
	@mkdir -p $(DIST_DIR)
	@echo "Zipping Linux (amd64)..."
	cd $(BIN_DIR) && zip -q ../../$(DIST_DIR)/$(APP_NAME)_v$(VERSION)_linux_amd64.zip $(APP_NAME)
	@echo "Linux (amd64) build done."

linux-arm64:
	@echo "Building for Linux (arm64)..."
	wails build -platform linux/arm64 -clean
	@mkdir -p $(DIST_DIR)
	@echo "Zipping Linux (arm64)..."
	cd $(BIN_DIR) && zip -q ../../$(DIST_DIR)/$(APP_NAME)_v$(VERSION)_linux_arm64.zip $(APP_NAME)
	@echo "Linux (arm64) build done."