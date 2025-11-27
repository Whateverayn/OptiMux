import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AnalyzeMedia, ConvertVideo, UploadChunk } from "../wailsjs/go/main/App.js";
import { EventsOn, EventsOff, OnFileDrop } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート
import { MediaInfo } from "./types.js";

// Components
import TitleBar from './components/layout/TitleBar.js';
import StatusBar from './components/layout/StatusBar.js';
import SetupView from './components/views/SetupView.js';
import ProcessingView from './components/views/ProcessingView.js';
import SplashScreen from './components/views/SplashScreen.js';

// 画面の状態
type AppView = 'setup' | 'processing';

function App() {
    // データ
    const [fileList, setFileList] = useState<MediaInfo[]>([]);

    // 設定
    const [codec, setCodec] = useState("hevc");
    const [audio, setAudio] = useState("copy");

    // 画面状態
    const [currentView, setCurrentView] = useState<AppView>('setup');

    const [processing, setProcessing] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    // 現在処理中のファイルのインデックスを追跡するRef
    const currentFileIndexRef = useRef<number | null>(null);

    // ログの自動スクロール用
    const logEndRef = useRef<HTMLDivElement>(null);

    // 時間文字列 (HH:MM:SS.ms) を 秒(number) に変換
    const parseTimeToSeconds = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length < 3) return 0;
        const h = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        const s = parseFloat(parts[2]);
        return (h * 3600) + (m * 60) + s;
    };

    // BlobをBase64に変換
    const readFileAsBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // ファイルを分割してGoにアップロード
    const uploadFileInChunks = async (file: File): Promise<string> => {
        const CHUNK_SIZE = 1024 * 1024 * 32; // 32MB
        let offset = 0;
        let filePath = "";

        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const base64Data = await readFileAsBase64(slice);

            filePath = await UploadChunk(file.name, base64Data, offset);

            offset += CHUNK_SIZE;
            console.log(`Uploading: ${Math.round((offset / file.size) * 100)}%`);
        }
        return filePath;
    };

    // useEffectでWailsのイベントリスナーを登録
    useEffect(() => {
        // Goからの準備完了合図を待つ
        const onReady = () => {
            setShowSplash(false);
        };
        EventsOn("app:ready", onReady);

        // Wailsからのファイルドロップイベントを受け取るリスナー
        const onFileDrop = async (x: number, y: number, files: string[]) => {
            console.log("👺 Wails Drop Event Fired", files);
            // 処理中は受け付けない
            if (currentView !== 'setup') return;

            console.log(x, y, files);
            setIsDragging(false);

            // ループ処理
            if (files && files.length > 0) {
                // files は純粋な string[] なので, そのままループできる
                const newFiles: MediaInfo[] = [];

                for (const path of files) {
                    try {
                        // Goの関数を呼ぶ
                        const result = await AnalyzeMedia(path);
                        newFiles.push(result);
                    } catch (error) {
                        console.error(`Error analyzing ${path}:`, error);
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
            // ログ表示用
            setLog(prev => [...prev.slice(-100), msg]);

            // 現在処理中のファイルがない場合は無視
            if (currentFileIndexRef.current === null) return;
            const idx = currentFileIndexRef.current;

            // 正規表現で time=XX:XX:XX.XX を探す
            const timeMatch = msg.match(/time=\s*(\d{2}:\d{2}:\d{2}\.\d{2})/);

            if (timeMatch) {
                const currentTimeStr = timeMatch[1];
                const currentSeconds = parseTimeToSeconds(currentTimeStr);

                setFileList(prevList => {
                    const newList = [...prevList];
                    const targetFile = newList[idx];

                    if (targetFile && targetFile.duration > 0) {
                        // 進捗率計算
                        const percent = Math.min(100, (currentSeconds / targetFile.duration) * 100);

                        // 状態更新
                        newList[idx] = { ...targetFile, progress: percent };
                    }
                    return newList;
                });
            }
        };

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
            EventsOff("app:ready");
        };
    }, [currentView]); // currentViewが変わるたびに判定

    // ログ更新時に下までスクロール
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [log]);

    // HTML5標準のドロップハンドラ (Windows用)
    const handleHtmlDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (currentView !== 'setup') return;
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const newFiles: MediaInfo[] = [];

            for (const file of droppedFiles) {
                try {
                    // まずパスがあるか確認
                    let filePath = (file as any).path;

                    // パスがない場合 (Windowsなど) は分割アップロードを実行
                    if (!filePath) {
                        console.log(`🦔 Streaming ${file.name} to temp storage...`);
                        filePath = await uploadFileInChunks(file);
                        console.log("👺 Saved to:", filePath);
                    }

                    // 取得したパス(元のパス or 保存先パス)で解析
                    if (filePath) {
                        const result = await AnalyzeMedia(filePath);
                        newFiles.push(result);
                    }
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                }
            }
            if (newFiles.length > 0) {
                setFileList(prev => [...prev, ...newFiles]);
            }
        }
    };

    // 変換実行ボタンの処理
    const startConversion = async () => {
        if (fileList.length === 0) {
            return;
        }
        setCurrentView('processing');
        setProcessing(true);
        setLog(["Starting process..."]);

        for (let i = 0; i < fileList.length; i++) {
            // 処理開始前にRefを更新
            currentFileIndexRef.current = i;
            // ステータスをProcessingに変更
            setFileList(prev => {
                const newList = [...prev];
                newList[i] = { ...newList[i], status: 'processing', progress: 0 };
                return newList;
            });

            try {
                setLog(prev => [...prev, `[INFO] Converting: ${fileList[i].path}...`]);

                await ConvertVideo(fileList[i].path, {
                    codec: codec,
                    audio: audio,
                    extension: "mp4"
                });

                // 完了したらDoneにする
                setFileList(prev => {
                    const newList = [...prev];
                    newList[i] = { ...newList[i], status: 'done', progress: 100 };
                    return newList;
                });
                setLog(prev => [...prev, `>> [SUCCESS] Finished: ${fileList[i].path}`]);
            } catch (error) {
                setFileList(prev => {
                    const newList = [...prev];
                    newList[i] = { ...newList[i], status: 'error' };
                    return newList;
                });
                setLog(prev => [...prev, `>> [ERROR] Failed: ${fileList[i].path} - ${error}`]);
            }
        }

        // 全処理終了
        currentFileIndexRef.current = null;
        setProcessing(false);
        setLog(prev => [...prev, "👺 All tasks completed 👹"])
    };

    // 処理開始
    const handleStart = () => {
        setCurrentView('processing');
        // 後で実装
    };

    return (
        <div
            className='window w-full h-full flex flex-col'
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleHtmlDrop}
        >
            {/* スプラッシュスクリーンの条件付きレンダリング */}
            {showSplash && <SplashScreen />}

            {/* Header */}
            <TitleBar />

            {/* Main Content Area (Swap Views) */}
            <div className='window-body flex flex-col flex-1 gap-2 overflow-hidden'>
                {/* コンテンツ切り替えエリア */}
                <div className="flex-1 p-1 overflow-hidden">
                    {currentView === 'setup' ? (
                        <SetupView
                            files={fileList}
                            codec={codec}
                            setCodec={setCodec}
                            audio={audio}
                            setAudio={setAudio}
                            onStart={startConversion}
                        />
                    ) : (
                        <ProcessingView
                            files={fileList}
                            log={log}                               // ログを渡す
                            isProcessing={processing}               // 状態を渡す
                            onBack={() => setCurrentView('setup')}
                        />
                    )}
                </div>

                {/* Footer */}
                <StatusBar
                    fileList={fileList}
                    isProcessing={processing} />
            </div>
        </div>
    )
}

export default App
