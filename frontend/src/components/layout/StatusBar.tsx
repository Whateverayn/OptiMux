// StatusBar.tsx

import React from 'react';
import { MediaInfo, BatchStatus } from "../../types.js";
import ProgressBar from '../ui/ProgressBar.js';

interface Props {
    fileList: MediaInfo[];
    batchStatus: BatchStatus;
    startTime: number | null;
}

export default function StatusBar({ fileList = [], batchStatus = 'idle', startTime = null }: Props) {
    // モードによって計算ロジックを変える
    const processedBytes = fileList.reduce((acc, file) => {
        const s = file.size || 0;
        let effectiveProgress = 0;

        if (batchStatus === 'importing') {
            // インポート中
            // statusが 'waiting' になっている = コピー完了済み = このフェーズでは100%とみなす
            if (file.status === 'waiting' || file.status === 'done') {
                effectiveProgress = 100;
            } else if (file.status === 'uploading') {
                // 転送中は実際のprogressを使う
                effectiveProgress = file.progress || 0;
            }
            // まだ処理が回ってきていない 'uploading' (progress 0) は 0% のまま

        } else {
            // 変換中 または 通常時
            // statusが 'done' = 変換完了 = 100%
            if (file.status === 'done') {
                effectiveProgress = 100;
            } else if (file.status === 'processing') {
                effectiveProgress = file.progress || 0;
            }
            // 'waiting' はこれから変換するので 0% で正解
        }

        return acc + (s * (effectiveProgress / 100));
    }, 0);

    // テキスト表示用に現在の出力サイズ（エンコード済みサイズ）を計算
    const currentEncodedBytes = fileList.reduce((acc, file) => {
        if (batchStatus === 'importing') {
            // インポート時は入力=出力とみなす（コピーなので）
            if (file.status === 'waiting' || file.status === 'done') return acc + file.size;
            if (file.status === 'uploading') return acc + (file.size * ((file.progress || 0) / 100));
        } else {
            // エンコード時は、ffmpegから受け取った encodedSize を足す
            if (file.status === 'done' || file.status === 'processing') {
                return acc + (file.encodedSize || 0);
            }
        }
        return acc;
    }, 0);

    // グローバル進捗率の計算
    const totalFiles = fileList.length;
    // 合計サイズ (byte)
    const totalOriginalBytes = fileList.reduce((acc, file) => acc + (file.size || 0), 0);
    // グローバル進捗率 (0-100)
    const globalProgress = totalOriginalBytes > 0 ? (processedBytes / totalOriginalBytes) * 100 : 0;
    // 経過時間 (秒)
    const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;

    // 転送速度 (Bytes/sec) - 単純平均
    const speedBps = elapsedSeconds > 0 ? processedBytes / elapsedSeconds : 0;

    // 残り時間 (秒)
    const remainingBytes = totalOriginalBytes - processedBytes;
    const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

    // 終了予想時刻 (Clock Time) の計算
    let finishTimeStr = "";
    if (batchStatus !== 'idle' && etaSeconds > 0 && isFinite(etaSeconds)) {
        const finishDate = new Date(Date.now() + etaSeconds * 1000);
        // "14:30" のような形式にする
        finishTimeStr = finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

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

    let statusText = "Ready 👺";
    let speedText = "----- --/----- -- (----- --/s)";

    if (batchStatus === 'importing') {
        // Windows用コピー処理中
        // waiting になったものを完了とみなしてカウント
        const importedCount = fileList.filter(f => f.status === 'waiting').length;
        // 現在転送中のファイルがあるか
        const isUploading = fileList.some(f => f.status === 'uploading' && (f.progress || 0) > 0);

        statusText = `📥 Importing... (${importedCount}/${totalFiles})`;
        // コピー中は転送速度として正確な意味を持つ: 現在量 / 総量 (速度)
        speedText = `${formatBytes(processedBytes)} / ${formatBytes(totalOriginalBytes)} (${formatBytes(speedBps)}/s)`;
    } else if (batchStatus === 'converting') {
        // 変換処理中
        const doneCount = fileList.filter(f => f.status === 'done').length;
        statusText = `🦔 Processing... (${doneCount}/${fileList.length})`;

        // エンコード中は 現在の出力サイズ / 予測合計サイズ (削減率) を表示
        // 圧縮率を計算 (出力 / 入力)
        const compressionRatio = processedBytes > 0 ? currentEncodedBytes / processedBytes : 1;
        // 予測合計サイズ = 全入力サイズ * 圧縮率
        const predictedTotalBytes = totalOriginalBytes * compressionRatio;
        // 削減率 (%)
        const reductionRate = (1 - compressionRatio) * 100;
        const sign = reductionRate >= 0 ? "▼" : "▲";

        speedText = `${formatBytes(currentEncodedBytes)} / ${formatBytes(predictedTotalBytes)} (${sign}${Math.abs(reductionRate).toFixed(0)}%)`;
    } else if (fileList.length > 0 && fileList.every(f => f.status === 'done')) {
        // 全完了
        statusText = "👺 All Done ✨";
        // 完了時は最終的な削減率を表示
        const totalReduced = totalOriginalBytes > 0 ? ((totalOriginalBytes - currentEncodedBytes) / totalOriginalBytes) * 100 : 0;
        speedText = `Final: ${formatBytes(currentEncodedBytes)} (▼${totalReduced.toFixed(1)}%)`;
    } else {
        // 初期状態 / 一時停止 / エラー等
        statusText = fileList.length > 0 ? "🐥 Ready to go ☕" : "Ready 👺";
    }

    return (
        <div className="status-bar flex">
            {/* ステータス */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">{statusText}</div>

            {/* データ量と速度 */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">{speedText}</div>

            {/* プログレスバー */}
            <ProgressBar value={globalProgress} className="status-bar-field grow flex-1 h-full w-full" />

            {/* 残り時間 */}
            <div className="status-bar-field !grow-0 px-2 flex items-center">
                {/* idle 以外なら時間を表示 */}
                {batchStatus !== 'idle' ? (
                    <>
                        {/* 経過 / 予想総時間 (-残り時間) */}
                        <span>
                            {formatTime(elapsedSeconds)} / {formatTime(elapsedSeconds + etaSeconds)}
                            <span className="text-gray-700"> (-{formatTime(etaSeconds)})</span>
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