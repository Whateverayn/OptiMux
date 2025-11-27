export interface MediaInfo {
    id: string; // UUID
    path: string; // Goのjsonタグに合わせて小文字
    hasVideo: boolean;
    hasAudio: boolean;
    duration: number; // 総時間(秒)
    progress?: number; // 現在の進捗率(0-100)
    status?: 'waiting' | 'uploading' | 'processing' | 'done' | 'error'; // 状態管理用
}