import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';

interface Props {
    value?: number; // 0-100 の進捗率
    duration?: number; // 何秒でフルにするか
    variant?: 'default' | 'success' | 'error'; // 色
    className?: string; // 高さ
}

export default function ProgressBar({ value, duration, variant = 'default', className = "h-6" }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [blockCount, setBlockCount] = useState(20); // 初期値
    const [filledBlocks, setFilledBlocks] = useState(0);

    // ブロックの設定
    const BLOCK_WIDTH = 10; // ブロックの幅(px)
    const GAP = 2;          // 隙間(px)

    // 幅に応じてブロック数を計算する (ResizeObserver)
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const updateBlocks = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                // コンテナのpadding(4px)を引いて計算
                const availableWidth = width - 8;
                // 収まるブロック数を計算
                const count = Math.floor(availableWidth / (BLOCK_WIDTH + GAP));
                setBlockCount(Math.max(1, count));
            }
        };

        const observer = new ResizeObserver(updateBlocks);
        observer.observe(containerRef.current);

        // 初回実行
        updateBlocks();

        return () => observer.disconnect();
    }, []);

    // 進捗の計算
    useEffect(() => {
        // value が渡された場合
        if (typeof value === 'number') {
            // 0-100% をブロック数に変換
            const target = Math.round((Math.max(0, Math.min(100, value)) / 100) * blockCount);
            setFilledBlocks(target);
            return;
        }

        // duration が渡された場合
        if (duration && duration > 0) {
            setFilledBlocks(0);
            const intervalTime = (duration * 1000) / blockCount;

            const timer = setInterval(() => {
                setFilledBlocks(prev => {
                    if (prev >= blockCount) {
                        clearInterval(timer);
                        return prev;
                    }
                    return prev + 1;
                });
            }, intervalTime);

            return () => clearInterval(timer);
        }
    }, [value, duration, blockCount]);

    // 色の決定
    const getBlockColor = () => {
        switch (variant) {
            case 'success': return 'bg-[#008000]'; // 緑
            case 'error': return 'bg-[#800000]'; // 赤
            default: return 'bg-[#000080]'; // 標準
        }
    };

    const blockColorClass = getBlockColor();

    return (
        <div
            ref={containerRef}
            className={`w-full bg-white p-1 flex gap-[2px] shadow-[inset_-2px_-2px_#dfdfdf,inset_2px_2px_#808080] ${className}`}
        >
            {/* ブロックをレンダリング */}
            {Array.from({ length: blockCount }).map((_, i) => (
                <div
                    key={i}
                    className={`h-full flex-1 ${i < filledBlocks ? blockColorClass : 'bg-transparent'}`}
                ></div>
            ))}
        </div>
    );
}