import React, { useEffect } from 'react';

interface Props {
    onRun?: () => void;
    onDelete?: () => void;
    onBack?: () => void;
    canRun: boolean;
    canDelete: boolean;
    mode: 'setup' | 'processing';
}

export default function FunctionKeyFooter({ onRun, onDelete, onBack, canRun, canDelete, mode }: Props) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // モーダル表示中は操作させない等の制御が必要ならここに
            switch (e.key) {
                case 'F5': if (mode === 'setup' && canRun && onRun) { e.preventDefault(); onRun(); } break;
                case 'F8': if (mode === 'setup' && canDelete && onDelete) { e.preventDefault(); onDelete(); } break;
                case 'F12': if (onBack) { e.preventDefault(); onBack(); } break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onRun, onDelete, onBack, canRun, canDelete, mode]);

    return (
        <div className="mt-auto border-t border-white pt-1 bg-gray-200 select-none">
            <div className="flex gap-1 p-1 bg-gray-200 text-xs font-bold font-mono">
                <button className="flex-1 px-2 py-1 min-w-0 truncate text-left border-2 border-gray-400 bg-gray-300 text-gray-500 shadow-none"><span className="text-red-800 mr-1">F1</span>Help</button>
                <div className="flex-[0.5]"></div>
                <button onClick={onRun} disabled={!canRun || mode !== 'setup'} className={`flex-1 px-2 py-1 min-w-0 truncate text-left border-2 ${canRun && mode === 'setup' ? 'border-gray-600 bg-gray-100' : 'border-gray-300 bg-gray-200 text-gray-400 shadow-none'}`}><span className="text-red-800 mr-1">F5</span>Run</button>
                <button onClick={onDelete} disabled={!canDelete || mode !== 'setup'} className={`flex-1 px-2 py-1 min-w-0 truncate text-left border-2 ${canDelete && mode === 'setup' ? 'border-gray-600 bg-gray-100' : 'border-gray-300 bg-gray-200 text-gray-400 shadow-none'}`}><span className="text-red-800 mr-1">F8</span>Trash</button>
                <div className="flex-[0.5]"></div>
                <button onClick={onBack} className="flex-1 px-2 py-1 min-w-0 truncate text-left border-2 border-gray-600 bg-gray-100"><span className="text-red-800 mr-1">F12</span>{mode === 'setup' ? 'Exit' : 'Back'}</button>
            </div>
        </div>
    );
}