package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// OSごとのD&D設定を取得 (hook_*.go で定義)
	dndOptions := getDragAndDropOptions()

	// Create application with options
	err := wails.Run(&options.App{
		Title:                    "OptiMux",
		Width:                    1024,
		Height:                   768,
		Fullscreen:               true,
		DragAndDrop:              dndOptions,
		EnableDefaultContextMenu: true,
		Frameless:                true,
		Windows: &windows.Options{
			DisableFramelessWindowDecorations: false,
		},
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
				HideTitleBar:               true,
				FullSizeContent:            true,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			ContentProtection:    false,
			About: &mac.AboutInfo{
				Title:   "OptiMux",
				Message: "© 2025 Me",
			},
		},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// OS固有のフック処理を実行 (WindowsならWin32フック, 他は何もしない)
			setupDragDropHook(ctx)
		},
		Bind: []any{
			app,
			&MediaInfo{},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
