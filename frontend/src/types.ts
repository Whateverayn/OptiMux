// types.ts

export interface MediaInfo {
    id: string; // UUID
    path: string; // Goのjsonタグに合わせて小文字
    outputPath?: string; // 変換後のパス
    size: number; // ファイルサイズ (byte)
    hasVideo: boolean;
    hasAudio: boolean;
    duration: number; // 総時間 (秒)
    progress?: number; // 現在の進捗率 (0-100)
    status?: 'waiting' | 'uploading' | 'processing' | 'done' | 'error'; // 状態管理用
    encodedSize?: number; // ffmpegが吐き出した現在のファイルサイズ (KB単位想定)
    startedAt?: number;   // このファイルの処理開始時刻 (Date.now())
    completedAt?: number; // 処理終了時刻
    isTemp?: boolean; // Windows一時ファイルフラグ
}

// バッチ処理全体のステータス
export type BatchStatus = 'idle' | 'importing' | 'converting';