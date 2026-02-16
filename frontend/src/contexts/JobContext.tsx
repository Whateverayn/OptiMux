// src/contexts/JobContext.tsx

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import { MediaInfo, BatchStatus } from "../types.js";

// 計算済みデータ
export type JobMetrics = {
    // 全体統計
    totalFiles: number;
    completedFiles: number;
    successCount: number;
    errorCount: number;

    // サイズ, 時間
    totalOriginalSize: number;
    totalEncodedSize: number; // 完了分 + 進行中
    totalProjectedSize: number; // 予測合計
    reductionRate: number; // 全体の削減率

    // 進捗, 速度
    globalProgress: number; // 0-100
    elapsedSeconds: number; // タイマーではなく, 更新時点での経過時間
    etaSeconds: number;
    speed: number; // 平均倍速
    currentSpeedBps: number; // 転送速度(Bps)

    // 状態フラグ
    isJobFinished: boolean; // 全タスク完了（エラー含む）
    hasActiveJob: boolean; // まだ動いているか
};

// アクション
type JobActions = {
    // Setup用 (Source List操作)
    addFiles: (files: MediaInfo[]) => void;
    removeFiles: (ids: string[], fromTaskList?: boolean) => void; // taskListから消すか選べるように
    updateFile: (id: string, updates: Partial<MediaInfo>, inTaskList?: boolean) => void;
    clearFiles: () => void;

    // Processing用 (Task List操作)
    setTaskList: (tasks: MediaInfo[]) => void;
    updateTask: (id: string, updates: Partial<MediaInfo>) => void; // taskList専用更新
    clearTaskList: () => void;

    // 共通
    setBatchStatus: (status: BatchStatus) => void;
    setStartTime: (time: number | null) => void; // タイマー開始の代わりに開始時刻をセット
    addLog: (msg: string) => void; // ログ機能も統合
    clearAll: () => void;
};

// Contextの型定義
type JobContextType = {
    files: MediaInfo[];     // Setup画面用 (Source)
    taskList: MediaInfo[];  // Processing画面用 (Queue)
    batchStatus: BatchStatus;
    log: string[];          // ログデータ

    // ゲッター (計算済み情報)
    activeFile: MediaInfo | undefined; // 今処理してるやつ
    metrics: JobMetrics; // 全体の状況

    // アクション
    actions: JobActions;
};

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Stateの分離
    const [files, setFiles] = useState<MediaInfo[]>([]);        // Source List
    const [taskList, setTaskList] = useState<MediaInfo[]>([]);  // Execution Queue

    const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [log, setLog] = useState<string[]>([]);

    // --- Actions ---

    const addFiles = useCallback((newFiles: MediaInfo[]) => {
        setFiles(prev => [...prev, ...newFiles]);
    }, []);

    // 削除: fromTaskList=trueならタスクリストから, falseならソースリストから
    const removeFiles = useCallback((ids: string[], fromTaskList = false) => {
        const idSet = new Set(ids);
        if (fromTaskList) {
            setTaskList(prev => prev.filter(f => !idSet.has(f.id)));
        } else {
            setFiles(prev => prev.filter(f => !idSet.has(f.id)));
        }
    }, []);

    // ファイル更新: 基本はfilesだが, inTaskList=trueならtaskListを更新
    const updateFile = useCallback((id: string, updates: Partial<MediaInfo>, inTaskList = false) => {
        if (inTaskList) {
            setTaskList(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        } else {
            setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        }
    }, []);

    // TaskList専用の更新
    const updateTask = useCallback((id: string, updates: Partial<MediaInfo>) => {
        setTaskList(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    }, []);

    const clearFiles = useCallback(() => setFiles([]), []);
    const clearTaskList = useCallback(() => setTaskList([]), []);

    const addLog = useCallback((msg: string) => {
        setLog(prev => [...prev.slice(-100), msg]);
    }, []);

    const clearAll = useCallback(() => {
        setFiles([]);
        setTaskList([]);
        setBatchStatus('idle');
        setStartTime(null);
        setLog([]);
    }, []);


    // --- Metrics Logic ---

    const metrics = useMemo((): JobMetrics => {
        // モードによって計算対象リストを切り替える
        // converting中なら taskList を, それ以外(setup/importing)なら files を見る
        const targetList = batchStatus === 'converting' ? taskList : files;

        const totalFiles = targetList.length;
        const completedFiles = targetList.filter(f => f.status === 'done').length;
        const errorCount = targetList.filter(f => f.status === 'error').length;
        const successCount = completedFiles;

        const activeFile = targetList.find(f => f.status === 'processing' || f.status === 'uploading');
        const hasActiveJob = !!activeFile || targetList.some(f => f.status === 'waiting');
        const isJobFinished = totalFiles > 0 && !hasActiveJob;

        // 集計用変数
        let totalOriginalSize = 0;
        let totalEncodedSize = 0;
        // let totalTargetSize = 0; // 完了予想サイズの合計

        // 進捗計算用
        let totalWeight = 0;   // 全体の重み (通常はDuration)
        let processedWeight = 0; // 消化した重み

        targetList.forEach(f => {
            totalOriginalSize += f.size;

            // 目標サイズ (expectedSize) があればそれを使う
            // const targetSize = f.expectedSize || f.size;
            // totalTargetSize += targetSize;

            // 進捗の重みは予想時間 (expectedDuration) を使う
            // 設定がなければ元の duration を使う
            const weight = f.expectedDuration || f.duration || 1;
            totalWeight += weight;

            // 進捗度合いに応じた加算
            if (f.status === 'done') {
                totalEncodedSize += (f.encodedSize || 0);
                processedWeight += weight;
            } else if (f.status === 'processing' || f.status === 'uploading') {
                totalEncodedSize += (f.encodedSize || 0);
                // progress (0-100) に応じて重みを加算
                const p = (f.progress || 0) / 100;
                processedWeight += weight * p;
            }
        });

        // 経過時間 (現在時刻 - 開始時刻)
        const now = Date.now();
        const elapsedSeconds = startTime ? (now - startTime) / 1000 : 0;

        // 転送速度 (Bytes/sec)
        const currentSpeedBps = elapsedSeconds > 0 ? totalEncodedSize / elapsedSeconds : 0;

        // 全体進捗 (0-100)
        const globalProgress = totalOriginalSize > 0
            ? (processedWeight / totalWeight) * 100
            : 0;

        // 予測合計サイズ
        // 完了済みは確定値, 未完了は expectedSize を使う
        // もし expectedSize が未設定なら, 現在の圧縮率で推測する
        let totalProjectedSize = 0;

        if (targetList.some(f => f.expectedSize !== undefined)) {
            // レシピでサイズ指定がある場合
            targetList.forEach(f => {
                if (f.status === 'done') totalProjectedSize += (f.encodedSize || 0);
                else totalProjectedSize += (f.expectedSize || f.size); // 未設定なら元サイズと仮定
            });
        } else {
            // 現在の圧縮率から全体を推測
            if (globalProgress > 0) {
                totalProjectedSize = totalEncodedSize / (globalProgress / 100);
            } else {
                totalProjectedSize = totalOriginalSize;
            }
        }

        const reductionRate = totalOriginalSize > 0
            ? ((totalOriginalSize - totalProjectedSize) / totalOriginalSize) * 100
            : 0;

        // ETA (単純比例)
        const processingSpeed = elapsedSeconds > 0 ? processedWeight / elapsedSeconds : 0;
        const remainingWeight = totalWeight - processedWeight;
        const etaSeconds = processingSpeed > 0 ? remainingWeight / processingSpeed : 0;

        // 平均倍速 (動画処理時のみ有効)
        let totalInputDurationProcessed = 0;
        if (batchStatus === 'converting') {
            targetList.forEach(f => {
                // 進捗率 * 元の動画時間
                if (f.status === 'done') totalInputDurationProcessed += f.duration;
                else if (f.status === 'processing') totalInputDurationProcessed += (f.duration * ((f.progress || 0) / 100));
            });
        }
        const speed = elapsedSeconds > 0 ? totalInputDurationProcessed / elapsedSeconds : 0;

        return {
            totalFiles, completedFiles, successCount, errorCount,
            totalOriginalSize, totalEncodedSize, totalProjectedSize, reductionRate,
            globalProgress, elapsedSeconds, etaSeconds, speed, currentSpeedBps,
            isJobFinished, hasActiveJob
        };
    }, [files, taskList, startTime, batchStatus]);

    // アクティブファイル取得 (モードに応じて切り替え)
    const activeFile = batchStatus === 'converting'
        ? taskList.find(f => f.status === 'processing')
        : files.find(f => f.status === 'uploading');


    return (
        <JobContext.Provider value={{
            files,
            taskList,       // ProcessingView用
            batchStatus,
            log,            // ログ
            activeFile,
            metrics,
            actions: {
                addFiles, removeFiles, updateFile, clearFiles,
                setTaskList, updateTask, clearTaskList,
                setBatchStatus, setStartTime, addLog, clearAll
            }
        }}>
            {children}
        </JobContext.Provider>
    );
};

// カスタムフック: これを各コンポーネントで呼ぶ
export const useJob = () => {
    const context = useContext(JobContext);
    if (!context) throw new Error("useJob must be used within a JobProvider");
    return context;
};