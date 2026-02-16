import { MediaInfo, ProcessRequest, OutputConfig } from "../../types.js";

export type ResizeParams = {
    resolution: number;     // 0 = original
    videoCodec: string;
    audioCodec: string;
    container: string;      // "mp4", "mov", "mkv", etc.
    crf?: string;           // Quality (string input from UI, e.g. "23")
    keepMetadata: boolean;
};

export const generateResizeTasks = (
    files: MediaInfo[],
    params: ResizeParams
): MediaInfo[] => {
    const tasks: MediaInfo[] = [];

    files.forEach(file => {
        // --- 1. Conversion Task ---
        const convertTaskId = crypto.randomUUID();

        const filterComplex: string[] = [];
        // Scaling logic
        if (params.resolution > 0) {
            // scale='if(gt(iw,ih),TARGET,-2)':'if(gt(iw,ih),-2,TARGET)'
            // 長辺を target に合わせる (-2 は偶数丸め)
            const target = params.resolution;
            // エスケープに注意: filter_complex内で使うので単純な文字列でOK
            filterComplex.push(`scale='if(gt(iw,ih),${target},-2)':'if(gt(iw,ih),-2,${target})'`);
        }

        const globalOptions: string[] = [];
        if (filterComplex.length > 0) {
            globalOptions.push("-filter_complex", filterComplex.join(","));
        }

        const outMain: OutputConfig = {
            label: 'main',
            dirType: 'video', // 出力先はVideosフォルダ等
            customDir: '',
            nameMode: 'auto',
            nameValue: `_${params.videoCodec}_${params.resolution || 'org'}`,
            extension: params.container || 'mp4',
            ffmpegOptions: []
        };

        // Video Codec
        outMain.ffmpegOptions.push("-c:v", params.videoCodec);

        // CRF (if specified and valid)
        if (params.crf && params.crf.trim() !== "") {
            if (params.videoCodec.includes("videotoolbox")) {
                // Videotoolbox uses -q:v (0-100, higher is better) instead of CRF
                // Note: The UI currently implies "Lower is better", which is inverse for Videotoolbox.
                // We pass the value as-is for now, assuming the default (e.g. 65) guides the user.
                outMain.ffmpegOptions.push("-q:v", params.crf);
            } else {
                outMain.ffmpegOptions.push("-crf", params.crf);
            }
        }

        // H.265 tag (just in case)
        if (params.videoCodec.includes("libx265") || params.videoCodec.includes("hevc")) {
            outMain.ffmpegOptions.push("-tag:v", "hvc1");
        }

        // Audio Codec
        if (params.audioCodec === 'none') {
            outMain.ffmpegOptions.push("-an");
        } else {
            outMain.ffmpegOptions.push("-c:a", params.audioCodec);
        }

        // Standard map metadata (copies basic tags)
        outMain.ffmpegOptions.push("-map_metadata", "0");

        const req: ProcessRequest = {
            fileId: convertTaskId,
            input: { mode: 'single', paths: [file.path] },
            globalOptions: globalOptions,
            outputs: [outMain]
        };

        tasks.push({
            ...file,
            id: convertTaskId,
            taskType: 'convert',
            processRequest: req,
            status: 'waiting',
            progress: 0,
            expectedDuration: file.duration
        });

        // --- 2. ExifTool Task (Optional) ---
        if (params.keepMetadata) {
            const exifTaskId = crypto.randomUUID();
            tasks.push({
                id: exifTaskId,
                // src: file.path (Original)
                // dst: resolved from convertTask
                path: `Metadata Copy`, // 表示用
                size: 0,
                hasVideo: false, hasAudio: false, duration: 0,
                taskType: 'exiftool',
                status: 'waiting',
                progress: 0,
                dependencyRefs: [`ref:${convertTaskId}`], // 依存関係: Convertが終わってから
                // Original path is stored in 'path' of this task? No, 'path' is mostly for display or logic.
                // We need a way to pass the original source path.
                // We can abuse 'processRequest' input paths or add a custom field.
                // Let's use `processRequest.input.paths[0]` as the Source (Original)
                // and the Destination will be resolved from dependencyRefs.
                processRequest: {
                    fileId: exifTaskId,
                    input: { mode: 'single', paths: [file.path] }, // Source = Original File
                    globalOptions: [],
                    outputs: []
                }
            });
        }
    });

    return tasks;
};
