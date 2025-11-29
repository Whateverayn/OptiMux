import React, { useState, useEffect } from "react";
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
    WindowIsMaximised,
    WindowIsFullscreen,
    WindowFullscreen,
    WindowUnfullscreen,
    Environment,
} from "../../../wailsjs/runtime/runtime.js";

export default function TitleBar() {
    // 最大化状態のステート
    const [isMaximized, setIsMaximized] = useState(false);
    const [platform, setPlatform] = useState<string>("windows");

    // ウィンドウのアクティブ状態管理
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        // OS判定
        Environment().then((env) => {
            setPlatform(env.platform); // "darwin" (macOS) or "windows"
        });

        // 状態をチェックする関数
        const updateState = async () => {
            const max = await WindowIsMaximised();
            const full = await WindowIsFullscreen();
            setIsMaximized(max || full);
        };

        // 初回チェック
        updateState();

        // ウィンドウのリサイズイベントを監視 (スナップやダブルクリック対策)
        window.addEventListener('resize', updateState);

        // フォーカス監視
        const handleFocus = () => setIsActive(true);
        const handleBlur = () => setIsActive(false);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        // クリーンアップ
        return () => {
            window.removeEventListener('resize', updateState);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // ボタンクリック時のラッパー
    const handleMaximizeClick = async (e: React.MouseEvent) => {
        const isOptionClick = e.altKey; // Mac: Option, Win: Alt

        if (platform === 'darwin') {
            // macOSの場合
            if (isOptionClick) {
                // Option + Click: 最大化 (Zoom)
                WindowToggleMaximise();
            } else {
                // Click: フルスクリーン (Spaces移動)
                const isFull = await WindowIsFullscreen();
                if (!isFull) {
                    WindowFullscreen();
                } else {
                    WindowUnfullscreen();
                }
            }
        } else {
            // Windowsの場合 (逆にする)
            if (isOptionClick) {
                // Alt + Click: フルスクリーン
                const isFull = await WindowIsFullscreen();
                if (!isFull) {
                    WindowFullscreen();
                } else {
                    WindowUnfullscreen();
                }
            } else {
                // Click: 最大化 (標準挙動)
                WindowToggleMaximise();
            }
        }

        // 状態更新
        setTimeout(() => {
            WindowIsMaximised().then((m) => {
                WindowIsFullscreen().then((f) => setIsMaximized(m || f));
            });
        }, 100);
    };

    return (
        <div
            className={`title-bar ${isActive ? '' : 'inactive'}`}
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
            onDoubleClick={handleMaximizeClick}
        >
            <div className="title-bar-text" onDoubleClick={handleMaximizeClick}>
                <span>🌋 OptiMux</span>
            </div>
            <div className="title-bar-controls">
                <button
                    aria-label="Minimize"
                    onClick={WindowMinimise}
                    style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
                />
                <button
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                    onClick={handleMaximizeClick}
                    style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
                    title={platform === 'darwin'
                        ? "Click: Full Screen / Opt+Click: Maximize"
                        : "Click: Maximize / Alt+Click: Full Screen"}
                />
                <button
                    aria-label="Close"
                    onClick={Quit}
                    style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
                />
            </div>
        </div>
    );
}