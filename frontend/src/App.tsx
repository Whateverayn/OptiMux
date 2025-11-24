import React, { useCallback, useState, useEffect } from 'react';
import './App.css';
import { AnalyzeMedia, ConvertVideo } from "../wailsjs/go/main/App.js";
import { EventsOn, EventsOff, OnFileDrop } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート

// Go側のMediaInfo構造体をTypeScriptで再現 (Goのstructタグに合わせてキャメルケースに変換)
interface MediaInfo {
    path: string;
    hasVideo: boolean;
    hasAudio: boolean;
}

function App() {
    const [fileList, setFileList] = useState<MediaInfo[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [codec, setCodec] = useState("hevc");
    const [audio, setAudio] = useState("copy");
    const [processing, setProcessing] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    // useEffectでWailsのイベントリスナーを登録
    useEffect(() => {
        // Wailsからのファイルドロップイベントを受け取るリスナー
        const onFileDrop = async (x: number, y: number, files: string[]) => {
            console.log(x, y, files);
            setIsDragging(false);

            // files は純粋な string[] なので, そのままループできる
            const newFiles: MediaInfo[] = [];

            // ループ処理
            if (files && files.length > 0) {
                for (const path of files) {
                    try {
                        // Goの関数を呼ぶ
                        const result = await AnalyzeMedia(path);
                        newFiles.push(result);
                    } catch (error) {
                        console.error(`Error analyzing ${path}:`, error);
                        alert(`Error analyzing ${path}: ${error}`);
                    }
                }
                setFileList(prev => [...prev, ...newFiles]);
            } else {
                console.log("ELSE");
            }
        };

        // ドラッグ中の演出用イベント
        const onDragEnter = () => setIsDragging(true);
        const onDragLeave = () => setIsDragging(false);

        // 進捗ログの受信
        const onLog = (msg: string) => {
            setLog(prev => [...prev.slice(-4), msg]);
        }

        // イベント登録
        EventsOn('wails:file-drop', onFileDrop);
        EventsOn('wails:drag:enter', onDragEnter);
        EventsOn('wails:drag:leave', onDragLeave);

        EventsOn("conversion:log", onLog);

        // クリーンアップ (コンポーネント削除時にリスナー解除)
        return () => {
            EventsOff('wails:file-drop');
            EventsOff('wails:drag:enter');
            EventsOff('wails:drag:leave');
            EventsOff("conversion:log");
        };
    }, []); // 初回のみ実行

    // 変換実行ボタンの処理
    const startConversion = async () => {
        if (fileList.length === 0) {
            return;
        }
        setProcessing(true);
        setLog(["処理開始..."]);

        for (const file of fileList) {
            try {
                setLog(prev => [...prev, `変換中: ${file.path}...`]);

                await ConvertVideo(file.path, {
                    codec: codec,
                    audio: audio,
                    extension: "mp4"
                });

                setLog(prev => [...prev, `変換完了: ${file.path}`]);
            } catch (error) {
                setLog(prev => [...prev, `変換エラー: ${file.path} - ${error}`]);
            }
        }
        setProcessing(false);
        setLog(prev => [...prev, "処理完了👹"])
    };

    // D&Dイベントのリスナーを一度だけ設定する
    // useCallback(() => {
    //     // WailsのネイティブD&Dイベントを購読
    //     EventsOn('wails:drag:start', () => setIsDragging(true));
    //     EventsOn('wails:drag:end', () => setIsDragging(false));
    // }, []);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }

    // ファイルドロップ時の処理
    // HTMLのonDropは preventDefault だけして何もしない
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        // const paths: string[] = [];
        // // イベントからファイルパスを取得

        // if (e.dataTransfer.files) {
        //     const newFiles: MediaInfoTS[] = [];
        //     const files: File[] = Array.from(e.dataTransfer.files);
        //     const paths: string[] = files.map(file => (file as any).path);


        //     for (const path of paths) {
        //         try {
        //             // Go側のAnalyzeMediaを呼び出す
        //             console.log(`Analyzing ${path}`);
        //             if (!path) {
        //                 alert(`Invalid path: ${path}`)
        //             }
        //             const result = await AnalyzeMedia(path);
        //             const info: MediaInfoTS = { // TSの型にマッピング
        //                 path: result.Path,
        //                 hasVideo: result.HasVideo,
        //                 hasAudio: result.HasAudio
        //             };
        //             newFiles.push(info);
        //         } catch (error) {
        //             console.error(`Error analyzing ${path}:`, error);
        //             alert(`Error analyzing ${path}: ${error}`);
        //         }
        //     }
        //     setFileList(prev => [...prev, ...newFiles]);
        // }
    };

    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4'>
            <h1 className='text-3xl font-bold mb-8 text-gray-800'>🌋 Opti 🌀 Mux 🌋</h1>

            {/* D&Dゾーン */}
            <div
                className={`w-full max-w-2xl border-4 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                    }`}
            >
                {isDragging ? (
                    <p className='text-xl font-semibold'>📁 ファイル 🌈 を 🍬 ドロップ 🫳</p>
                ) : (
                    <p className='text-xl'>👺 準備 🤩 完了 👹</p>
                )}
            </div>

            {/* 設定エリア */}
            <div className='w-full max-w-2xl bg-white p-4 rounded-xl shadow mb-4 flex gap-4 items-center'>
                <div className='flex flex-col'>
                    <label className='text-xs text-gray-500 font-bold' htmlFor='CODEC'>🐀 VIDEO 🦗</label>
                    <select className='border rounded p-1 bg-gray-50' value={codec} onChange={(e) => setCodec(e.target.value)} name="CODEC" id="CODEC">
                        <option value="hevc">🚗 HEVC (x265)</option>
                        <option value="av1">🦉 AV1 (SVT-AV1)</option>
                    </select>
                </div>
                <div className='flex flex-col'>
                    <label className='text-xs text-gray-500 font-bold' htmlFor="AUDIO">🔈 AUDIO 🔊</label>
                    <select className='border rounded p-1 bg-gray-50' value={audio} onChange={(e) => setAudio(e.target.value)} name="AUDIO" id="AUDIO">
                        <option value="copy">🚚 コピー</option>
                        <option value="none">🗑️ 削除</option>
                    </select>
                </div>
                <button className={`ml-auto px-6 py-2 rounded-full font-bold text-white transition-all ${processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200'
                    }`}
                    onClick={startConversion}
                    disabled={processing}>
                    {processing ? "🏭 変換中... 🐥" : "実行する 📣"}
                </button>
            </div>



            {/* 進捗ログ表示エリア (一番下に追加) */}
            {log.length > 0 && (
                <div className="w-full max-w-2xl mt-4 bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-hidden">
                    {log.map((line, i) => <div key={i} className="truncate">{line}</div>)}
                </div>
            )}

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
