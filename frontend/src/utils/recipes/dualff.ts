// utils/recipes/dualff.ts

import { MediaInfo, ProcessRequest, OutputConfig } from "../../types.js";

// DualFF用パラメータ
// DualFF用パラメータ
export type DualFFParams = {
    targetDuration: number; // 目標時間 (秒) 例: 60
    trashOriginal: boolean; // 元ファイルを消すか
    rotation?: string;      // "0", "90", "180", "270"
};

// レシピ実行計画生成関数
// 入力ファイル群を受け取り, 実行すべきタスクのリストを返す
export const generateDualFFTasks = (
    files: MediaInfo[],
    params: DualFFParams
): MediaInfo[] => {

    const tasks: MediaInfo[] = [];
    const totalInputDuration = files.reduce((acc, f) => acc + f.duration, 0);

    // 倍率計算 (入力合計 / 目標時間)
    const speedFactor = totalInputDuration > 0 ? Math.max(1.0, totalInputDuration / params.targetDuration) : 1.0;

    console.log(`👴 DualFF Plan: Total ${totalInputDuration}s -> ${params.targetDuration}s (x${speedFactor.toFixed(2)})`);

    // Concatタスクが参照するためのIDリスト
    const chunkRefs: string[] = [];

    const output1TimeScale = 60.0;

    const rotation = params.rotation || "90";
    let transposeFilter = "";

    // 回転フィルタの生成
    if (rotation === "90") {
        transposeFilter = ",transpose=1";
    } else if (rotation === "180") {
        transposeFilter = ",transpose=1,transpose=1"; // 180度
    } else if (rotation === "270") {
        transposeFilter = ",transpose=2"; // 90度CCW (=270度CW)
    } else {
        // "0" or undefined -> なにもしない
        transposeFilter = "";
    }

    // ------------ 個別変換タスクの生成 (Convert) ------------
    files.forEach(file => {
        const taskId = crypto.randomUUID(); // 新しいタスクID
        chunkRefs.push(`ref:${taskId}`);    // 後で参照するために保存

        // フィルタ
        // 1. [0:v] を split で2つに複製 -> [v_in1], [v_in2]
        // 2. [v_in1] を 60倍速, 60fps に加工 -> [v_main] (Output 1用)
        // 3. [v_in2] を speedFactor倍速, 60fps, 回転 に加工 -> [v_temp] (Output 2用)
        const globalFilter = `[0:v]split=2[v_in1][v_in2];[v_in1]setpts=PTS/${output1TimeScale},fps=60[v_main];[v_in2]setpts=PTS/${speedFactor},fps=60${transposeFilter}[v_temp]`;

        // Output 1: Main (AV1, 60倍速) -> Videoフォルダ
        const outMain: OutputConfig = {
            label: 'main',
            dirType: 'video',
            customDir: '',
            nameMode: 'auto',
            nameValue: '_60x',
            extension: 'mp4',
            ffmpegOptions: [
                "-map", "[v_main]", // フィルタで作った [v_main] を映像ソースにする
                "-c:v", "libsvtav1",
                "-map_metadata", "0",
                "-map_metadata:s:v", "0:s:v",
                "-an",
            ]
        };

        // Output 2: Temp Chunk (HEVC,可変倍速 + 回転) -> Tempフォルダ
        const outTemp: OutputConfig = {
            label: 'temp_chunk',
            dirType: 'temp',
            customDir: '',
            nameMode: 'uuid', // 名前はGoに任せる
            nameValue: '',
            extension: 'mov',
            ffmpegOptions: [
                "-map", "[v_temp]", // フィルタで作った [v_temp] を映像ソースにする
                "-c:v", "libx265",
                "-crf", "23",
                "-tag:v", "hvc1",
                "-map_metadata", "0",
                "-map_metadata:s:v", "0:s:v",
                "-an",
            ]
        };

        const req: ProcessRequest = {
            fileId: taskId,
            input: { mode: 'single', paths: [file.path] },
            globalOptions: ["-filter_complex", globalFilter],
            outputs: [outMain, outTemp]
        };

        tasks.push({
            ...file, // 元の情報を引き継ぐ
            id: taskId,
            taskType: 'convert',
            processRequest: req,
            status: 'waiting',
            progress: 0,
            timeScale: output1TimeScale,
            // First output is 60x, Second is variable (speedFactor).
            // FFmpeg reporting typically follows the first output stream.
            // So we set expected duration based on Output 1 (fixed 60x).
            expectedDuration: file.duration / output1TimeScale
        });
    });

    // ------------ 連結タスク (Concat) の生成 ------------
    const concatId = crypto.randomUUID();
    const totalInputSize = files.reduce((acc, f) => acc + f.size, 0); // 合計サイズ計算

    const concatReq: ProcessRequest = {
        fileId: concatId,
        input: {
            mode: 'concat',
            paths: [] // 実行時に dependencyRefs から埋める
        },
        globalOptions: [],
        outputs: [{
            label: 'main',
            dirType: 'video',
            customDir: '',
            nameMode: 'fixed', // 名前指定
            nameValue: `Digest_${new Date().toISOString()
                .replace('T', '_')
                .replace(/:/g, '-')
                .replace(/\..+/, '')
                }`,
            extension: 'mov',
            ffmpegOptions: ["-c", "copy", "-an"] // 再エンコードなし
        }]
    };

    tasks.push({
        id: concatId,
        path: `🔃 Merging ${files.length} clips...`, // 表示名
        size: totalInputSize, // 合計サイズを表示上の「オリジナルサイズ」として扱う
        hasVideo: true, hasAudio: false, duration: params.targetDuration,
        taskType: 'concat',
        processRequest: concatReq,
        status: 'waiting',
        progress: 0,
        dependencyRefs: chunkRefs // どのタスクの結果を使うか
    });

    // ゴミ箱送りタスク (オプション)
    if (params.trashOriginal) {
        files.forEach(file => {
            tasks.push({
                id: crypto.randomUUID(),
                path: file.path, // 消す対象
                size: file.size,
                hasVideo: false, hasAudio: false, duration: 0,
                taskType: 'trash',
                status: 'waiting',
                progress: 0
            });
        });
    }

    return tasks;
};