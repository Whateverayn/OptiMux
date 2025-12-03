import React, { useState } from 'react';

// レシピの定義
const RECIPES = [
    {
        id: 'dual_ff',
        name: 'Dual Time Compression (Fixed & Fit)',
        description: 'Creates two outputs: a high-speed log (60x) and a digest fitted to a specific duration. Ideal for archiving long work sessions.',
        hasParams: true // パラメータ設定が必要か
    },
    {
        id: 'concat_only',
        name: 'Simple Concatenation',
        description: 'Merges multiple video files into one without re-encoding. Files must have the same codec/resolution.',
        hasParams: false
    }
    // 将来ここに追加していく
];

interface Props {
    isOpen: boolean;
    onRun: (recipeId: string, params: any) => void;
    onCancel: () => void;
}

export default function RecipeSelectDialog({ isOpen, onRun, onCancel }: Props) {
    const [selectedId, setSelectedId] = useState<string>(RECIPES[0].id);
    
    // パラメータ (DualFF用)
    const [targetDuration, setTargetDuration] = useState(60);
    const [trashOriginal, setTrashOriginal] = useState(false);

    if (!isOpen) return null;

    const selectedRecipe = RECIPES.find(r => r.id === selectedId);

    const handleRunClick = () => {
        // パラメータをまとめて渡す
        const params = {
            targetDuration,
            trashOriginal
        };
        onRun(selectedId, params);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="window" style={{ width: '500px', maxWidth: '95vw' }}>
                <div className="title-bar">
                    <div className="title-bar-text">🌵 Advanced Processing Tasks</div>
                    <div className="title-bar-controls">
                        <button aria-label="Close" onClick={onCancel}></button>
                    </div>
                </div>

                <div className="window-body flex flex-col gap-4">
                    <div className="flex gap-4">
                        <div className="w-16 text-4xl text-center">🧙‍♂️</div>
                        <div>
                            <p>Select a processing recipe to execute:</p>
                        </div>
                    </div>

                    <div className="flex gap-2 h-64">
                        {/* 左側: レシピリスト */}
                        <div className="sunken-panel bg-white w-1/2 overflow-y-auto p-0">
                            <ul className="select-none">
                                {RECIPES.map(recipe => (
                                    <li 
                                        key={recipe.id}
                                        className={`px-2 cursor-pointer flex items-center gap-1 ${selectedId === recipe.id ? 'bg-[#000080] text-white border-dotted border-white' : ''}`}
                                        onClick={() => setSelectedId(recipe.id)}
                                    >
                                        <span>⚡</span>
                                        {recipe.name}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 右側: 説明とパラメータ */}
                        <div className="flex-1 flex flex-col gap-2">
                            <fieldset className="flex-1 p-2">
                                <legend>Description</legend>
                                <div>
                                    {selectedRecipe?.description}
                                </div>
                            </fieldset>

                            {/* パラメータ設定エリア (DualFFが選ばれている時だけ表示) */}
                            {selectedId === 'dual_ff' && (
                                <fieldset className="p-2">
                                    <legend>Settings</legend>
                                    <div className="field-row">
                                        <label>Target (sec):</label>
                                        <input 
                                            type="number" 
                                            className="w-16" 
                                            value={targetDuration} 
                                            onChange={(e) => setTargetDuration(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="field-row">
                                        <input 
                                            type="checkbox" 
                                            id="trash" 
                                            checked={trashOriginal}
                                            onChange={(e) => setTrashOriginal(e.target.checked)}
                                        />
                                        <label htmlFor="trash">Trash Originals</label>
                                    </div>
                                </fieldset>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={handleRunClick} className="font-bold px-4 min-w-[80px]">Run</button>
                        <button onClick={onCancel} className="px-4">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}