// SetupView.tsx

import React, { useState } from "react";
import { MediaInfo } from "../../types.js";
import DeleteConfirmDialog, { DeleteTarget } from '../ui/DeleteConfirmDialog.js';
import { RequestDelete, ConfirmDelete, CancelDelete } from "../../../wailsjs/go/main/App.js";
import ProgressBar from '../ui/ProgressBar.js';

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val.toPrecision(4)} ${sizes[i]}`;
};

interface Props {
    files: MediaInfo[];
    selectedIds: Set<string>; // 親から貰う
    onSelectionChange: (ids: Set<string>) => void; // 親に通知
    onDeleteReq: () => void; // 削除ボタン押下時
    codec: string;
    setCodec: (v: string) => void;
    audio: string;
    setAudio: (v: string) => void;
    onStart: () => void;
}

export default function SetupView({
    files,
    selectedIds,
    onSelectionChange,
    onDeleteReq,
    codec,
    setCodec,
    audio,
    setAudio,
    onStart
}: Props) {
    // 選択中の行番号を管理 (nullなら未選択)
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // 行クリック時のハンドラ
    const handleRowClick = (e: React.MouseEvent, id: string) => {
        const newSet = new Set(selectedIds);

        if (e.ctrlKey || e.metaKey) {
            // Ctrlキー または ⌘: 追加/削除 (トグル)
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
        } else {
            // 通常クリック: 単一選択
            newSet.clear();
            newSet.add(id);
        }
        onSelectionChange(newSet);
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* ファイルリスト (D&Dエリア兼用) */}
            <div className={`sunken-panel flex-1 bg-white overflow-auto p-0 ${files.length === 0 ? 'flex items-center justify-center' : ''}`}>
                {files.length === 0 ? (
                    <div className="text-center select-none pointer-events-none">
                        <p className="text-2xl mb-2">📁</p>
                        <p>🌀 DROP 👺 MEDIA 🤩 FILES 🥕 HERE 👹</p>
                        <p className="text-xs">(.MOV, .MP4)</p>
                    </div>
                ) : (
                    <table className="w-full interactive select-none">
                        <thead>
                            <tr>
                                <th className="text-center w-8">#</th>
                                <th className="">Filename</th>
                                <th className="text-center">Size</th>
                                <th className="text-center">Type</th>
                                <th className="text-center">Video</th>
                                <th className="text-center">Audio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file, i) => {
                                const isSelected = selectedIds.has(file.id);
                                return (
                                    <tr
                                        key={file.id}
                                        // 選択中なら highlighted クラスをつける
                                        className={isSelected ? "highlighted" : ""}
                                        onClick={(e) => handleRowClick(e, file.id)}
                                    >
                                        <td className="px-2 py-0.5 text-center">{i + 1}</td>

                                        {/* ファイル名表示 */}
                                        <td className="px-2 py-0.5 truncate max-w-[200px]">
                                            {file.path.split(/[/\\]/).pop()}
                                        </td>

                                        {/* アップロード中はプログレスバーを表示 */}
                                        {file.status === 'uploading' ? (
                                            <td colSpan={4} className="px-2 py-0.5 align-middle">
                                                {/* 文字を重ねるためのラッパー */}
                                                <div className="relative w-full h-5">
                                                    <ProgressBar value={file.progress} className="h-full" />

                                                    {/* 中央の文字 */}
                                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-black mix-blend-difference pointer-events-none">
                                                        Transfer {Math.round(file.progress || 0)}%
                                                    </div>
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                <td className="text-center px-2">
                                                    {formatBytes(file.size)}
                                                </td>

                                                <td className="text-center px-2">
                                                    {file.isTemp ? 'Temp' : 'Src'}
                                                </td>

                                                <td className="px-2 py-0.5 text-center">{file.hasVideo ? 'Yes' : '-'}</td>
                                                <td className="px-2 py-0.5 text-center">{file.hasAudio ? 'Yes' : '-'}</td>
                                            </>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 設定パネル */}
            <fieldset className="m-2">
                <legend>Compression Settings</legend>
                <div className="flex items-end gap-4">
                    <div className="field-row">
                        <label htmlFor="codec">Video Codec:</label>
                        <select id="codec" value={codec} onChange={(e) => setCodec(e.target.value)}>
                            <option value="hevc">🚗 HEVC (x265)</option>
                            <option value="av1">🦉 AV1 (SVT-AV1)</option>
                        </select>
                    </div>
                    <div className="field-row">
                        <label htmlFor="audio">Audio Track:</label>
                        <select id="audio" value={audio} onChange={(e) => setAudio(e.target.value)}>
                            <option value="copy">🚚 Stream Copy</option>
                            <option value="none">🗑️ Remove Audio</option>
                        </select>
                    </div>

                    <button
                        className="field-row"
                        onClick={onStart}
                        disabled={files.length === 0 || files.some(f => f.status === 'uploading')}
                    >
                        💥 Run 📣
                    </button>
                </div>
            </fieldset>
        </div>
    );
}