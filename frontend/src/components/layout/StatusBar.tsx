// StatusBar.tsx

import React from 'react';
import ProgressBar from '../ui/ProgressBar.js';
import { useJob } from '../../contexts/JobContext.js';

export default function StatusBar() {
    const { batchStatus, metrics } = useJob();

    // フォーマット関数
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        // 桁数に応じて小数の長さを変える (有効数字4桁狙い)
        const val = bytes / Math.pow(k, i);
        return `${val.toPrecision(4)} ${sizes[i]}`;
    };

    // 時間フォーマット (MM:SS)
    const formatTime = (sec: number): string => {
        if (!isFinite(sec) || sec < 0) return "--:--";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // 終了時刻文字列
    let finishTimeStr = "--:--:--";
    if (batchStatus !== 'idle' && metrics.etaSeconds > 0 && isFinite(metrics.etaSeconds)) {
        const finishDate = new Date(Date.now() + metrics.etaSeconds * 1000);
        finishTimeStr = finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    let statusText = "Ready 👺";
    let speedText = "----- --/----- -- (----- --/s)";

    if (batchStatus === 'importing') {
        // Windows用コピー処理中
        // waiting になったものを完了とみなしてカウント
        // metrics.completedFiles + metrics.activeFile (uploading) ?
        // JobContextのmetricsロジックに依存するが、基本的に importing 中は Setup画面なので files リストが対象

        statusText = `📥 Importing... (${metrics.completedFiles}/${metrics.totalFiles})`;
        // コピー中は転送速度
        speedText = `${formatBytes(metrics.totalEncodedSize)} / ${formatBytes(metrics.totalOriginalSize)} (${formatBytes(metrics.currentSpeedBps)}/s)`;

    } else if (batchStatus === 'converting') {
        // 変換処理中
        statusText = `🦔 Processing... (${metrics.completedFiles}/${metrics.totalFiles})`;

        // 削減率 (%)
        const sign = metrics.reductionRate >= 0 ? "▼" : "▲";
        speedText = `${formatBytes(metrics.totalEncodedSize)} / ${formatBytes(metrics.totalProjectedSize)} (${sign}${Math.abs(metrics.reductionRate).toFixed(0)}%)`;

    } else if (metrics.isJobFinished && metrics.totalFiles > 0) {
        // 全完了 (JobContextのisJobFinishedフラグを使用)
        statusText = "👺 All Done ✨";
        // 完了時は最終的な削減率を表示
        speedText = `Final: ${formatBytes(metrics.totalEncodedSize)} (▼${metrics.reductionRate.toFixed(1)}%)`;
    } else {
        // 初期状態 / 一時停止 / エラー等
        statusText = metrics.totalFiles > 0 ? "🐥 Ready to go ☕" : "Ready 👺";
    }

    return (
        <div className="status-bar flex">
            {/* ステータス */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">{statusText}</div>

            {/* データ量と速度 */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">{speedText}</div>

            {/* プログレスバー */}
            <ProgressBar value={metrics.globalProgress} className="status-bar-field grow flex-1 h-full w-full" />

            {/* 残り時間 */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">
                {/* idle 以外なら時間を表示 */}
                {batchStatus !== 'idle' ? (
                    <>
                        {/* 経過 / 予想総時間 (-残り時間) */}
                        <span>
                            {formatTime(metrics.elapsedSeconds)} / {formatTime(metrics.elapsedSeconds + metrics.etaSeconds)}
                            <span className="text-gray-700"> (-{formatTime(metrics.etaSeconds)})</span>
                        </span>
                    </>
                ) : (
                    "--:-- / --:--"
                )}
            </div>

            {/* 終了時刻 (Finish At) */}
            <div className="status-bar-field !grow-0 px-2 flex items-center font-bold" title="Estimated Finish Time">
                {batchStatus !== 'idle' ? finishTimeStr : "--:--:--"}
            </div>
        </div>
    );
}