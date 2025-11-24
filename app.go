package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
)

// MediaInfo は ffprobe から取得したファイル情報を保持
type MediaInfo struct {
	// ファイルパス
	Path string `json:"path"`
	// 映像ストリームが存在するか
	HasVideo bool `json:"hasVideo"`
	// 音声ストリームが存在するか
	HasAudio bool `json:"hasAudio"`
	// ファイルサイズ, 時間などのメタデータも後で追加予定
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
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// AnalyzeMedia は指定されたファイルの映像および音声ストリームの有無を ffprobe で判定
// Wailsのフロントエンドから呼び出される
func (a *App) AnalyzeMedia(filePath string) (MediaInfo, error) {
	// ffprobeがPATH上にあるか確認
	ffprobePath, err := exec.LookPath("ffprobe")
	if err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobeが見つかりません. PATHが通っているか確認してください: %w", err)
	}

	// ffprobeでストリーム情報を取得するコマンドを組み立てます
	// -show_streams: ストリーム情報全体を表示
	// -of json: 出力形式をJSONに指定
	args := []string{
		"-v", "error",
		"-show_streams",
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
	}

	if err := json.Unmarshal(output, &probeResult); err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobeのJSON解析に失敗しました: %w", err)
	}

	info := MediaInfo{
		Path: filePath,
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

	return info, nil
}
