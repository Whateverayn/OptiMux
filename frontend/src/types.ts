// types.ts

export type TaskType = 'convert' | 'concat' | 'trash';

export interface MediaInfo {
    id: string; // UUID
    path: string; // Goのjsonタグに合わせて小文字
    inputPaths?: string[]; // Concatのとき [temp1, temp2...]
    taskType: TaskType; // タスクの種類
    processRequest?: ProcessRequest; // 実行パラメータ (レシピ生成時に確定させる)
    size: number; // ファイルサイズ (byte)
    hasVideo: boolean;
    hasAudio: boolean;
    duration: number; // 総時間 (秒)
    progress?: number; // 現在の進捗率 (0-100)
    status?: 'waiting' | 'uploading' | 'processing' | 'done' | 'error' | 'skipped'; // 状態管理用
    dependencyRefs?: string[]; // concatタスクの場合: "ref:{parentTaskId}" を入れる
    isTemp?: boolean; // Windows一時ファイルフラグ

    // 結果格納用
    encodedSize?: number; // ffmpegが吐き出した現在のファイルサイズ (KB単位想定)
    outputType?: 'same' | 'video' | 'download' | 'temp';
    outputPath?: string; // 変換後のパス
    tempOutputPath?: string;
    startedAt?: number;   // このファイルの処理開始時刻 (Date.now())
    completedAt?: number; // 処理終了時刻
    timeScale?: number; // 時間圧縮率 (デフォルトは 1.0)
}

// レシピの定義
export interface Recipe {
    id: string;
    name: string;
    description: string;
    // レシピごとのパラメータ設定UIが必要ならここに定義
    defaultParams: Record<string, any>;
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
