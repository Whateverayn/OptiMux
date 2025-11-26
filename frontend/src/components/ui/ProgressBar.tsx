import React, { useEffect, useState } from 'react';

interface Props {
    duration: number; // 何秒でフルにするか
}

export default function ProgressBar({ duration }: Props) {
    const BLOCK_COUNT = 24; // ブロックの総数
    const [filledBlocks, setFilledBlocks] = useState(0);

    useEffect(() => {
        if (duration <= 0) {
            setFilledBlocks(BLOCK_COUNT);
            return;
        }

        const intervalTime = (duration * 1000) / BLOCK_COUNT;

        const timer = setInterval(() => {
            setFilledBlocks(prev => {
                if (prev >= BLOCK_COUNT) {
                    clearInterval(timer);
                    return prev;
                }
                return prev + 1;
            });
        }, intervalTime);

        return () => {
            clearInterval(timer);
            setFilledBlocks(0);
        }
    }, [duration]);

    return (
        <div className="w-full h-8 bg-white p-1 flex gap-[2px] shadow-[inset_-2px_-2px_#dfdfdf,inset_2px_2px_#808080]">
            {/* ブロックをレンダリング */}
            {Array.from({ length: BLOCK_COUNT }).map((_, i) => (
                <div
                    key={i}
                    className={`h-full flex-1 ${i < filledBlocks ? 'bg-[#000080]' : 'bg-transparent'}`}
                ></div>
            ))}
        </div>
    );
}