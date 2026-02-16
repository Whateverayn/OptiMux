import React from 'react';
import { MediaInfo } from "../../types.js";

export interface DeleteTarget {
    file: MediaInfo;
    token: string; // Windows一時ファイル以外なら空文字
}

interface Props {
    targets: DeleteTarget[];
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val.toPrecision(4)} ${sizes[i]}`;
};

export default function DeleteConfirmDialog({ targets, isOpen, onConfirm, onCancel }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <div className="window" style={{ width: '500px', maxWidth: '95vw', display: 'flex', flexDirection: 'column' }}>
                <div className="title-bar">
                    <div className="title-bar-text">😵 Confirm Delete</div>
                    <div className="title-bar-controls">
                        <button aria-label="Close" onClick={onCancel}></button>
                    </div>
                </div>
                <div className="window-body flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">🗑️</div>
                        <div className="flex-1">
                            <p className="font-bold mb-2">
                                Send these {targets.length} items to the Recycle Bin?
                            </p>
                            <p className="font-bold mb-2 text-red-700">
                                Caution: These {targets.length} files will be moved to the Recycle Bin.
                            </p>
                            <div className="sunken-panel bg-white h-32 overflow-y-auto">
                                <table className="interactive w-full">
                                    <thead>
                                        <tr><th>Name</th><th className="w-20">Size</th><th className="w-16">Type</th></tr>
                                    </thead>
                                    <tbody>
                                        {targets.map((t, i) => (
                                            <tr key={i}>
                                                <td className="truncate max-w-[200px]">{t.file.path.split(/[/\\]/).pop()}</td>
                                                <td className="text-right">{formatBytes(t.file.size)}</td>
                                                <td className="text-center">{t.file.isTemp ? 'Temp' : 'Src'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={onConfirm} className="font-bold px-4">Yes</button>
                        <button onClick={onCancel} className="px-4">No</button>
                    </div>
                </div>
            </div>
        </div>
    );
}