// components/views/FluentDashboard.tsx

import React from 'react';
import {
    FluentProvider,
    webDarkTheme,
    ProgressBar,
    Card,
    Body1 as Body1Original,
    Caption1 as Caption1Original,
    Subtitle1,
    Display,
    makeStyles,
    shorthands,
    tokens
} from '@fluentui/react-components';

// Fix for strict type checking with React 18 types
const Body1 = Body1Original as any;
const Caption1 = Caption1Original as any;
import { MediaInfo, BatchStatus } from "../../types.js";

// 親で計算している統計情報の型定義
export interface DashboardStats {
    encodedSize: number;
    predictedSize: number;
    reductionRate: number;
    elapsed: number;
    eta: number;
    speed: number;
}

interface Props {
    currentFile: MediaInfo;
    stats: DashboardStats;
    batchStatus: BatchStatus;
    finishTimeStr: string;
    formatBytes: (n: number) => string;
    formatTime: (n: number) => string;
    getFileName: (p: string) => string;
}

// SVG円グラフコンポーネント (軽量版)
const DonutChart = ({ percentage, color }: { percentage: number, color: string }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div style={{ width: '48px', height: '48px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                {/* 背景の円 */}
                <circle cx="20" cy="20" r={radius} fill="transparent" stroke={tokens.colorNeutralStroke2} strokeWidth="4" />
                {/* 進捗の円 */}
                <circle
                    cx="20" cy="20" r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <div style={{ position: 'absolute', fontSize: '10px', fontWeight: 'bold', color: tokens.colorNeutralForeground1 }}>
                {Math.round(percentage)}%
            </div>
        </div>
    );
};

// Griffel (CSS-in-JS) スタイル定義
const useStyles = makeStyles({
    fluentWrapper: {
        ...shorthands.padding('12px'),
        backgroundColor: tokens.colorNeutralBackground2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    titleGroup: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        overflow: 'hidden',
    },
    iconBox: {
        minWidth: '32px',
        minHeight: '32px',
        backgroundColor: tokens.colorNeutralBackground1Hover,
        ...shorthands.borderRadius('4px'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
    },
    fileInfo: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    progressBarArea: {
        marginBottom: '8px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px',
    },
    card: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    // カード内の左右レイアウト用
    cardRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    // カード内のテキスト積み上げ用
    textStack: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    percentageText: {
        fontSize: '24px',
        fontWeight: '600',
    },
    boldText: {
        fontWeight: '600', // Semibold
    },
    subText: {
        color: tokens.colorNeutralForeground3, // 薄い文字色
    }
});

export default function FluentDashboard({
    currentFile,
    stats,
    batchStatus,
    finishTimeStr,
    formatBytes,
    formatTime,
    getFileName
}: Props) {
    const styles = useStyles();

    // 圧縮レシオ (現在 / 元サイズ)
    const ratio = currentFile.size > 0
        ? (stats.predictedSize / currentFile.size) * 100
        : 0;

    const chartColor = ratio > 100
        ? tokens.colorPaletteYellowForeground1
        : tokens.colorBrandForeground1;

    return (
        // ここでテーマを適用。これより下はFluent UIのデザインルールになる
        <div className='sunken-panel'>
            <FluentProvider theme={webDarkTheme}>
                <div className={styles.fluentWrapper}>
                    {/* ヘッダー */}
                    <div className={styles.header}>
                        <div className={styles.titleGroup}>
                            <div className={`${styles.iconBox} ${((currentFile.progress || 0) < 1 || stats.elapsed < 10) ? 'dirty-bounce' : ''}`}>👺</div>
                            <div className={styles.fileInfo}>
                                <Caption1>Processing Status</Caption1>
                                <Body1 className={styles.boldText} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {getFileName(currentFile.path)}
                                </Body1>
                            </div>
                        </div>
                        {/* パーセント表示 */}
                        <div className={styles.percentageText}>
                            {Math.round(currentFile.progress || 0)}%
                        </div>
                    </div>

                    {/* プログレスバー */}
                    <div className={styles.progressBarArea}>
                        <ProgressBar
                            value={(currentFile.progress || 0) / 100}
                            color="brand"
                            shape="rounded"
                            thickness="large"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <Caption1>Encoding...</Caption1>
                            <Caption1>{formatTime(stats.eta)} remaining</Caption1>
                        </div>
                    </div>

                    {/* グリッドカード */}
                    <div className={styles.grid}>

                        {/* 圧縮率カード */}
                        <Card className={styles.card}>
                            <div className={styles.cardRow}>
                                <div className={styles.textStack}>
                                    <Caption1 className={styles.subText}>COMPRESSION</Caption1>
                                    <Body1 className={styles.boldText}>{formatBytes(stats.encodedSize)}</Body1>
                                    <Caption1>Est: {formatBytes(stats.predictedSize || 0)}</Caption1>
                                </div>
                                {/* 円グラフ */}
                                {stats.predictedSize > 0 && (
                                    <DonutChart percentage={ratio} color={chartColor} />
                                )}
                            </div>
                        </Card>

                        {/* 時間カード */}
                        <Card className={styles.card}>
                            <div className={styles.textStack}>
                                <Caption1 className={styles.subText}>TIME</Caption1>
                                <Body1 className={styles.boldText}>{formatTime(stats.elapsed)}</Body1>
                                <Caption1>End: {batchStatus !== 'idle' ? finishTimeStr : '--:--'}</Caption1>
                            </div>
                        </Card>

                        {/* 速度カード */}
                        <Card className={styles.card}>
                            <div className={styles.textStack}>
                                <Caption1 className={styles.subText}>SPEED</Caption1>
                                <Body1 className={styles.boldText}>x{stats.speed.toFixed(2)}</Body1>
                                <Caption1 className={styles.subText}>Average</Caption1>
                            </div>
                        </Card>
                    </div>
                </div>
            </FluentProvider>
        </div>
    );
}