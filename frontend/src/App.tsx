import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AnalyzeMedia, ConvertVideo, UploadChunk, RequestDelete, ConfirmDelete, CancelDelete, GetOSName } from "../wailsjs/go/main/App.js";
import { EventsOn, EventsOff, OnFileDrop, Quit } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート
import { MediaInfo, BatchStatus } from "./types.js";

// Components
import TitleBar from './components/layout/TitleBar.js';
import StatusBar from './components/layout/StatusBar.js';
import FunctionKeyFooter from './components/layout/FunctionKeyFooter.js';
import DeleteConfirmDialog, { DeleteTarget } from './components/ui/DeleteConfirmDialog.js';
import SetupView from './components/views/SetupView.js';
import ProcessingView from './components/views/ProcessingView.js';
import SplashScreen from './components/views/SplashScreen.js';

// 画面の状態
type AppView = 'setup' | 'processing';

type ProgressEvent = {
    timeSec: number;
    size: number;
};

function App() {
    // --- State Definitions ---
    // データ
    const [fileList, setFileList] = useState<MediaInfo[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // Lift-up: 選択状態
    const [deleteTargets, setDeleteTargets] = useState<DeleteTarget[] | null>(null); // Lift-up: 削除モーダル状態

    const [startTime, setStartTime] = useState<number | null>(null);

    // 設定
    const [codec, setCodec] = useState("hevc");
    const [audio, setAudio] = useState("copy");

    // 画面状態
    const [currentView, setCurrentView] = useState<AppView>('setup');

    const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
    const [log, setLog] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    // 現在処理中のファイルのインデックスを追跡するRef
    const currentFileIdRef = useRef<string | null>(null);

    // ログの自動スクロール用
    const logEndRef = useRef<HTMLDivElement>(null);

    // --- Actions ---
    // ファイル追加 (重複チェック付き)
    const addFilesToList = async (
        newPaths: string[], 
        isTempFile: boolean = false,
        outputType: 'same' | 'videos' | 'temp' = 'same'
    ) => {
        const currentPaths = new Set(fileList.map(f => f.path));
        const uniquePaths = newPaths.filter(p => !currentPaths.has(p));

        if (uniquePaths.length === 0) return;

        const newItems: MediaInfo[] = uniquePaths.map(path => ({
            id: crypto.randomUUID(),
            path: path,
            size: 0,
            hasVideo: false,
            hasAudio: false,
            duration: 0,
            status: 'waiting',
            progress: 0,
            isTemp: isTempFile, // Tempフラグ
            outputType: outputType
        }));

        setFileList(prev => [...prev, ...newItems]);

        // 解析 (並列実行)
        for (const item of newItems) {
            // 非同期で解析を実行
            AnalyzeMedia(item.path)
                .then(result => {
                    // 成功したら結果をマージ
                    setFileList(prev => prev.map(f =>
                        f.id === item.id ? { ...f, ...result, status: 'waiting' } : f
                    ));
                })
                .catch(err => {
                    console.error(err);
                    // 失敗したらエラー状態に
                    setFileList(prev => prev.map(f =>
                        f.id === item.id ? { ...f, status: 'error' } : f
                    ));
                });
        }
    };

    // 削除フロー開始 (F8 or ボタン)
    const startBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        const filesToDelete = fileList.filter(f => selectedIds.has(f.id));

        // 分類
        const tempFiles = filesToDelete.filter(f => f.isTemp);
        const normalFiles = filesToDelete.filter(f => !f.isTemp);

        // 通常ファイル: 即座にリストから削除
        if (normalFiles.length > 0) {
            const normalIds = new Set(normalFiles.map(f => f.id));
            setFileList(prev => prev.filter(f => !normalIds.has(f.id)));

            // 選択解除 (Tempがなければ全解除, あればTemp以外を解除)
            setSelectedIds(prev => {
                const next = new Set(prev);
                normalIds.forEach(id => next.delete(id));
                return next;
            });
        }

        // 一時ファイル: 確認ダイアログへ
        if (tempFiles.length > 0) {
            const targets: DeleteTarget[] = [];
            try {
                for (const file of tempFiles) {
                    if (file.path) {
                        // Windows一時ファイルなら物理削除リクエスト
                        const token = await RequestDelete(file.path);
                        targets.push({ file, token });
                    }
                }
                setDeleteTargets(targets); // ダイアログ表示
            } catch (e) {
                console.error(e);
            }
        }
    };

    // 削除実行 (Confirm)
    const confirmBatchDelete = async () => {
        if (!deleteTargets) return;
        for (const target of deleteTargets) {
            if (target.token) await ConfirmDelete(target.token);
            setFileList(prev => prev.filter(f => f.id !== target.file.id));
        }
        setSelectedIds(new Set()); // 選択解除
        setDeleteTargets(null);    // ダイアログ閉じる
    };

    // 削除キャンセル
    const cancelBatchDelete = async () => {
        if (!deleteTargets) return;
        for (const target of deleteTargets) {
            if (target.token) await CancelDelete(target.token);
        }
        setDeleteTargets(null);
    };

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

    // チャンクサイズを動的に計算する
    const calculateChunkSize = (fileSize: number): number => {
        const MB = 1024 * 1024;
        const MIN_CHUNK = 2 * MB;
        const MAX_CHUNK = 128 * MB;

        // 基本はファイルサイズの1/10
        let target = Math.ceil(fileSize / 10);

        // 範囲内に収める
        if (target < MIN_CHUNK) return MIN_CHUNK;
        if (target > MAX_CHUNK) return MAX_CHUNK;
        return target;
    };

    // ファイルを分割してGoにアップロード
    const uploadFileInChunks = async (
        file: File,
        onProgress: (percent: number) => void
    ): Promise<string> => {
        const CHUNK_SIZE = calculateChunkSize(file.size);
        let offset = 0;
        let filePath = "";

        console.log(`📦 Chunk Size for ${file.name}: ${(CHUNK_SIZE / (1024 * 1024)).toFixed(1)} MB`);

        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const base64Data = await readFileAsBase64(slice);

            filePath = await UploadChunk(file.name, base64Data, offset);

            offset += CHUNK_SIZE;

            const percent = Math.min(100, Math.round((offset / file.size) * 100));
            onProgress(percent);
            console.log(`Uploading: ${percent}%`);
        }
        return filePath;
    };

    // 環境判定 (Mac && 非Retina)
    useEffect(() => {
        const setupFontSmoothing = async () => {
            // GoからOS名を取得
            const os = await GetOSName();
            if (os !== 'darwin') return; // Mac以外は何もしない

            // スムージングクラスを切り替える関数
            const updateSmoothing = () => {
                const isRetina = window.devicePixelRatio >= 2;
                if (!isRetina) {
                    // 非Retinaなら強制スムージングON
                    document.body.classList.add('force-smoothing');
                    console.log("Non-Retina detected: Smoothing Enabled");
                } else {
                    // Retinaなら標準に戻す
                    document.body.classList.remove('force-smoothing');
                    console.log("Retina detected: Smoothing Disabled");
                }
            };

            // 初回実行
            updateSmoothing();

            // DPIの変化を監視する (ウィンドウ移動対策)
            const mq = window.matchMedia('screen and (min-resolution: 2dppx)');

            // モダンブラウザ用リスナー
            const handleChange = () => updateSmoothing();

            mq.addEventListener("change", handleChange);

            // クリーンアップ
            return () => {
                mq.removeEventListener("change", handleChange);
            };
        };

        setupFontSmoothing();
    }, []);

    // useEffectでWailsのイベントリスナーを登録
    useEffect(() => {
        // Goからの準備完了合図を待つ
        const onReady = () => {
            setShowSplash(false);
        };
        EventsOn("app:ready", onReady);

        // Wailsからのファイルドロップイベントを受け取るリスナー (除くWindows)
        const onFileDrop = async (x: number, y: number, files: string[]) => {
            console.log("👺 Wails Drop Event Fired", x, y, files);

            // 処理中は受け付けない
            if (currentView !== 'setup') return;

            setIsDragging(false);

            // ループ処理
            if (files && files.length > 0) {
                await addFilesToList(files, false, 'same');
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
        };

        // 進捗データ専用のリスナー
        const onProgress = (data: ProgressEvent) => {
            if (currentFileIdRef.current === null) return;
            const targetId = currentFileIdRef.current;

            setFileList(prevList => {
                return prevList.map(item => {
                    if (item.id === targetId && item.duration > 0) {
                        // 時間から進捗率を計算
                        const percent = Math.min(100, (data.timeSec / item.duration) * 100);
                        return {
                            ...item,
                            progress: percent,
                            encodedSize: data.size // Goから正確なバイト数が来る
                        };
                    }
                    return item;
                });
            });
        };

        // イベント登録
        EventsOn('wails:file-drop', onFileDrop);
        EventsOn('wails:drag:enter', onDragEnter);
        EventsOn('wails:drag:leave', onDragLeave);

        EventsOn("conversion:log", onLog); // ログ用
        EventsOn("conversion:progress", onProgress); // 数値用

        // クリーンアップ (コンポーネント削除時にリスナー解除)
        return () => {
            EventsOff('wails:file-drop');
            EventsOff('wails:drag:enter');
            EventsOff('wails:drag:leave');
            EventsOff("conversion:log");
            EventsOff("conversion:progress");
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
            // コピー開始時刻を記録
            setStartTime(Date.now());
            // ステータス
            setBatchStatus('importing');

            const droppedFiles = Array.from(e.dataTransfer.files);

            // 全ファイルの枠を作成してリストに追加
            const newEntries: MediaInfo[] = droppedFiles.map(file => {
                const path = (file as any).path || "";
                return {
                    id: crypto.randomUUID(), // ID発行
                    path: path,
                    size: file.size,
                    hasVideo: false,
                    hasAudio: false,
                    duration: 0,
                    // パスがあればwaiting, なければuploading
                    status: path ? 'waiting' : 'uploading',
                    isTemp: path ? false : true,
                    outputType: 'videos',
                    progress: 0
                };
            });

            // 既存リストの後ろに追加
            setFileList(prev => [...prev, ...newEntries]);

            // 順次処理
            for (let i = 0; i < droppedFiles.length; i++) {
                const file = droppedFiles[i];
                const entry = newEntries[i]; // 対応するエントリ

                try {
                    // まずパスがあるか確認
                    let finalPath = entry.path;

                    // パスがない場合 (Windowsなど) は分割アップロードを実行
                    if (!finalPath) {
                        console.log(`🦔 Streaming ${file.name} to temp storage...`);

                        finalPath = await uploadFileInChunks(file, (percent) => {
                            // IDを指定して進捗更新
                            setFileList(prev => prev.map(item =>
                                item.id === entry.id ? { ...item, progress: percent } : item
                            ));
                        });
                        console.log("👺 Saved to:", finalPath);
                    }

                    // 解析実行
                    const result = await AnalyzeMedia(finalPath);

                    // IDを指定して結果を反映
                    setFileList(prev => prev.map(item =>
                        item.id === entry.id ? {
                            ...item,
                            ...result, // 解析結果(Duration等)をマージ
                            path: finalPath, // 確定したパス
                            status: 'waiting',
                            progress: 0
                        } : item
                    ));
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    // IDを指定してエラー状態へ
                    setFileList(prev => prev.map(item =>
                        item.id === entry.id ? { ...item, status: 'error' } : item
                    ));
                }
            }
            setBatchStatus('idle');
            setStartTime(null);
        }
    };

    // 変換実行ボタンの処理
    const startConversion = async () => {
        if (fileList.length === 0) {
            return;
        }
        setCurrentView('processing');
        setBatchStatus('converting');
        setLog(["Starting process..."]);
        setStartTime(Date.now()); // 全体の開始時刻

        // 全ファイルを順次処理
        for (const item of fileList) {
            // 処理開始前にRefを更新
            currentFileIdRef.current = item.id;

            // ステータスをProcessingに変更
            setFileList(prev => prev.map(f =>
                f.id === item.id ? {
                    ...f,
                    status: 'processing',
                    progress: 0,
                    startedAt: Date.now(), // ここで刻む
                    encodedSize: 0
                } : f
            ));

            try {
                setLog(prev => [...prev, `[INFO] Converting: ${item.path}...`]);

                // 結果を受け取る
                // Go側で (ConvertResult, error) を返すよ
                // JS側では Promise<ConvertResult> が返ってくる
                const result = await ConvertVideo(item.path, {
                    codec: codec,
                    audio: audio,
                    extension: "mp4",
                    outputDirType: item.outputType || "same"
                });

                // 完了したらDoneにする
                setFileList(prev => prev.map(f =>
                    f.id === item.id ? {
                        ...f,
                        status: 'done',
                        progress: 100,
                        completedAt: Date.now(), // 終了時刻を記録
                        encodedSize: result.size, // 確定したファイルサイズで上書きする
                        outputPath: result.outputPath, // 出力先
                    } : f
                ));
                setLog(prev => [...prev, `>> [SUCCESS] Finished: ${item.path}`]);
            } catch (error) {
                // エラー
                setFileList(prev => prev.map(f =>
                    f.id === item.id ? { ...f, status: 'error' } : f
                ));
                setLog(prev => [...prev, `>> [ERROR] Failed: ${item.path} - ${error}`]);
            }
        }

        // 全処理終了
        currentFileIdRef.current = null;
        setBatchStatus('idle');
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
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onDeleteReq={startBatchDelete}
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
                            batchStatus={batchStatus}               // 状態を渡す
                            onBack={() => setCurrentView('setup')}
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <FunctionKeyFooter
                mode={currentView}
                canRun={fileList.length > 0}
                canDelete={selectedIds.size > 0}
                onRun={startConversion}
                onDelete={startBatchDelete} // F8で発火
                onBack={() => {
                    if (currentView === 'processing') {
                        // 処理画面なら戻る
                        // (ここで一時ファイルの削除, 処理中止などのクリーンアップを呼ぶ)
                        setLog([]);
                        setBatchStatus('idle');
                        setCurrentView('setup');
                    } else {
                        // セットアップ画面ならアプリ終了
                        Quit();
                    }
                }}
            />
            <StatusBar
                fileList={fileList}
                batchStatus={batchStatus}
                startTime={startTime}
            />

            {/* Global Modal */}
            <DeleteConfirmDialog
                targets={deleteTargets || []}
                isOpen={!!deleteTargets}
                onConfirm={confirmBatchDelete}
                onCancel={cancelBatchDelete}
            />
        </div>
    )
}

export default App
