import React, { useEffect, useRef } from 'react';
import { MediaInfo, BatchStatus } from "../../types.js";
import ProgressBar from '../ui/ProgressBar.js';
import FluentDashboard, { DashboardStats } from "./FluentDashboard.js";

interface Props {
    files: MediaInfo[];
    log: string[];          // 親からログを受け取る
    batchStatus: BatchStatus;  // 処理中かどうか
    onBack: () => void;     // 戻る ボタン
}

const getFileName = (path: string) => path.split(/[/\\]/).pop() || path;

// フォーマット関数群
const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toPrecision(4)} ${sizes[i]}`;
};

const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) return "--:--";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function ProcessingView({ files, log, batchStatus, onBack }: Props) {
    const logEndRef = useRef<HTMLDivElement>(null);
    const processingItemRef = useRef<HTMLDivElement>(null);

    // ログが更新されたら自動スクロール
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [log]);

    // 処理中のアイテムへ自動スクロール
    const processingFileId = files.find(f => f.status === 'processing')?.id;
    useEffect(() => {
        if (processingItemRef.current) {
            processingItemRef.current.scrollIntoView({ behavior: "auto", block: "center" });
        }
    }, [processingFileId]);

    let targetFile: MediaInfo | null = null;
    let targetStats: DashboardStats | null = null;
    // 終了予想時刻文字列
    let targetFinishStr = "--:--";

    // 現在処理中のファイルを探す
    const processingFile = files.find(f => f.status === 'processing');

    // 全て完了しているか判定
    const isAllDone = files.length > 0 && files.every(f => f.status === 'done');

    if (processingFile) {
        // 処理中

        targetFile = processingFile;

        // 予測計算ロジック
        const stats: DashboardStats = {
            encodedSize: processingFile.encodedSize || 0,
            predictedSize: 0,
            reductionRate: 0,
            elapsed: 0,
            eta: 0,
            speed: 0,
        };

        if (processingFile.startedAt && processingFile.progress && processingFile.progress > 0) {
            // 経過時間 (秒)
            stats.elapsed = (Date.now() - processingFile.startedAt) / 1000;

            // 予測完了サイズ = 現在サイズ / (進捗率 / 100)
            // ※ 進捗が極端に小さい(1%未満)ときは精度が悪いので計算しない等のガードを入れても良い
            if (processingFile.progress > 1) {
                stats.predictedSize = stats.encodedSize / (processingFile.progress / 100);

                // 削減率予測 = (元サイズ - 予測サイズ) / 元サイズ
                stats.reductionRate = ((processingFile.size - stats.predictedSize) / processingFile.size) * 100;
            }

            // 変換スピード (実時間に対する倍速) = 処理した動画時間 / かかった実時間
            // 処理した動画時間 = 総時間 * 進捗率
            const processedDuration = processingFile.duration * (processingFile.progress / 100);
            stats.speed = stats.elapsed > 0 ? processedDuration / stats.elapsed : 0;

            // 残り時間 = (100 - 進捗) / (進捗 / 経過時間)
            // 単純比例計算
            const remainingPercent = 100 - processingFile.progress;
            const timePerPercent = stats.elapsed / processingFile.progress;
            stats.eta = remainingPercent * timePerPercent;

            if (stats.eta > 0 && isFinite(stats.eta)) {
                targetFinishStr = new Date(Date.now() + stats.eta * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
        }
        targetStats = stats;
    } else if (isAllDone) {
        // 全完了

        // 合計値を計算
        const totalOriginal = files.reduce((acc, f) => acc + f.size, 0);
        const totalEncoded = files.reduce((acc, f) => acc + (f.encodedSize || 0), 0);
        const totalDuration = files.reduce((acc, f) => acc + f.duration, 0); // 動画の総尺

        // 実処理時間の合計 (各ファイルの処理時間の和)
        const totalElapsed = files.reduce((acc, f) => {
            if (f.startedAt && f.completedAt) return acc + (f.completedAt - f.startedAt);
            return acc;
        }, 0) / 1000;

        // ダミーのMediaInfoを作成して完了画面を表現
        targetFile = {
            id: 'summary',
            path: '👺 All Tasks Completed 👹', // これがタイトルになる
            size: totalOriginal,
            hasVideo: true,
            hasAudio: true,
            duration: totalDuration,
            status: 'done',
            progress: 100, // バーは満タン
            encodedSize: totalEncoded
        };

        targetStats = {
            encodedSize: totalEncoded,
            predictedSize: totalEncoded, // 完了してるので予測=実績
            reductionRate: ((totalOriginal - totalEncoded) / totalOriginal) * 100,
            elapsed: totalElapsed,
            eta: 0,
            speed: totalElapsed > 0 ? totalDuration / totalElapsed : 0 // 平均倍速
        };

        targetFinishStr = "Finished";
    }

    return (
        <div className="flex flex-col h-full gap-2">

            {/* ダッシュボード (処理中 または 全完了時に表示) */}
            {targetFile && targetStats && (
                <FluentDashboard
                    currentFile={targetFile}
                    stats={targetStats}
                    batchStatus={batchStatus}
                    finishTimeStr={targetFinishStr}
                    formatBytes={formatBytes}
                    formatTime={formatTime}
                    getFileName={getFileName}
                />
            )}

            {/* 進捗リスト */}
            <div className="flex-1 field-border overflow-y-auto p-2">
                <div className="flex flex-col">
                    {files.map((file, i) => {
                        const isProcessing = file.status === 'processing';
                        const isDone = file.status === 'done';
                        const isError = file.status === 'error';

                        return (
                            <div
                                key={i}
                                ref={isProcessing ? processingItemRef : null}
                                className={`
                                    flex flex-col gap-1 px-2 py-1 status-field-border
                                    ${isProcessing ? '!bg-[#000080] text-white' : 'text-black'}
                                `}
                            >
                                {/* 上段: ファイル名とステータス */}
                                <div className="flex justify-between text-xs items-center">
                                    <span className="truncate font-bold flex items-center gap-1">
                                        {isProcessing && <span className="animate-pulse">🦔</span>}
                                        {isDone && <span>👺</span>}
                                        {isError && <span>💥</span>}

                                        {getFileName(file.path)}
                                    </span>
                                    <span>
                                        {/* ステータス表示 */}
                                        {isProcessing ? 'Processing...' :
                                            isDone ? 'Done' :
                                                isError ? 'Error' : 'Queued'}
                                    </span>
                                </div>

                                {/* プログレスバー (完了したら結果) */}
                                {isDone ? (
                                    <div className="pl-4 pr-4 flex flex-wrap gap-x-4 gap-y-0 text-gray-600 text-xs">
                                        {/* 結果情報 */}
                                        <div className="">
                                            {/* 時間と速度 */}
                                            TIME: {file.startedAt && file.completedAt ? formatTime((file.completedAt - file.startedAt) / 1000) : '--:--'}
                                            {file.startedAt && file.completedAt && (
                                                <span className="ml-1 opacity-70">
                                                    (x{((file.duration * 1000) / (file.completedAt - file.startedAt)).toFixed(1)})
                                                </span>
                                            )}
                                        </div>

                                        {/* サイズ変化 */}
                                        <div className="flex gap-1">
                                            <span>SIZE: {formatBytes(file.size)}</span>
                                            <span className="text-gray-400">{'->'}</span>
                                            <span className="font-bold">{formatBytes(file.encodedSize || 0)}</span>
                                            {(() => {
                                                const reduction = ((file.size - (file.encodedSize || 0)) / file.size) * 100;
                                                return (
                                                    <span className="ml-1">
                                                        (▼{reduction.toFixed(0)}%)
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    // 完了以外（Processing / Waiting / Error）
                                    <div className="relative h-5 mt-0.5">
                                        <ProgressBar
                                            value={file.progress}
                                            className="h-full"
                                            // ステータスに応じて色を変える
                                            variant={file.status === 'error' ? 'error' : 'default'}
                                        />
                                        {/* 文字重ね */}
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white mix-blend-difference pointer-events-none">
                                            {Math.round(file.progress || 0)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ログウィンドウ (下部固定) */}
            <div className="field-border h-32 bg-black text-green-400 p-2 font-mono text-xs overflow-y-auto select-text" style={{ backgroundColor: 'black' }}>
                {log.length === 0 && <div>hoge@computer % </div>}
                {log.length === 0 && <div>[INFO] Target: {files.length} files loaded.</div>}
                {log.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap">{line}</div>
                ))}
                <div ref={logEndRef} className="animate-pulse">_</div>
            </div>

            <button className="oki-btn self-end" onClick={onBack}>
                {isAllDone ? "Back to Setup" : "Cancel (Debug)"}
            </button>
        </div>
    );
}