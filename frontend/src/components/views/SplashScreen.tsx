import React from 'react';
import ProgressBar from "../../components/ui/ProgressBar.js";

export default function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center cursor-wait select-none">
            {/* メインボックス */}
            <div className="window w-[400px] h-auto p-4 flex flex-col shadow-2xl relative">

                {/* タイトルバー */}
                <div className="title-bar">
                    <div className="title-bar-text">OptiMux Startup</div>
                </div>

                <div className="window-body flex-1 flex flex-col items-center justify-center gap-6 text-center py-8" style={{paddingBottom: "0px"}}>

                    {/* ロゴエリア */}
                    <div className="flex flex-col items-center">
                        <div className="text-8xl mb-2 animate-bounce">🌋</div>
                        <h1 className="text-3xl font-bold tracking-widest text-[#000080]" style={{ textShadow: "2px 2px 0px #ffffffff" }}>
                            OptiMux
                        </h1>
                        <p className="text-sm font-bold text-gray-500">Version 1.0.0-rc1</p>
                    </div>

                    <ProgressBar duration={3} className="h-8"></ProgressBar>
                </div>
            </div>
        </div>
    );
}