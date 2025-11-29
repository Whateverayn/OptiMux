import React, { useEffect, useRef } from 'react';
import { MediaInfo, BatchStatus } from "../../types.js";
import ProgressBar from '../ui/ProgressBar.js';

interface Props {
    files: MediaInfo[];
    log: string[];          // 親からログを受け取る
    batchStatus: BatchStatus;  // 処理中かどうか
    onBack: () => void;     // 戻る ボタン
}

const getFileName = (path: string) => path.split(/[/\\]/).pop() || path;

const reactorStyle = {
    card: "relative overflow-hidden bg-slate-900 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-cyan-50 font-mono rounded-none",
    // スキャンライン演出（背景にうっすら走査線を入れる）
    scanline: "absolute inset-0 pointer-events-none bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAADCAYAAABS3WWCAAAAE0lEQVQIW2nk5+d/zhCREXiOAQ4A9gUChp3FAI4AAAAASUVORK5CYII=')] opacity-10",
    label: "text-[10px] uppercase tracking-widest text-cyan-400/70 mb-0.5",
    value: "text-lg font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]",
    barBg: "h-1.5 w-full bg-slate-800 relative overflow-hidden",
    barFill: "absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-300 ease-out"
};

export default function ProcessingView({ files, log, batchStatus, onBack }: Props) {
    const logEndRef = useRef<HTMLDivElement>(null);
    const processingItemRef = useRef<HTMLDivElement>(null);

    // ログが更新されたら自動スクロール
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    // 処理中のアイテムへ自動スクロール
    const processingFileId = files.find(f => f.status === 'processing')?.id;
    useEffect(() => {
        if (processingItemRef.current) {
            processingItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [processingFileId]);

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

    // 現在処理中のファイルを探す
    const currentFile = files.find(f => f.status === 'processing');

    // --- 予測計算ロジック ---
    let stats = {
        encodedSize: 0,
        predictedSize: 0,
        reductionRate: 0,
        elapsed: 0,
        eta: 0,
        speed: 0,
    };

    if (currentFile && currentFile.startedAt && currentFile.progress && currentFile.progress > 0) {
        // 経過時間 (秒)
        stats.elapsed = (Date.now() - currentFile.startedAt) / 1000;

        // 現在のエンコードサイズ
        stats.encodedSize = currentFile.encodedSize || 0;

        // 予測完了サイズ = 現在サイズ / (進捗率 / 100)
        // ※ 進捗が極端に小さい(1%未満)ときは精度が悪いので計算しない等のガードを入れても良い
        if (currentFile.progress > 1) {
            stats.predictedSize = stats.encodedSize / (currentFile.progress / 100);

            // 削減率予測 = (元サイズ - 予測サイズ) / 元サイズ
            stats.reductionRate = ((currentFile.size - stats.predictedSize) / currentFile.size) * 100;
        }

        // 変換スピード (実時間に対する倍速) = 処理した動画時間 / かかった実時間
        // 処理した動画時間 = 総時間 * 進捗率
        const processedDuration = currentFile.duration * (currentFile.progress / 100);
        stats.speed = stats.elapsed > 0 ? processedDuration / stats.elapsed : 0;

        // 残り時間 = (100 - 進捗) / (進捗 / 経過時間)
        // 単純比例計算
        const remainingPercent = 100 - currentFile.progress;
        const timePerPercent = stats.elapsed / currentFile.progress;
        stats.eta = remainingPercent * timePerPercent;
    }

    return (
        <div className="flex flex-col h-full gap-2">

            {/* ダッシュボード (処理中のファイルがある場合のみ表示) */}
            {currentFile && (
                <div className="bg-gray-800 text-white p-3 rounded-md shadow-md text-sm border border-gray-600">
                    <div className="mb-2 font-bold truncate border-b border-gray-600 pb-1 flex justify-between">
                        <span>🔨 {getFileName(currentFile.path)}</span>
                        <span>{Math.round(currentFile.progress || 0)}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {/* 左カラム: サイズ関連 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">Size:</span>
                            <span>{formatBytes(stats.encodedSize)} <span className="text-gray-500">/ {formatBytes(stats.predictedSize || 0)}</span></span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Reduction:</span>
                            <span className={`${stats.reductionRate > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.predictedSize > 0 ? `▼ ${stats.reductionRate.toFixed(1)}%` : '-- %'}
                            </span>
                        </div>

                        {/* 右カラム: 時間・速度関連 */}
                        <div className="flex justify-between">
                            <span className="text-gray-400">Time:</span>
                            <span>{formatTime(stats.elapsed)} <span className="text-gray-500">/ -{formatTime(stats.eta)}</span></span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Speed:</span>
                            <span className="font-mono text-yellow-300">x{stats.speed.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 進捗リスト */}
            <div className="flex-1 field-border overflow-y-auto p-2" style={{ padding: '8px' }}>
                <div className="flex flex-col gap-2">
                    {files.map((file, i) => {
                        const isProcessing = file.status === 'processing';

                        return (
                            <div
                                key={i}
                                ref={isProcessing ? processingItemRef : null}
                                className="flex flex-col gap-1"
                            >
                                <div className="flex justify-between text-xs">
                                    <span className="truncate">{getFileName(file.path)}</span>
                                    <span>
                                        {/* ステータス表示 */}
                                        {file.status === 'processing' ? 'Processing...' :
                                            file.status === 'done' ? 'Done' :
                                                file.status === 'error' ? 'Error' : 'Queued'}
                                    </span>
                                </div>
                                {/* プログレスバー (完了したら結果) */}
                                {file.status === 'done' ? (
                                    <div className="text-[10px] text-gray-600 flex justify-between items-center bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                        {/* 結果情報 */}
                                        <div className="flex gap-3">
                                            {/* 時間と速度 */}
                                            {file.startedAt && file.completedAt ? (
                                                <span>
                                                    ⏱️ {formatTime((file.completedAt - file.startedAt) / 1000)}
                                                    <span className="text-gray-400 ml-1">
                                                        (x{((file.duration * 1000) / (file.completedAt - file.startedAt)).toFixed(1)})
                                                    </span>
                                                </span>
                                            ) : (
                                                <span>⏱️ --:--</span>
                                            )}
                                        </div>

                                        {/* サイズ変化 */}
                                        <div className="flex gap-1 items-center font-mono">
                                            <span>{formatBytes(file.size)}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="font-bold">{formatBytes(file.encodedSize || 0)}</span>
                                            {(() => {
                                                const reduction = ((file.size - (file.encodedSize || 0)) / file.size) * 100;
                                                return (
                                                    <span className={`ml-1 ${reduction > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        (▼{reduction.toFixed(0)}%)
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    // 完了以外（Processing / Waiting / Error）
                                    <div className="relative h-5">
                                        <ProgressBar
                                            value={file.progress}
                                            className="h-full"
                                            // ステータスに応じて色を変える
                                            variant={file.status === 'error' ? 'error' : 'default'}
                                        />
                                        {/* 文字重ね */}
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white mix-blend-difference pointer-events-none">
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
                {/* <div ref={logEndRef} className="animate-pulse">_</div> */}
            </div>

            <button className="oki-btn self-end" onClick={onBack}>
                Cancel (Debug)
            </button>
        </div>
    );
}