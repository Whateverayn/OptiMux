import React, { useEffect } from 'react';

interface Props {
    onRun?: () => void;
    onDelete?: () => void;
    onBack?: () => void;
    onOpen?: () => void;
    onRunAdv?: () => void;
    canRun: boolean;
    canDelete: boolean;
    mode: 'setup' | 'processing';
}

export default function FunctionKeyFooter({ onRun, onDelete, onBack, onOpen, onRunAdv, canRun, canDelete, mode }: Props) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.querySelector('.modal-open')) return;

            if (mode === 'setup') {
                switch (e.key) {
                    case 'F3':
                        e.preventDefault();
                        onOpen?.();
                        break;
                    case 'F5':
                        if (canRun) {
                            e.preventDefault();
                            onRun?.();
                        } break;
                    case 'F6':
                        if (canRun) {
                            e.preventDefault();
                            onRunAdv?.();
                        } break;
                    case 'F8':
                        if (canDelete) {
                            e.preventDefault();
                            onDelete?.();
                        } break;
                }
            }
            switch (e.key) {
                case 'F1':
                    e.preventDefault();
                    // onHelp?.();
                    break;
                case 'F12':
                    e.preventDefault();
                    onBack?.();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onRun, onDelete, onBack, onOpen, canRun, canDelete, mode]);

    // ボタン描画用サブコンポーネント
    const FooterBtn = ({
        fKey, label, onClick, disabled, active = false
    }: {
        fKey: string, label: string, onClick?: () => void, disabled?: boolean, active?: boolean
    }) => {
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className="flex-1 text-left font-bold truncate !px-1"
            >
                {/* Fキー部分は赤文字 (無効時はグレー) */}
                <span className={`mr-0.5 ${disabled ? 'text-gray-400' : 'text-red-800'}`}>
                    {fKey}
                </span>
                {label}
            </button>
        );
    };

    // スペーサー (グループ分け用)
    const Spacer = () => <div className="w-2 shrink-0"></div>;

    return (
        <div className="select-none status-bar">
            <div className="flex status-bar-field">
                {/* General */}
                <FooterBtn fKey="F1" label="Help" disabled={true} />
                <FooterBtn fKey="F2" label="" disabled={true} />
                <FooterBtn fKey="F3" label="Open" disabled={mode !== 'setup'} onClick={onOpen} />
                <FooterBtn fKey="F4" label="" disabled={true} />
            </div>
            <div className='status-bar-field flex'>
                {/* Action */}
                <FooterBtn fKey="F5" label="Run" disabled={mode !== 'setup' || !canRun} onClick={onRun} />
                <FooterBtn fKey="F6" label="Adv.Run" disabled={mode !== 'setup' || !canRun} onClick={onRunAdv} />
                <FooterBtn fKey="F7" label="" disabled={true} />
                <FooterBtn fKey="F8" label="Trash" disabled={mode !== 'setup' || !canDelete} onClick={onDelete} />
            </div>
            <div className='status-bar-field flex'>
                {/* System */}
                <FooterBtn fKey="F9" label="" disabled={true} />
                <FooterBtn fKey="F10" label="" disabled={true} />
                <FooterBtn fKey="F11" label="" disabled={true} />
                <FooterBtn fKey="F12" label={mode === 'setup' ? 'Exit' : 'Back'} onClick={onBack} />
            </div>
        </div>
    );
}