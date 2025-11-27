import React, { useState } from "react";
import { MediaInfo } from "../../types.js";

interface Props {
    files: MediaInfo[];
    codec: string;
    setCodec: (v: string) => void;
    audio: string;
    setAudio: (v: string) => void;
    onStart: () => void;
}

export default function SetupView({ files, codec, setCodec, audio, setAudio, onStart }: Props) {
    // 選択中の行番号を管理 (nullなら未選択)
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // 行クリック時のハンドラ
    const handleRowClick = (index: number) => {
        setSelectedIndex(index);
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
                    <table className="w-full interactive">
                        <thead>
                            <tr>
                                <th className="text-center w-8">#</th>
                                <th className="">Filename</th>
                                <th className="w-16 text-center">Video</th>
                                <th className="w-16 text-center">Audio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file, i) => (
                                <tr
                                    key={i}
                                    // 選択中なら highlighted クラスをつける
                                    className={selectedIndex === i ? "highlighted" : ""}
                                    onClick={() => handleRowClick(i)}
                                >
                                    <td className="px-2 py-0.5 text-center">{i + 1}</td>

                                    {/* ファイル名表示 */}
                                    <td className="px-2 py-0.5 truncate max-w-[200px]">
                                        {file.path.split('/').pop()}
                                    </td>

                                    {/* アップロード中はプログレスバーを表示 */}
                                    {file.status === 'uploading' ? (
                                        <td colSpan={2} className="px-2 py-0.5 align-middle">
                                            <div className="relative w-full h-4 border border-gray-600 bg-white">
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-yellow-600"
                                                    style={{ width: `${file.progress}%` }}
                                                ></div>
                                                <div className="absolute w-full text-center text-[10px] leading-4 text-black mix-blend-difference">
                                                    Transfer {Math.round(file.progress || 0)}%
                                                </div>
                                            </div>
                                        </td>
                                    ) : (
                                        <>
                                            <td className="px-2 py-0.5 text-center">{file.hasVideo ? 'Yes' : '-'}</td>
                                            <td className="px-2 py-0.5 text-center">{file.hasAudio ? 'Yes' : '-'}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
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