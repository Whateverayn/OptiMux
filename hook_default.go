//go:build !windows

package main

import (
	"context"
	"github.com/wailsapp/wails/v2/pkg/options"
)

// macOS/Linux用設定: Wails標準のD&Dを有効化
func getDragAndDropOptions() *options.DragAndDrop {
	return &options.DragAndDrop{
		EnableFileDrop:     true,
		DisableWebViewDrop: true,
		CSSDropProperty:    "--wails-drop-target",
		CSSDropValue:       "drop",
	}
}

// macOS/Linux用フック: 何もしない (標準機能で足りるため)
func setupDragDropHook(ctx context.Context) {
	// No-op
}