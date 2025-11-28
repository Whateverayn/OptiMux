import React, { useEffect, useRef } from 'react';
import { MediaInfo } from "../../types.js";
import ProgressBar from '../ui/ProgressBar.js';

interface Props {
    files: MediaInfo[];
    log: string[];          // 親からログを受け取る
    isProcessing: boolean;  // 処理中かどうか
    onBack: () => void;     // 戻る ボタン
}

export default function ProcessingView({ files, log, isProcessing, onBack }: Props) {
    const logEndRef = useRef<HTMLDivElement>(null);

    // ログが更新されたら自動スクロール
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    return (
        <div className="flex flex-col h-full gap-2">

            {/* 進捗リスト */}
            <div className="flex-1 field-border overflow-y-auto p-2" style={{ padding: '8px' }}>
                <div className="flex flex-col gap-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                                <span className="truncate">{file.path.split('/').pop()}</span>
                                <span>
                                    {/* ステータス表示 */}
                                    {file.status === 'processing' ? 'Processing...' :
                                        file.status === 'done' ? 'Done' :
                                            file.status === 'error' ? 'Error' : 'Queued'}
                                </span>
                            </div>
                            {/* プログレスバー */}
                            <div className="relative h-5">
                                <ProgressBar
                                    value={file.progress}
                                    className="h-full"
                                    // ステータスに応じて色を変える
                                    variant={
                                        file.status === 'done' ? 'success' :
                                            file.status === 'error' ? 'error' : 'default'
                                    }
                                />
                                {/* 文字重ね */}
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white mix-blend-difference pointer-events-none">
                                    {Math.round(file.progress || 0)}%
                                </div>
                            </div>
                            {/* <div className="h-4 border border-gray-500 relative bg-gray-100">
                                <div
                                    className={`absolute top-0 left-0 h-full ${file.status === 'error' ? 'bg-red-600' : // エラーなら赤
                                        file.status === 'done' ? 'bg-green-600' : // 完了なら緑
                                            'bg-blue-700' // 通常は青
                                        }`}
                                    // 計算した進捗率を適用
                                    style={{ width: `${file.progress || 0}%`, transition: 'width 0.2s' }}
                                ></div>
                                <div className="absolute w-full text-center text-[10px] leading-4 text-white mix-blend-difference">
                                    {Math.round(file.progress || 0)}%
                                </div>
                            </div> */}
                        </div>
                    ))}
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
                Cancel (Debug)
            </button>
        </div>
    );
}