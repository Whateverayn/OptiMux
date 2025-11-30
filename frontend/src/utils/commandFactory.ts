// frontend/src/utils/commandFactory.ts

import { MediaInfo, ProcessRequest, OutputConfig } from "../types.js";

// UIから受け取る設定値
export type ConversionSettings = {
    codec: string; // 'hevc' | 'av1'
    audio: string; // 'copy' | 'none'
};

export const createConvertRequest = (
    file: MediaInfo,
    settings: ConversionSettings
): ProcessRequest => {
    
    // 基本リクエストの枠作成
    const req: ProcessRequest = {
        fileId: file.id,
        input: {
            mode: 'single',
            paths: [file.path],
        },
        globalOptions: [],
        outputs: []
    };

    // メイン出力の設定 (OutputConfig) 作成
    const mainOutput: OutputConfig = {
        label: 'main', // 識別子
        dirType: file.outputType || 'same', // 指定がなければ同階層
        customDir: '',
        nameMode: 'auto',
        nameValue: `_${settings.codec}`, // suffix (例: _hevc)
        extension: 'mp4',
        ffmpegOptions: []
    };

    // エンコードオプションの組み立て
    // Codec
    if (settings.codec === 'av1') {
        // SVT-AV1
        mainOutput.ffmpegOptions.push("-c:v", "libsvtav1", "-crf", "32", "-preset", "8");
    } else {
        // HEVC (x265)
        mainOutput.ffmpegOptions.push("-c:v", "libx265", "-crf", "23", "-tag:v", "hvc1", "-preset", "medium");
    }

    // Audio
    if (settings.audio === 'none') {
        mainOutput.ffmpegOptions.push("-an");
    } else {
        mainOutput.ffmpegOptions.push("-c:a", "copy");
    }

    // Metadata
    mainOutput.ffmpegOptions.push("-map_metadata", "0");

    // リクエストに追加
    req.outputs.push(mainOutput);

    return req;
};