import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
    AnalyzeMedia,
    ConvertVideo,
    RunProcess,
    UploadChunk,
    RequestDelete,
    ConfirmDelete,
    CancelDelete,
    GetOSName,
    SelectVideoFiles
} from "../wailsjs/go/main/App.js";
import { EventsOn, EventsOff, OnFileDrop, Quit } from "../wailsjs/runtime/runtime.js"; // D&Dイベントのためのインポート
import { createConvertRequest } from "./utils/commandFactory.js";
import { generateDualFFTasks } from "./utils/recipes/dualff.js";
import { generateNormalTasks } from "./utils/recipes/normal.js";
import { MediaInfo, BatchStatus, ProcessResult, ProcessRequest } from "./types.js";

// Components
import TitleBar from './components/layout/TitleBar.js';
import StatusBar from './components/layout/StatusBar.js';
import FunctionKeyFooter from './components/layout/FunctionKeyFooter.js';
import DeleteConfirmDialog, { DeleteTarget } from './components/ui/DeleteConfirmDialog.js';
import RecipeSelectDialog from './components/ui/RecipeSelectDialog.js';
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
    // データソース (Setup用)
    const [fileList, setFileList] = useState<MediaInfo[]>([]);
    // タスクリスト (Processing用)
    const [taskList, setTaskList] = useState<MediaInfo[]>([]);

    // 選択状態
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // Lift-up: 選択状態
    const [deleteTargets, setDeleteTargets] = useState<DeleteTarget[] | null>(null); // Lift-up: 削除モーダル状態

    const [startTime, setStartTime] = useState<number | null>(null);
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);

    // 設定 (通常)
    const [codec, setCodec] = useState("hevc");
    const [audio, setAudio] = useState("copy");

    // 画面状態
    const [currentView, setCurrentView] = useState<AppView>('setup');
    const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
    const [log, setLog] = useState<string[]>([]);

    const [showSplash, setShowSplash] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    // 複雑なタスク実行用のState
    const taskResults = useRef<Map<string, ProcessResult>>(new Map());

    // 現在処理中のファイルのインデックスを追跡するRef
    const currentFileIdRef = useRef<string | null>(null);

    // ログの自動スクロール用
    const logEndRef = useRef<HTMLDivElement>(null);

    // 常に最新のfileListを保持するRef
    const fileListRef = useRef<MediaInfo[]>([]);
    useEffect(() => {
        fileListRef.current = fileList;
    }, [fileList]);

    // 現在のモード (UIで切り替えられるようにする)
    const [mode, setMode] = useState<'normal' | 'dual_ff'>('normal');

    // --- Actions ---
    // ファイル追加
    const addFilesToList = async (
        newPaths: string[],
        isTempFile: boolean = false,
        outputType: 'same' | 'video' | 'temp' = 'same'
    ) => {
        // 重複チェック: パス名でチェック
        const currentPaths = new Set(fileListRef.current.map(f => f.path));
        const uniquePaths = newPaths.filter(p => !currentPaths.has(p));

        console.log(fileList, uniquePaths);

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
            outputType: outputType,
            taskType: 'convert'
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

    // ファイル選択ダイアログを開く
    const handleOpenFile = async () => {
        try {
            // Goのダイアログを呼び出す
            const files = await SelectVideoFiles();
            if (files && files.length > 0) {
                // OSダイアログ経由ならWindowsでも絶対パスが取れる
                // isTemp: false, outputType: 'same'
                await addFilesToList(files, false, "same");
            }
        } catch (err) {
            console.error("Failed to select files:", err);
        }
    };

    // 削除フロー開始 (F8 or ボタン; Setup用)
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

        // Tempファイル: 確認ダイアログ
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
            // 物理削除実行
            if (target.token) await ConfirmDelete(target.token);
            // リスト更新
            setFileList(prev => prev.filter(f => f.id !== target.file.id));
        }
        setSelectedIds(new Set()); // 選択解除
        setDeleteTargets(null);    // ダイアログ閉じる

        // Processing画面なら, 削除が終わったので完了状態へ
        if (currentView === 'processing') {
            finishAll();
        }
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

    // --- Events ---
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

            const updateFunc = (prevList: MediaInfo[]) => {
                return prevList.map(item => {
                    if (item.id === targetId && item.duration > 0) {
                        // 時間から進捗率を計算
                        const percent = Math.min(100, (data.timeSec / item.duration) * 100);
                        return {
                            ...item,
                            progress: percent,
                            encodedSize: data.size // 現在の出力サイズ
                        };
                    }
                    return item;
                });
            };

            if (currentView === 'processing') {
                setTaskList(updateFunc);
            } else {
                // Setup画面でアップロード中などの場合用
                setFileList(updateFunc);
            }
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

    // 進捗リスナー (Processing時は taskList を更新)
    useEffect(() => {
        const onProgress = (data: ProgressEvent) => {
            if (currentFileIdRef.current === null) return;
            const targetId = currentFileIdRef.current;

            // taskList を更新する
            setTaskList(prevList => {
                return prevList.map(item => {
                    if (item.id === targetId && item.duration > 0) {
                        const scale = item.timeScale || 1.0;
                        const expectedDuration = item.duration / scale;
                        const percent = Math.min(100, (data.timeSec / expectedDuration) * 100);
                        return {
                            ...item,
                            progress: percent,
                            encodedSize: data.size
                        };
                    }
                    return item;
                });
            });
        };

        EventsOn("conversion:progress", onProgress);
        return () => EventsOff("conversion:progress");
    }, []);

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
                    outputType: 'video',
                    progress: 0,
                    taskType: 'convert'
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

    // 処理開始
    const handleStart = () => {
        setCurrentView('processing');
        // 後で実装
    };

    // タスクランナー
    const runComplexTasks = async (generatedTasks: MediaInfo[]) => {
        setBatchStatus('converting');
        setStartTime(Date.now()); // 全体の開始時刻
        taskResults.current.clear();
        setLog([`🥁 Starting process... at ${new Date().toISOString()}`]);

        // SetupViewからProcessingViewへ遷移
        setCurrentView('processing');

        // 実行用リスト(taskList)にセットする
        setTaskList(generatedTasks);

        // 'trash' 以外のタスクを抽出して実行
        const processingTasks = generatedTasks.filter(t => t.taskType !== 'trash');

        // 全ファイルを順次処理
        for (let i = 0; i < processingTasks.length; i++) {
            const task = processingTasks[i];
            // 処理開始前にRefを更新
            currentFileIdRef.current = task.id;

            setTaskList(prev => prev.map(t =>
                t.id === task.id ? {
                    ...t,
                    status: 'processing', // ここでProcessingにする
                    progress: 0,
                    startedAt: Date.now(), // 開始時刻を記録
                    encodedSize: 0
                } : t
            ));

            // ステータス更新: Processing
            updateTaskStatus(task.id, 'processing', 0);

            try {
                // Request 準備
                if (!task.processRequest) {
                    throw new Error("No process request found for task");
                }

                // リクエストのディープコピーを作成（パス書き換え用）
                let req = JSON.parse(JSON.stringify(task.processRequest));

                // 依存パスの解決 (Concat用)
                if (task.taskType === 'concat' && task.dependencyRefs) {
                    const resolvedPaths: string[] = [];

                    for (const ref of task.dependencyRefs) {
                        if (ref.startsWith("ref:")) {
                            const targetId = ref.split(':')[1];
                            const prevResult = taskResults.current.get(targetId);

                            if (prevResult) {
                                // temp_chunk ラベルを持つ結果を探す
                                let chunk = prevResult?.results.find((r: any) => r.label === 'temp_chunk');
                                if (!chunk) chunk = prevResult?.results.find((r: any) => r.label === 'main'); // mainフォールバック
                                if (chunk) resolvedPaths.push(chunk.path);
                            }
                        }
                    }

                    if (resolvedPaths.length === 0) {
                        throw new Error("Dependency resolution failed: No inputs found.");
                    }

                    req.input.paths = resolvedPaths;
                    console.log("Resolved Concat Inputs:", resolvedPaths);
                }

                setLog(prev => [...prev, `[RUN] ${task.taskType}: ${task.path}`]);

                // 結果を受け取る
                // Go側で (ConvertResult, error) を返す
                // JS側では Promise<ConvertResult> ({ results: FileResult[] })が返ってくる
                const result = await RunProcess(req);

                // 結果保存
                taskResults.current.set(task.id, result);

                // 完了更新
                // メイン出力 (label='main') を探して表示に反映
                const mainOut = result.results.find((r: any) => r.label === 'main');

                // 完了したらDoneにする
                setTaskList(prev => prev.map(t => t.id === task.id ? {
                    ...t,
                    status: 'done',
                    progress: 100,
                    completedAt: Date.now(),
                    encodedSize: mainOut?.size || 0,
                    outputPath: mainOut?.path,
                } : t));

                if (mainOut) {
                    setLog(prev => [...prev, `>> [SUCCESS] Finished: ${mainOut.path}`]);
                }

            } catch (error) {
                console.error(error);
                updateTaskStatus(task.id, 'error', 0);
                setLog(prev => [...prev, `>> [ERROR] Failed: ${error}`]);
                return;
            }
        }

        // 全処理終了
        currentFileIdRef.current = null;
        setLog(prev => [...prev, "🌵 Conversion tasks finished"]);

        // Trash Task
        const trashTasks = generatedTasks.filter(t => t.taskType === 'trash');
        if (trashTasks.length > 0) {
            setLog(prev => [...prev, "🗑️ Preparing deletion confirmation..."]);

            const targets: DeleteTarget[] = [];

            // 全ての削除対象に対してトークンを発行
            for (const task of trashTasks) {
                try {
                    const token = await RequestDelete(task.path);
                    targets.push({ file: task, token });
                } catch (e) {
                    console.error("Failed to request delete:", e);
                    // ファイルが既にない場合などはエラーになるのでスキップ
                    updateTaskStatus(task.id, 'error', 0);
                }
            }

            if (targets.length > 0) {
                // ダイアログを表示
                setDeleteTargets(targets);
            } else {
                // 削除対象がなかった(既に消えてた等)ので終了
                finishAll();
            }
        } else {
            // 削除タスクがなければ終了
            finishAll();
        }
    };

    // 全完了処理
    const finishAll = () => {
        setBatchStatus('idle');
        setLog(prev => [...prev, "👺 All operations completed 👹"]);
    };

    // ヘルパー: ステータス更新用
    const updateTaskStatus = (id: string, status: any, progress: number) => {
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, status, progress } : t));
    };

    const startConversion = () => {
        if (fileList.length === 0) return;

        // fileList から 通常変換タスク を生成する
        const tasks = generateNormalTasks(fileList, {
            codec: codec,
            audio: audio
        });

        runComplexTasks(tasks);
    };

    // レシピダイアログからの実行ハンドラ
    const handleRecipeRun = (recipeId: string, params: any) => {
        setIsRecipeOpen(false); // ダイアログ閉じる

        if (fileList.length === 0) return;

        let tasks: MediaInfo[] = [];

        // レシピIDで分岐
        if (recipeId === 'dual_ff') {
            tasks = generateDualFFTasks(fileList, {
                targetDuration: params.targetDuration || 60,
                trashOriginal: params.trashOriginal || false
            });
        }
        // else if (recipeId === 'concat_only') {
        //     // (将来実装)
        //     console.log("Concat Only not implemented yet");
        //     return;
        // }

        if (tasks.length > 0) {
            // 複雑タスク実行ランナーへ
            runComplexTasks(tasks);
        }
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
                            onOpenReq={handleOpenFile}
                            onOpenRecipeDialog={() => setIsRecipeOpen(true)}
                        />
                    ) : (
                        <ProcessingView
                            files={taskList}
                            log={log}                               // ログを渡す
                            batchStatus={batchStatus}               // 状態を渡す
                            onBack={() => {
                                setCurrentView('setup');
                                setBatchStatus('idle');
                                setLog([]);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <FunctionKeyFooter
                mode={currentView}
                canRun={fileList.length > 0}
                canDelete={selectedIds.size > 0}
                onOpen={handleOpenFile}
                onRun={startConversion}
                onRunAdv={() => setIsRecipeOpen(true)}
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
                fileList={currentView === 'processing' ? taskList : fileList}
                batchStatus={batchStatus}
                startTime={startTime}
            />

            {/* Global Modal */}

            {/* レシピ選択ダイアログ */}
            <RecipeSelectDialog
                isOpen={isRecipeOpen}
                onRun={handleRecipeRun}
                onCancel={() => setIsRecipeOpen(false)}
            />

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
