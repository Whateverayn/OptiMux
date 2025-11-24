import React from 'react';
import { MediaInfo } from "../../types.js";

interface Props {
    files: MediaInfo[];
    onBack: () => void; // 戻る ボタン
}

export default function ProcessingView({ files, onBack }: Props) {
    return (
        <div className="flex flex-col h-full gap-2 p-2">

            {/* 進捗リスト */}
            <div className="flex-1 oki-inset bg-white overflow-y-auto p-2">
                <div className="flex flex-col gap-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                                <span className="truncate">{file.path.split('/').pop()}</span>
                                <span>{i === 0 ? "Processing..." : "Queued"}</span>
                            </div>
                            {/* プログレスバー */}
                            <div className="h-4 border border-gray-500 relative bg-gray-100">
                                <div
                                    className="absolute top-0 left-0 h-full bg-blue-700"
                                    style={{ width: i === 0 ? '45%' : '0%' }}
                                ></div>
                                {/* バーの中央に文字を置く */}
                                <div className="absolute w-full text-center text-[10px] leading-4 text-white mix-blend-difference">
                                    {i === 0 ? '45%' : '0%'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ログウィンドウ (下部固定) */}
            <div className="h-32 oki-inset bg-black text-green-400 p-2 font-mono text-xs overflow-y-auto">
                <div>hoge@computer % </div>
                <div>[INFO] Initializing encoder core...</div>
                <div>[INFO] Target: {files.length} files loaded.</div>
                <div className="animate-pulse">_</div>
            </div>

            <button className="oki-btn self-end" onClick={onBack}>
                Cancel (Debug)
            </button>
        </div>
    );
}