import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
    AnalyzeMedia,
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

// JobContext
import { JobProvider, useJob } from './contexts/JobContext.js';

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
    // ログの自動スクロール用
    // const logEndRef = useRef<HTMLDivElement>(null);

    // 常に最新のfileListを保持するRef
    // useEffect(() => {
    //     fileListRef.current = fileList;
    // }, [fileList]);

    // --- Actions ---

    // 時間文字列 (HH:MM:SS.ms) を 秒(number) に変換
    // const parseTimeToSeconds = (timeStr: string): number => {
    //     const parts = timeStr.split(':');
    //     if (parts.length < 3) return 0;
    //     const h = parseFloat(parts[0]);
    //     const m = parseFloat(parts[1]);
    //     const s = parseFloat(parts[2]);
    //     return (h * 3600) + (m * 60) + s;
    // };

    // --- Events ---

    // useEffect(() => {
    //     // ドラッグ中の演出用イベント
    //     const onDragEnter = () => setIsDragging(true);
    //     const onDragLeave = () => setIsDragging(false);

    //     EventsOn('wails:drag:enter', onDragEnter);
    //     EventsOn('wails:drag:leave', onDragLeave);

    //     return () => {
    //         EventsOff('wails:drag:enter');
    //         EventsOff('wails:drag:leave');
    //     };
    // }, [currentView]); // currentViewが変わるたびに判定

    // ログ更新時に下までスクロール
    // useEffect(() => {
    //     logEndRef.current?.scrollIntoView({ behavior: "auto" });
    // }, [log]);

    // 進捗リスナー (Processing時は taskList を更新)
    // useEffect(() => {
    //     const onProgress = (data: ProgressEvent) => {
    //         if (currentFileIdRef.current === null) return;
    //         const targetId = currentFileIdRef.current;

    //         // taskList を更新する
    //         setTaskList(prevList => {
    //             return prevList.map(item => {
    //                 if (item.id === targetId && item.duration > 0) {
    //                     const scale = item.timeScale || 1.0;
    //                     const expectedDuration = item.duration / scale;
    //                     const percent = Math.min(100, (data.timeSec / expectedDuration) * 100);
    //                     return {
    //                         ...item,
    //                         progress: percent,
    //                         encodedSize: data.size
    //                     };
    //                 }
    //                 return item;
    //             });
    //         });
    //     };

    //     EventsOn("conversion:progress", onProgress);
    //     return () => EventsOff("conversion:progress");
    // }, []);

    // ヘルパー: ステータス更新用
    // const updateTaskStatus = (id: string, status: any, progress: number) => {
    //     setTaskList(prev => prev.map(t => t.id === id ? { ...t, status, progress } : t));
    // };

    return (
        <JobProvider>
            <AppContent />
        </JobProvider>
    )
}

function AppContent() {
    // --- Context Hooks ---
    const {
        files,          // Setup用のファイルリスト
        taskList,       // Processing用のタスクリスト
        batchStatus,    // 状態 (Context管理)
        actions,        // 操作用メソッド群
        metrics,         // 各種統計情報
        log
    } = useJob();

    // --- Local State ---
    const [currentView, setCurrentView] = useState<AppView>('setup');

    // UI State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteTargets, setDeleteTargets] = useState<DeleteTarget[] | null>(null);    // Lift-up: 削除モーダル状態
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    // 設定
    const [codec, setCodec] = useState("hevc");
    const [audio, setAudio] = useState("copy");

    // 参照用Ref
    const taskResults = useRef<Map<string, ProcessResult>>(new Map());
    const currentFileIdRef = useRef<string | null>(null);

    // Contextの値をRefに同期させる (リスナー内での参照用)
    const filesRef = useRef<MediaInfo[]>([]);       // 重複チェック用
    const taskListRef = useRef<MediaInfo[]>([]);

    // Contextのfilesが変わったらRefも更新 (重複チェックロジックのため)
    useEffect(() => { filesRef.current = files; }, [files]);
    useEffect(() => { taskListRef.current = taskList; }, [taskList]);

    // --- Actions ---

    // ファイル追加
    const addFilesToList = async (
        newPaths: string[],
        isTempFile: boolean = false,
        outputType: 'same' | 'video' | 'temp' = 'same'
    ) => {
        // 重複チェック: パス名でチェック
        const currentPaths = new Set(filesRef.current.map(f => f.path));
        const uniquePaths = newPaths.filter(p => !currentPaths.has(p));

        if (uniquePaths.length === 0) return;

        const newItems: MediaInfo[] = uniquePaths.map(path => ({
            id: crypto.randomUUID(),
            path: path,
            size: 0,
            hasVideo: false, hasAudio: false, duration: 0,
            status: 'waiting', progress: 0,
            isTemp: isTempFile,
            outputType: outputType,
            taskType: 'convert'
        }));

        // Contextのアクションを呼ぶ
        actions.addFiles(newItems);

        // 解析
        for (const item of newItems) {
            AnalyzeMedia(item.path)
                .then(result => {
                    // Contextのアクションで更新
                    actions.updateFile(item.id, { ...result, status: 'waiting' });
                })
                .catch(err => {
                    // 失敗したらエラー状態に
                    console.error(err);
                    actions.updateFile(item.id, { status: 'error' });
                });
        }
    };

    // ファイル選択ダイアログ (F3)
    const handleOpenFile = async () => {
        try {
            // Goのダイアログを呼び出す
            const files = await SelectVideoFiles();
            if (files && files.length > 0) {
                // isTemp: false, outputType: 'same'
                await addFilesToList(files, false, "same");
            }
        } catch (err) {
            console.error("Failed to select files:", err);
        }
    };

    // 削除フロー開始 (F8)
    const startBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        // Setupならfiles, ProcessingならtaskListから対象を探す
        const targetList = currentView === 'setup' ? files : taskList;
        const filesToDelete = targetList.filter(f => selectedIds.has(f.id));

        // 分類
        const tempFiles = filesToDelete.filter(f => f.isTemp);
        const normalFiles = filesToDelete.filter(f => !f.isTemp);

        // 通常ファイル: 即削除
        if (normalFiles.length > 0) {
            const normalIds = normalFiles.map(f => f.id);
            // Contextから削除 (Processing画面なら taskList から消すフラグを立てる)
            actions.removeFiles(normalIds, currentView === 'processing');

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
                setDeleteTargets(targets);  // ダイアログ表示
            } catch (e) { console.error(e); }
        }
    };

    // 削除実行 (Confirm)
    const confirmBatchDelete = async () => {
        if (!deleteTargets) return;
        const deletedIds: string[] = [];

        for (const target of deleteTargets) {
            // 物理削除実行
            if (target.token) await ConfirmDelete(target.token);
            // リスト更新
            deletedIds.push(target.file.id);
        }

        // Contextから削除
        actions.removeFiles(deletedIds, currentView === 'processing');

        setSelectedIds(new Set());  // 選択解除
        setDeleteTargets(null);     // ダイアログ閉じる

        // Processing画面で全削除された場合

        // Processing画面なら, 削除が終わったので完了状態へ
        // if (currentView === 'processing') {
        //     finishAll();
        // }
    };

    // 削除キャンセル
    const cancelBatchDelete = async () => {
        if (!deleteTargets) return;
        for (const target of deleteTargets) {
            if (target.token) await CancelDelete(target.token);
        }
        setDeleteTargets(null);
    };

    // --- ユーティリティ ---

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

    // --- タスクランナー ---
    const runComplexTasks = async (generatedTasks: MediaInfo[]) => {
        // Contextの状態を更新
        actions.setBatchStatus('converting');
        actions.setStartTime(Date.now());       // 全体の開始時刻
        actions.setTaskList(generatedTasks);    // 生成したタスクをContextへ

        actions.addLog(`🥁 Starting process... at ${new Date().toISOString()}`);
        taskResults.current.clear();
        // SetupViewからProcessingViewへ遷移
        setCurrentView('processing');

        // 実行ループ
        const processingTasks = generatedTasks.filter(t => t.taskType !== 'trash');

        // 全ファイルを順次処理
        for (let i = 0; i < processingTasks.length; i++) {
            const task = processingTasks[i];
            // 処理開始前にRefを更新
            currentFileIdRef.current = task.id;

            // Contextのタスク状態更新
            actions.updateTask(task.id, {
                status: 'processing',   // ここでProcessingにする
                progress: 0,
                startedAt: Date.now(),  // 開始時刻を記録
                encodedSize: 0
            });

            try {
                // Request 準備
                if (!task.processRequest) throw new Error("No process request");
                // リクエストのディープコピーを作成
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

                actions.addLog(`[RUN] ${task.taskType}: ${task.path}`);

                // 実行
                const result = await RunProcess(req);
                // 結果保存
                taskResults.current.set(task.id, result);

                // 完了更新
                const mainOut = result.results.find((r: any) => r.label === 'main');

                // Context更新
                actions.updateTask(task.id, {
                    status: 'done',
                    progress: 100,
                    completedAt: Date.now(),
                    encodedSize: mainOut?.size || 0,
                    outputPath: mainOut?.path,
                });

                if (mainOut) actions.addLog(`>> [SUCCESS] Finished: ${mainOut.path}`);

            } catch (error) {
                console.error(error);
                actions.updateTask(task.id, { status: 'error' });
                actions.addLog(`>> [ERROR] Failed: ${error}`);
                // エラー時はループを抜けて中断する
                break;
            }
        }

        // 全処理終了
        currentFileIdRef.current = null;
        actions.addLog("🌵 Conversion tasks finished");

        // Trash Task
        const trashTasks = generatedTasks.filter(t => t.taskType === 'trash');
        if (trashTasks.length > 0) {
            actions.addLog("🗑️ Preparing deletion confirmation...");
            const targets: DeleteTarget[] = [];

            // 全ての削除対象に対してトークンを発行
            for (const task of trashTasks) {
                try {
                    const token = await RequestDelete(task.path);
                    targets.push({ file: task, token });
                } catch (e) {
                    console.error("Failed to request delete:", e);
                    // ファイルが既にない場合などはエラーになるのでスキップ
                    actions.updateTask(task.id, { status: 'error' });
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

    const finishAll = () => {
        actions.setBatchStatus('idle');
        actions.addLog("👺 All operations completed 👹");
    };

    // 通常変換開始
    const startConversion = () => {
        if (files.length === 0) return;
        // fileList から 通常変換タスク を生成する
        const tasks = generateNormalTasks(files, { codec, audio });
        runComplexTasks(tasks);
    };

    // レシピ実行
    const handleRecipeRun = (recipeId: string, params: any) => {
        setIsRecipeOpen(false);         // ダイアログ閉じる
        if (files.length === 0) return;

        let tasks: MediaInfo[] = [];
        // レシピIDで分岐
        if (recipeId === 'dual_ff') {
            tasks = generateDualFFTasks(files, {
                targetDuration: params.targetDuration || 60,
                trashOriginal: params.trashOriginal || false
            });
        }
        if (tasks.length > 0) runComplexTasks(tasks);
    };

    // --- Events ---

    // 環境判定
    useEffect(() => {
        const setupFontSmoothing = async () => {
            // GoからOS名を取得
            const os = await GetOSName();
            if (os !== 'darwin') return; // macOS以外は何もしない

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
            }

            // 初回実行
            updateSmoothing();

            // DPIの変化を監視する
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
        const onReady = () => setShowSplash(false);

        // Goからの進捗通知
        const onProgress = (data: ProgressEvent) => {
            if (!currentFileIdRef.current) return;
            const targetId = currentFileIdRef.current;

            const isProcessing = currentView === 'processing';
            const targetList = isProcessing ? taskListRef.current : filesRef.current;

            const targetTask = targetList.find(t => t.id === targetId);

            if (targetTask) {
                const targetDuration = targetTask.expectedDuration || targetTask.duration;
                // ゼロ除算対策
                const percent = targetDuration > 0
                    // 時間から進捗率を計算
                    ? Math.min(100, (data.timeSec / targetDuration) * 100)
                    : 0;

                // 第3引数(isProcessing)が true なら TaskList, false なら Files を更新
                actions.updateFile(targetId, {
                    progress: percent,
                    encodedSize: data.size
                }, isProcessing);
            }
        };

        // 進捗ログの受信
        const onLog = (msg: string) => actions.addLog(msg);

        // Wailsからのファイルドロップイベントを受け取るリスナー (除くWindows)
        const onFileDrop = async (x: number, y: number, files: string[]) => {
            console.log("👺 Wails Drop Event Fired", x, y, files);
            // 処理中は受け付けない
            if (currentView !== 'setup') return;
            setIsDragging(false);
            // ループ処理
            if (files && files.length > 0) {
                await addFilesToList(files, false, 'same');
            }
        };

        EventsOn("app:ready", onReady);
        EventsOn('wails:file-drop', onFileDrop);        // イベント登録
        EventsOn("conversion:log", onLog);              // ログ用
        EventsOn("conversion:progress", onProgress);    // 数値用

        // クリーンアップ (コンポーネント削除時にリスナー解除)
        return () => {
            EventsOff("app:ready");
            EventsOff('wails:file-drop');
            EventsOff("conversion:log");
            EventsOff("conversion:progress");
        };
    }, [currentView])

    // HTML5 Drop Handler (Windows用)
    const handleHtmlDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentView !== 'setup') return;
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // コピー開始時刻
            actions.setStartTime(Date.now());
            // ステータス
            actions.setBatchStatus('importing');

            const droppedFiles = Array.from(e.dataTransfer.files);

            // 重複チェック (ファイル名で)
            const currentFileNames = new Set(filesRef.current.map(f => f.path.split(/[/\\]/).pop() || f.path));
            const validFiles: File[] = [];
            const newEntries: MediaInfo[] = [];

            droppedFiles.forEach(file => {
                if (currentFileNames.has(file.name)) {
                    console.warn(`Duplicate filename ignored: ${file.name}`);
                } else {
                    validFiles.push(file);
                    currentFileNames.add(file.name);

                    newEntries.push({
                        id: crypto.randomUUID(),    // ID発行
                        path: "", // Windowsなのでまだパスなし
                        size: file.size,
                        hasVideo: false, hasAudio: false, duration: 0,
                        status: 'uploading', // 最初はアップロード中
                        isTemp: true,       // WindowsコピーなのでTemp
                        outputType: 'video', // 出力はビデオフォルダへ
                        progress: 0,
                        taskType: 'convert'
                    });
                }
            });

            if (validFiles.length === 0) {
                actions.setBatchStatus('idle');
                return;
            }

            // Contextに追加
            actions.addFiles(newEntries);

            // 順次アップロード & 解析
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                const entry = newEntries[i];    // 対応するエントリ

                try {
                    console.log(`🦔 Streaming ${file.name} to temp storage...`);
                    // UploadChunk (進捗はコールバックで更新)
                    const finalPath = await uploadFileInChunks(file, (percent) => {
                        actions.updateFile(entry.id, { progress: percent });
                    });
                    console.log("👺 Saved to:", finalPath);

                    // 解析
                    const result = await AnalyzeMedia(finalPath);

                    // 結果反映 (Waitingへ)
                    actions.updateFile(entry.id, {
                        ...result,
                        path: finalPath,
                        status: 'waiting',
                        progress: 0
                    });

                } catch (error) {
                    console.error(error);
                    actions.updateFile(entry.id, { status: 'error' });
                }
            }

            actions.setBatchStatus('idle');
            actions.setStartTime(null);
        }

    };

    // --- Render ---
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
                            files={files} // Contextのデータを渡す
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onDeleteReq={startBatchDelete}
                            codec={codec} setCodec={setCodec}
                            audio={audio} setAudio={setAudio}
                            onStart={startConversion}
                            onOpenReq={handleOpenFile}
                            onOpenRecipeDialog={() => setIsRecipeOpen(true)}
                        />
                    ) : (
                        <ProcessingView
                            // files={taskList} // ProcessingView内でuseJobを使うなら不要
                            // log={log}       // 不要
                            // batchStatus={batchStatus}  // 不要
                            onBack={() => {
                                setCurrentView('setup');
                                actions.setBatchStatus('idle');
                                actions.clearAll(); // またはログクリアなど
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <FunctionKeyFooter
                mode={currentView}
                canRun={files.length > 0}
                canDelete={selectedIds.size > 0}
                onOpen={handleOpenFile}
                onRun={startConversion}
                onRunAdv={() => setIsRecipeOpen(true)}
                onDelete={startBatchDelete}             // F8で発火
                onBack={() => {
                    if (currentView === 'processing') {
                        // 戻る処理
                        setCurrentView('setup');
                        actions.setBatchStatus('idle');
                    } else {
                        // セットアップ画面ならアプリ終了
                        Quit();
                    }
                }}
            />

            {/* StatusBarはProps不要 (内部でuseJobする) */}
            <StatusBar
            // fileList={currentView === 'processing' ? taskList : fileList}
            // batchStatus={batchStatus}
            // startTime={startTime}
            />

            {/* Modals */}
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
    );
}

export default App
