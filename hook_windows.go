//go:build windows

package main

import (
	"context"
	"fmt"
	"syscall"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/options"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Win32 API 定数
const (
	GWLP_WNDPROC = -4
	WM_DROPFILES = 0x0233
)

// Win32 API 関数
var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	ole32    = syscall.NewLazyDLL("ole32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procSetWindowLongPtr         = user32.NewProc("SetWindowLongPtrW")
	procCallWindowProc           = user32.NewProc("CallWindowProcW")
	procEnumWindows              = user32.NewProc("EnumWindows")
	procEnumChildWindows         = user32.NewProc("EnumChildWindows")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procGetClassName             = user32.NewProc("GetClassNameW")

	procDragQueryFile   = shell32.NewProc("DragQueryFileW")
	procDragFinish      = shell32.NewProc("DragFinish")
	procDragAcceptFiles = shell32.NewProc("DragAcceptFiles")

	procRevokeDragDrop      = ole32.NewProc("RevokeDragDrop")
	procGetCurrentProcessId = kernel32.NewProc("GetCurrentProcessId")
)

var (
	oldWndProc    uintptr                     // 親ウィンドウの元プロシージャ
	childWndProcs = make(map[uintptr]uintptr) // 子ウィンドウ用マップ
	hookCtx       context.Context
	mainHwnd      uintptr
)

// Windows用設定: Wails標準のD&Dは無効化し, 自前のフックを使う
func getDragAndDropOptions() *options.DragAndDrop {
	return &options.DragAndDrop{
		EnableFileDrop:     false, // Wails標準機能を無効化
		DisableWebViewDrop: false, // WebView側も干渉させない
	}
}

// Windows用フック: Win32 APIを使ってメッセージを横取りする
func setupDragDropHook(ctx context.Context) {
	hookCtx = ctx

	// 親ウィンドウを探す
	mainHwnd = findWindowByProcessId()
	if mainHwnd == 0 {
		fmt.Println("💥 [Win32 Hook] Failed to find main window handle!")
		return
	}
	fmt.Printf("👺 [Win32 Hook] Found Window Handle: %x\n", mainHwnd)

	// 親に対しても一応やっておく
	applyHook(mainHwnd, true)

	// 子ウィンドウ（WebView2）を全探索してフックする
	enumChildCallback := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		// クラス名を取得して確認
		buf := make([]uint16, 256)
		procGetClassName.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), 256)
		className := syscall.UTF16ToString(buf)

		fmt.Printf("🔍 Child HWND: %x (Class: %s)\n", hwnd, className)
		// 見つかった子ウィンドウにはすべてフックを試みる
		applyHook(hwnd, false)

		return 1 // Continue
	})
	procEnumChildWindows.Call(mainHwnd, enumChildCallback, 0)
}

func applyHook(hwnd uintptr, isMain bool) {
	// OLE Drag&Drop (WebView2のデフォルト) を無効化する
	procRevokeDragDrop.Call(hwnd)

	// レガシーな WM_DROPFILES を受け入れるように宣言
	procDragAcceptFiles.Call(hwnd, 1) // 1 = TRUE

	// プロシージャ差し替え
	newWndProc := syscall.NewCallback(wndProc)
	// (^3 はビット反転すると ...111100 となり, これは2の補数表現で -4 になる)
	ret, _, _ := procSetWindowLongPtr.Call(
		hwnd,
		^uintptr(3), // GWLP_WNDPROC
		newWndProc,
	)

	if ret != 0 {
		if isMain {
			oldWndProc = ret
		} else {
			childWndProcs[hwnd] = ret
		}
		fmt.Printf("🪝 Hooked HWND: %x\n", hwnd)
	}
}

// プロセスIDからウィンドウを探すコールバック用
func findWindowByProcessId() uintptr {
	var foundHwnd uintptr
	pid, _, _ := procGetCurrentProcessId.Call()

	cb := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		var wndPid uintptr
		procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&wndPid)))

		if wndPid == pid {
			// 最初に見つかったウィンドウをメインとみなす（Wailsアプリは通常1つ）
			foundHwnd = hwnd
			return 0 // Stop enumeration
		}
		return 1 // Continue
	})

	procEnumWindows.Call(cb, 0)
	return foundHwnd
}

// ウィンドウプロシージャ (メッセージ処理)
func wndProc(hwnd syscall.Handle, msg uint32, wparam, lparam uintptr) uintptr {
	if msg == WM_DROPFILES {
		fmt.Println("👺 [Win32 Hook] WM_DROPFILES received!")
		// ドロップされたファイルパスを取得
		hDrop := wparam
		files := extractFiles(hDrop)

		// メモリ解放
		procDragFinish.Call(hDrop)

		// フロントエンドに通知
		if len(files) > 0 && hookCtx != nil {
			// 標準の "wails:file-drop" イベントとして送信
			fmt.Printf("📂 Dropped files: %v\n", files)
			wailsRuntime.EventsEmit(hookCtx, "wails:file-drop", 0, 0, files)
		}

		// 0を返してメッセージをここで消滅させる (WebView2には渡さない)
		return 0
	}

	// その他のメッセージは元の処理へ流す
	ret, _, _ := procCallWindowProc.Call(
		oldWndProc,
		uintptr(hwnd),
		uintptr(msg),
		wparam,
		lparam,
	)
	return ret
}

func extractFiles(hDrop uintptr) []string {
	cnt, _, _ := procDragQueryFile.Call(hDrop, 0xFFFFFFFF, 0, 0)
	fileCount := int(cnt)

	var files []string
	for i := 0; i < fileCount; i++ {
		size, _, _ := procDragQueryFile.Call(hDrop, uintptr(i), 0, 0)
		buf := make([]uint16, size+1)
		procDragQueryFile.Call(hDrop, uintptr(i), uintptr(unsafe.Pointer(&buf[0])), size+1)
		files = append(files, syscall.UTF16ToString(buf))
	}
	return files
}
