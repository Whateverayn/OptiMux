import React, { useCallback, useState } from 'react';
import logo from './assets/images/logo-universal.png';
import './App.css';
import { AnalyzeMedia } from "../wailsjs/go/main/App.js";
import { EventsOn } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート

// Go側のMediaInfo構造体をTypeScriptで再現 (Goのstructタグに合わせてキャメルケースに変換)
interface MediaInfoTS {
    path: string;
    hasVideo: boolean;
    hasAudio: boolean;
}

function App() {
    const [fileList, setFileList] = useState<MediaInfoTS[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // D&Dイベントのリスナーを一度だけ設定する
    useCallback(() => {
        // WailsのネイティブD&Dイベントを購読
        EventsOn('wails:drag:start', () => setIsDragging(true));
        EventsOn('wails:drag:end', () => setIsDragging(false));
    }, []);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }

    // ファイルドロップ時の処理
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const paths: string[] = [];
        // イベントからファイルパスを取得

        if (e.dataTransfer.files) {
            const newFiles: MediaInfoTS[] = [];
            const files: File[] = Array.from(e.dataTransfer.files);
            const paths: string[] = files.map(file => (file as any).path);


            for (const path of paths) {
                try {
                    // Go側のAnalyzeMediaを呼び出す
                    const result = await AnalyzeMedia(path);
                    const info: MediaInfoTS = { // TSの型にマッピング
                        path: result.Path,
                        hasVideo: result.HasVideo,
                        hasAudio: result.HasAudio
                    };
                    newFiles.push(info);
                } catch (error) {
                    console.error(`Error analyzing ${path}:`, error);
                    alert(`Error analyzing ${path}: ${error}`);
                }
            }
            setFileList(prev => [...prev, ...newFiles]);
        }
    };

    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4'>
            <h1 className='text-3xl font-bold mb-8 text-gray-800'>OptiMux</h1>

            {/* D&Dゾーン */}
            <div
                className={`w-full max-w-2xl border-4 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging
                    ? 'border-indigo-500 bg-indigo-50 text-indifgo-700'
                    : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragging(false)}
            >
                {isDragging ? (
                    <p className='text-xl font-semibold'>ファイルをドロップしてください</p>
                ) : (
                    <p className='text-xl'>準備完了</p>
                )}
            </div>

            {/* 結果リスト */}
            {fileList.length > 0 && (
                <div className='mt-8 w-full max-w-2xl bg-white shadow-lg rounded-xl p-6'>
                    <h2 className='text-xl font-semibold mb-4 border-b pb-2 text-gray-700'>
                        解析結果 ({fileList.length}件)
                    </h2>
                    <ul className='space-y-3'>
                        {fileList.map((file, index) => (
                            <li key={index} className='flex justify-between items-center p-3 bg-gray-50 rounded-lg border'>
                                <span className='truncate flex-1 text-sm font-medium text-gray-800'>
                                    {file.path.split('/').pop()}
                                </span>
                                <div className='ml-4 flex space-x-4 text-sm'>
                                    <span className={`px-2 py-0.5 rounded-full ${file.hasVideo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {file.hasVideo ? '👺 映像あり' : '🦔 映像なし'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full ${file.hasAudio ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {file.hasAudio ? '🎭 音声あり' : '🐒 音声なし'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default App
