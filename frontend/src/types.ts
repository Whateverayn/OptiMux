// types.ts

export interface MediaInfo {
    id: string; // UUID
    path: string; // Goのjsonタグに合わせて小文字
    size: number; // ファイルサイズ (byte)
    hasVideo: boolean;
    hasAudio: boolean;
    duration: number; // 総時間 (秒)
    progress?: number; // 現在の進捗率 (0-100)
    status?: 'waiting' | 'uploading' | 'processing' | 'done' | 'error'; // 状態管理用
    isTemp?: boolean; // Windows一時ファイルフラグ

    // 結果格納用
    encodedSize?: number; // ffmpegが吐き出した現在のファイルサイズ (KB単位想定)
    outputPath?: string; // 変換後のパス
    startedAt?: number;   // このファイルの処理開始時刻 (Date.now())
    completedAt?: number; // 処理終了時刻

    // UI用の設定保持 (リスト個別に設定を変える場合用)
    outputType?: 'same' | 'video' | 'download' | 'temp';
}

// バッチ処理全体のステータス
export type BatchStatus = 'idle' | 'importing' | 'converting';

// 入力設定
export type InputConfig = {
    mode: 'single' | 'concat'; // 単体ファイルか, 連結用リストか
    paths: string[];           // 単体なら1つ, リストなら複数
};

// 出力先のルール設定
export type OutputConfig = {
    label: string; // 'main', 'proxy' 等

    // 場所
    dirType: 'absolute' | 'relative' | 'video' | 'download' | 'temp' | 'same';
    customDir?: string; // absolute/relativeの場合のパス

    // ファイル名
    nameMode: 'auto' | 'fixed' | 'uuid';
    nameValue: string; // autoならsuffix(_hevc), fixedならファイル名
    extension: string; // mp4, mov...

    // この出力個別のFFmpegオプション (-map, -c:v 等)
    ffmpegOptions: string[];
};

// Goに投げるリクエスト全体
export type ProcessRequest = {
    fileId: string;       // 進捗通知用ID (代表ID)
    input: InputConfig;
    globalOptions: string[]; // -filter_complex 等
    outputs: OutputConfig[]; // 出力は配列で管理 (1つでも2つでも可)
};

export type FileResult = {
    label: string;
    path: string;
    size: number;
};

export type ProcessResult = {
    results: FileResult[];
};
