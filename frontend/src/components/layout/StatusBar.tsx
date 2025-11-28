import React from 'react';
import { MediaInfo } from "../../types.js";
import ProgressBar from '../ui/ProgressBar.js';

interface Props {
    fileList: MediaInfo[];
    isProcessing: boolean;
}

export default function StatusBar({ fileList = [], isProcessing = false }: Props) {
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
        
        <div className="status-bar flex">
            {/* テキスト */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">{statusText}</div>

            {/* プログレスバー */}
            <ProgressBar value={globalProgress} className="status-bar-field grow flex-1 h-full w-full" />

            {/* 残り時間 */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">--:--</div>
        </div>
    );
}