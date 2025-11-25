import React from 'react';
import { MediaInfo } from "../../types.js";

interface Props {
    fileList: MediaInfo[];
    isProcessing: boolean;
}

export default function StatusBar({ fileList, isProcessing }: Props) {
    // グローバル進捗率の計算
    const totalFiles = fileList.length;
    let globalProgress = 0;
    let statusText = "Ready 👺";

    if (totalFiles > 0) {
        const totalPercent = fileList.reduce((acc, file) => acc + (file.progress || 0), 0);
        globalProgress = totalPercent / totalFiles;

        // ステータス表示の切り替え
        if (isProcessing) {
            // 完了数カウント
            const doneCount = fileList.filter(f => f.status === 'done').length;
            statusText = `🦔 Processing... (${doneCount}/${totalFiles}) 🚀`;
        } else if (fileList.every(f => f.status === 'done')) {
            statusText = "👺 All Done ✨";
        } else if (fileList.some(f => f.status === 'done')) {
            statusText = "🐥 Paused ☕";
        }
    }

    return (
        <div className="status-bar">
            {/* テキスト */}
            <p className="status-bar-field w-10">{statusText}</p>

            {/* プログレスバー */}
            <p className="status-bar-field flex-1">
                <div className="progress-indicator segmented w-full">
                    <span
                        className="progress-indicator-bar"
                        style={{ width: `${globalProgress}%`, transition: 'width 0.2s' }}
                    ></span>
                </div>
            </p>

            {/* 残り時間 */}
            <p className="status-bar-field w-10 text-center">--:--</p>
        </div>
    );
}