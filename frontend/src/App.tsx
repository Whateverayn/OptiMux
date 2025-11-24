import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AnalyzeMedia, ConvertVideo } from "../wailsjs/go/main/App.js";
import { EventsOn, EventsOff, OnFileDrop } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート
import { MediaInfo } from "./types.js";

// Components
import TitleBar from './components/layout/TitleBar.js';
import StatusBar from './components/layout/StatusBar.js';
import SetupView from './components/views/SetupView.js';
import ProcessingView from './components/views/ProcessingView.js';

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

    // ログの自動スクロール用
    const logEndRef = useRef<HTMLDivElement>(null);

    // useEffectでWailsのイベントリスナーを登録
    useEffect(() => {
        // Wailsからのファイルドロップイベントを受け取るリスナー
        const onFileDrop = async (x: number, y: number, files: string[]) => {
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
    }, [currentView]); // currentViewが変わるたびに判定

    // ログ更新時に下までスクロール
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, [log]);

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

                setLog(prev => [...prev, `>> 変換完了: ${file.path}`]);
            } catch (error) {
                setLog(prev => [...prev, `>> 変換エラー: ${file.path} - ${error}`]);
            }
        }
        setProcessing(false);
        setLog(prev => [...prev, "処理完了👹"])
    };

    // 処理開始
    const handleStart = () => {
        setCurrentView('processing');
        // 後で実装
    };

    return (
        <div className='window w-full h-full flex flex-col'>
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
                            onStart={handleStart}
                        />
                    ) : (
                        <ProcessingView
                            files={fileList}
                            onBack={() => setCurrentView('setup')}
                        />
                    )}
                </div>

                {/* Footer */}
                <StatusBar />
            </div>
        </div>
    )
}

export default App
