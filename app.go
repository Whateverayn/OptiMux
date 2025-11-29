package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// MediaInfo は ffprobe から取得したファイル情報を保持
type MediaInfo struct {
	// ファイルパス
	Path string `json:"path"`
	// ファイルサイズ (バイト)
	Size int64 `json:"size"`
	// 映像ストリームが存在するか
	HasVideo bool `json:"hasVideo"`
	// 音声ストリームが存在するか
	HasAudio bool `json:"hasAudio"`
	// 時間
	Duration float64 `json:"duration"`
}

// フロントエンドから受け取る設定
type EncodeOptions struct {
	Codec     string `json:"codec"`     // "hevc" | "av1"
	Audio     string `json:"audio"`     // "copy" | "none"
	Extension string `json:"extension"` // "mp4"  | "mov"
}

// 変換結果を返すための構造体
type ConvertResult struct {
	OutputPath string `json:"outputPath"`
	Size       int64  `json:"size"`
}

// フロントエンドに送る進捗データ構造体
type ProgressEvent struct {
	TimeSec float64 `json:"timeSec"` // 経過時間 (秒)
	Size    int64   `json:"size"`    // 現在サイズ (byte)
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	go func() {
		// スプラッシュ
		time.Sleep(3000 * time.Millisecond)

		// フルスクリーン解除
		wailsRuntime.WindowUnfullscreen(ctx)

		// 待つ
		time.Sleep(1 * time.Second)

		// フロントエンドに準備完了を通知
		wailsRuntime.EventsEmit(ctx, "app:ready")
	}()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ヘルパー関数: 一般的なパスを追加する
func fixPath() {
	var newPaths []string

	// 実行ファイルの場所を探す
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)

		// 実行ファイルと同じ場所
		newPaths = append(newPaths, exeDir)
		// "bin" サブディレクトリ (OptiMux/bin/ffmpeg とかに置く場合用)
		newPaths = append(newPaths, filepath.Join(exeDir, "bin"))
	}

	// シェル
	if runtime.GOOS != "windows" {
		shell := os.Getenv("SHELL")
		if shell == "" {
			if runtime.GOOS == "darwin" {
				shell = "/bin/zsh"
			} else {
				shell = "/bin/bash"
			}
		}

		// ログインシェルとして起動し、PATHを出力させる
		cmd := exec.Command(shell, "-l", "-c", "echo $PATH")
		output, err := cmd.Output()
		if err == nil {
			shellPath := strings.TrimSpace(string(output))
			if shellPath != "" {
				// シェルのPATHを分解してリストに追加
				newPaths = append(newPaths, strings.Split(shellPath, string(os.PathListSeparator))...)
			}
		}
	}

	// 現在のPATHと合体
	currentPath := os.Getenv("PATH")
	currentPaths := strings.Split(currentPath, string(os.PathListSeparator))

	// 既存のPATHも後ろに追加 (システム標準のパスを維持)
	newPaths = append(newPaths, currentPaths...)

	// 重複排除しつつ結合
	finalPath := joinPathsUnique(newPaths)

	// 環境変数にセット
	os.Setenv("PATH", finalPath)

	dfinalPath := os.Getenv("PATH")
	fmt.Println("==========================================")
	fmt.Println("[DEBUG] Current OS:", runtime.GOOS)
	fmt.Println("[DEBUG] Executable Path:", os.Args[0])
	fmt.Println("[DEBUG] Final PATH:", dfinalPath)
	fmt.Println("==========================================")
}

// パスリストを重複排除して結合する
func joinPathsUnique(paths []string) string {
	seen := make(map[string]bool)
	var result []string

	for _, p := range paths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		// パスのクリーニング ( /path/to/./bin -> /path/to/bin )
		cleanP := filepath.Clean(p)

		if !seen[cleanP] {
			seen[cleanP] = true
			result = append(result, cleanP)
		}
	}

	return strings.Join(result, string(os.PathListSeparator))
}

// AnalyzeMedia は指定されたファイルの映像および音声ストリームの有無を ffprobe で判定
// Wailsのフロントエンドから呼び出される
func (a *App) AnalyzeMedia(filePath string) (MediaInfo, error) {
	fixPath()

	// ファイルサイズを取得する
	fileStat, err := os.Stat(filePath)
	if err != nil {
		return MediaInfo{}, fmt.Errorf("ファイル情報の取得に失敗しました: %w", err)
	}

	// ffprobeがPATH上にあるか確認
	ffprobePath, err := exec.LookPath("ffprobe")
	if err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobeが見つかりません. PATHが通っているか確認してください: %w", err)
	}

	log.Printf("渡されたファイルパス: %s\n", filePath)

	// ffprobeでストリーム情報を取得するコマンドを組み立てます
	// -show_streams: ストリーム情報全体を表示
	// -of json: 出力形式をJSONに指定
	args := []string{
		"-v", "error",
		"-show_streams",
		"-show_format",
		"-of", "json",
		filePath,
	}

	cmd := exec.Command(ffprobePath, args...)
	output, err := cmd.Output()
	if err != nil {
		// ファイルが見つからない, またはffprobeがエラーを返した場合
		return MediaInfo{}, fmt.Errorf("ffprobeの実行に失敗しました (%s): %w", string(output), err)
	}

	// ffprobeのJSON出力をパースするための構造体
	var probeResult struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}

	if err := json.Unmarshal(output, &probeResult); err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobeのJSON解析に失敗しました: %w", err)
	}

	info := MediaInfo{
		Path: filePath,
		Size: fileStat.Size(), // サイズを格納
	}

	// 映像と音声の有無を判定
	for _, stream := range probeResult.Streams {
		switch stream.CodecType {
		case "video":
			info.HasVideo = true
		case "audio":
			info.HasAudio = true
		}
	}

	// Duration取得
	if d, err := strconv.ParseFloat(probeResult.Format.Duration, 64); err == nil {
		info.Duration = d
	}

	return info, nil
}

// 動画変換を実行 (非同期で実行され、イベントで進捗を通知)
func (a *App) ConvertVideo(inputPath string, opts EncodeOptions) (ConvertResult, error) {
	fixPath()
	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		return ConvertResult{}, fmt.Errorf("ffmpegが見つかりません. PATHが通っているか確認してください: %w", err)
	}

	// 出力パスの生成 (例: input.mov -> input_opt.mov)
	ext := opts.Extension
	if ext == "" {
		ext = "mov"
	}
	outputPath := strings.TrimSuffix(inputPath, filepath.Ext(inputPath)) + "_" + opts.Codec + "." + ext

	// コマンド組立
	args := []string{
		"-i", inputPath,
	}

	// 映像設定
	if opts.Codec == "av1" {
		// SVT-AV1
		args = append(args, "-c:v", "libsvtav1", "-crf", "32", "-preset", "8")
	} else {
		// x265
		args = append(args, "-c:v", "libx265", "-crf", "23", "-preset", "medium", "-tag:v", "hvc1")
	}

	// 音声設定
	if opts.Audio == "none" {
		args = append(args, "-an")
	} else {
		args = append(args, "-c:a", "copy")
	}

	// メタデータ
	args = append(args, "-map_metadata", "0")

	// 進捗情報を標準出力(pipe:1)に流す設定
	// 進捗データ: stdout; ログ: stderr
	args = append(args, "-progress", "pipe:1", "-nostats")

	// 出力パス
	args = append(args, outputPath)

	// コマンド実行
	cmd := exec.Command(ffmpegPath, args...)

	// パイプの準備
	stdout, _ := cmd.StdoutPipe() // 進捗データ用
	stderr, _ := cmd.StderrPipe() // ログテキスト用

	// 標準エラー出力(stderr)をパイプで取得
	if err := cmd.Start(); err != nil {
		return ConvertResult{}, err
	}

	// 並行処理の待機用
	var wg sync.WaitGroup
	wg.Add(2)

	// 進捗データ解析 (stdout)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)

		// key=value 形式の変数を一時保存
		var currentSize int64 = 0
		var currentTime float64 = 0

		for scanner.Scan() {
			line := scanner.Text()
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])

			// 必要な情報を抽出
			if key == "total_size" {
				// バイト単位で来るのでそのまま使える
				if s, err := strconv.ParseInt(val, 10, 64); err == nil {
					currentSize = s
				}
			} else if key == "out_time_us" {
				// マイクロ秒で来るので秒に変換
				if t, err := strconv.ParseFloat(val, 64); err == nil {
					currentTime = t / 1000000.0
				}
			} else if key == "progress" && val == "continue" {
				// 1フレーム分のデータが揃ったタイミングでイベント送信
				wailsRuntime.EventsEmit(a.ctx, "conversion:progress", ProgressEvent{
					TimeSec: currentTime,
					Size:    currentSize,
				})
			}
		}
	}()

	// ゴルーチンでログを読み取ってフロントエンドに送信 (stderr)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)

		// カスタム分割関数を設定 (\r または \n で分割)
		scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
			if atEOF && len(data) == 0 {
				return 0, nil, nil
			}
			if i := bytes.IndexAny(data, "\r\n"); i >= 0 {
				// \r または \n が見つかったら, そこまでをトークンとして返す
				return i + 1, data[:i], nil
			}
			if atEOF {
				return len(data), data, nil
			}
			return 0, nil, nil
		})

		for scanner.Scan() {
			line := scanner.Text()
			log.Println(line)

			// Wailsのイベント発行: "conversion:log"
			if len(strings.TrimSpace(line)) > 0 {
				wailsRuntime.EventsEmit(a.ctx, "conversion:log", line)
			}
		}
	}()

	// コマンド終了とゴルーチンの完了を待つ
	err = cmd.Wait()
	wg.Wait()

	if err != nil {
		return ConvertResult{}, fmt.Errorf("変換に失敗しました: %w", err)
	}

	// 生成されたファイルの情報を取得して返す
	fileInfo, err := os.Stat(outputPath)
	if err != nil {
		// 変換は成功したがファイルが見つからないケース（稀だが一応）
		return ConvertResult{}, fmt.Errorf("出力ファイルの確認に失敗しました: %w", err)
	}

	// 結果を返す
	return ConvertResult{
		OutputPath: outputPath,
		Size:       fileInfo.Size(),
	}, nil
}

// UploadChunk: 分割データを受け取りファイルに追記する
func (a *App) UploadChunk(filename string, dataBase64 string, offset int64) (string, error) {
	// 保存先: ~/Downloads/OptiMux_Temp
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, "Downloads", "OptiMux_Temp")
	_ = os.MkdirAll(dir, 0755)

	path := filepath.Join(dir, filename)

	// ファイルを開く (作成 or 追記)
	flags := os.O_WRONLY | os.O_CREATE
	if offset == 0 {
		flags |= os.O_TRUNC // 初回は上書き
	} else {
		flags |= os.O_APPEND // 2回目以降は追記
	}

	f, err := os.OpenFile(path, flags, 0644)
	if err != nil {
		return "", err
	}
	defer f.Close()

	// Base64デコード
	payload := dataBase64
	if idx := strings.Index(dataBase64, ","); idx != -1 {
		payload = dataBase64[idx+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", err
	}

	_, err = f.Write(decoded)
	return path, err
}
