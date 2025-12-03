// frontend/src/utils/recipes/normal.ts

import { MediaInfo, ProcessRequest } from "../../types.js";
import { createConvertRequest } from "../commandFactory.js";

// 通常変換用の設定
export type NormalParams = {
    codec: string;
    audio: string;
};

export const generateNormalTasks = (
    files: MediaInfo[],
    params: NormalParams
): MediaInfo[] => {
    
    return files.map(file => {
        // ファクトリーを使ってリクエストを作成
        const req: ProcessRequest = createConvertRequest(file, {
            codec: params.codec,
            audio: params.audio
        });

        // タスクオブジェクトとして整形して返す
        return {
            ...file, // 元の情報をコピー (path, size, duration等)
            
            // タスク実行用の新しいIDを発行してもいいが、
            // 通常変換は「1ファイル1タスク」なので、管理しやすくするために元のIDを維持してもOK。
            // ここでは念のため、実行履歴管理の観点からコピーとして扱います。
            // (ただし、App.tsxで fileList と taskList を別管理するようになったので、IDが同じだとReactのkeyで警告が出るかも？
            //  -> SetupViewとProcessingViewは同時に出ないので大丈夫ですが、安全のためIDは分けません。
            //     進捗更新のref追跡が楽だからです。)
            
            taskType: 'convert',     // 通常変換
            processRequest: req,     // 生成したリクエスト
            status: 'waiting',
            progress: 0,
            
            // 出力パスなどは実行後に埋まる
            encodedSize: 0,
            outputPath: undefined
        };
    });
};