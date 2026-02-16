import React, { useState, useEffect } from 'react';
import { GetAvailableEncoders, GetAvailableFormats, GetEncoderDefault } from "../../../wailsjs/go/main/App.js";

// レシピの定義
const RECIPES = [
    {
        id: 'dual_ff',
        name: 'Dual Time Compression (Fixed & Fit)',
        description: 'Creates two outputs: a high-speed log (60x) and a digest fitted to a specific duration. Ideal for archiving long work sessions.',
        hasParams: true // パラメータ設定が必要か
    },
    {
        id: 'resize',
        name: 'Advanced Resize & Convert',
        description: 'Convert videos with specific resolution, codec, and container settings. Supports metadata preservation.',
        hasParams: true
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
    const [rotation, setRotation] = useState("90"); // 回転設定

    // パラメータ (Resize用)
    const [resolution, setResolution] = useState(0); // 0=original
    const [videoCodec, setVideoCodec] = useState('libsvtav1');
    const [audioCodec, setAudioCodec] = useState('copy');
    const [container, setContainer] = useState('mp4');
    const [crf, setCrf] = useState(30);
    const [defaultCrf, setDefaultCrf] = useState(30); // 表示用デフォルト値
    const [keepMetadata, setKeepMetadata] = useState(true);
    const [useDefaultCrf, setUseDefaultCrf] = useState(true);

    // Lists for Resize UI
    const [videoEncoders, setVideoEncoders] = useState<string[]>([]);
    const [audioEncoders, setAudioEncoders] = useState<string[]>([]);
    const [formats, setFormats] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            GetAvailableEncoders().then((res: any) => {
                if (res && res.video) setVideoEncoders(res.video);
                if (res && res.audio) setAudioEncoders(res.audio);
            });
            GetAvailableFormats().then((res: string[]) => {
                if (res) setFormats(res);
            });
            // 初期コーデックのデフォルト値を取得
            GetEncoderDefault(videoCodec).then((def: number) => {
                const safeVal = def > 0 ? def : 23;
                setCrf(safeVal);
                setDefaultCrf(def);
                setUseDefaultCrf(true);
            });
        }
    }, [isOpen]);

    const handleVideoCodecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCodec = e.target.value;
        setVideoCodec(newCodec);

        // Backendからデフォルト値を取得
        GetEncoderDefault(newCodec).then((def: number) => {
            const safeVal = def > 0 ? def : 23;
            setCrf(safeVal);
            setDefaultCrf(def);
            setUseDefaultCrf(true);
        });
    };

    if (!isOpen) return null;

    const selectedRecipe = RECIPES.find(r => r.id === selectedId);

    const handleRunClick = () => {
        let params: any = {};

        if (selectedId === 'dual_ff') {
            params = {
                targetDuration,
                trashOriginal,
                rotation
            };
        } else if (selectedId === 'resize') {
            params = {
                resolution,
                videoCodec,
                audioCodec,
                container,
                crf: useDefaultCrf ? "" : String(crf),
                keepMetadata
            };
        }

        onRun(selectedId, params);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="window" style={{ width: '600px', maxWidth: '95vw' }}>
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

                    <div className="flex gap-2 max-h-[95%]">
                        {/* 左側: レシピリスト */}
                        <div className="sunken-panel bg-white w-1/2 overflow-y-auto p-0">
                            <ul className="select-none">
                                {RECIPES.map(recipe => (
                                    <li
                                        key={recipe.id}
                                        className={`cursor-pointer flex items-center gap-1 ${selectedId === recipe.id ? 'bg-[#000080] text-white border-dotted border-white' : ''}`}
                                        onClick={() => setSelectedId(recipe.id)}
                                    >
                                        <span>🤓</span>
                                        {recipe.name}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 右側: 説明とパラメータ */}
                        <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                            <fieldset className="flex-none p-2">
                                <legend>Description</legend>
                                <div>
                                    {selectedRecipe?.description}
                                </div>
                            </fieldset>

                            {/* パラメータ設定エリア (DualFF) */}
                            {selectedId === 'dual_ff' && (
                                <fieldset className="flex-1 p-2">
                                    <legend>Settings</legend>
                                    <div className="field-row">
                                        <label htmlFor="target-duration">Target (sec):</label>
                                        <input
                                            id="target-duration"
                                            type="number"
                                            className="w-16"
                                            value={targetDuration}
                                            onChange={(e) => setTargetDuration(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="field-row">
                                        <label htmlFor="rotation-select">Rotation:</label>
                                        <select
                                            id="rotation-select"
                                            value={rotation}
                                            onChange={(e) => setRotation(e.target.value)}
                                            style={{ width: '100px' }}
                                        >
                                            <option value="0">0°</option>
                                            <option value="90">90° CW</option>
                                            <option value="180">180°</option>
                                            <option value="270">270° CW</option>
                                        </select>
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

                            {/* パラメータ設定エリア (Resize) */}
                            {selectedId === 'resize' && (
                                <fieldset className="flex-1 p-2 flex flex-col gap-3">
                                    <legend className="mr-auto">Settings</legend>

                                    <div className="flex flex-col gap-1">
                                        <label htmlFor="resolution-input">Long Edge Resolution (px):</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                id="resolution-input"
                                                type="number"
                                                className="w-24"
                                                value={resolution}
                                                onChange={(e) => setResolution(Number(e.target.value))}
                                                min={0}
                                                step={2}
                                            />
                                            <span>(0 = Original)</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label htmlFor="container-select">Container Format:</label>
                                        <select
                                            id="container-select"
                                            value={container}
                                            onChange={(e) => setContainer(e.target.value)}
                                            className="w-full"
                                        >
                                            {formats.map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                            {!formats.includes('mp4') && <option value="mp4">mp4</option>}
                                            {!formats.includes('mov') && <option value="mov">mov</option>}
                                            {!formats.includes('mkv') && <option value="mkv">mkv</option>}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label htmlFor="video-codec-select">Video Codec:</label>
                                        <select
                                            id="video-codec-select"
                                            value={videoCodec}
                                            onChange={handleVideoCodecChange}
                                            className="w-full"
                                        >
                                            {videoEncoders.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="copy">copy (no re-encode)</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="crf-input">CRF (Quality):</label>
                                            <div className="flex items-center gap-1 text-sm">
                                                <input
                                                    type="checkbox"
                                                    id="use-default-crf"
                                                    checked={useDefaultCrf}
                                                    onChange={(e) => setUseDefaultCrf(e.target.checked)}
                                                />
                                                <label htmlFor="use-default-crf">Use Encoder Default</label>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                id="crf-input"
                                                type="number"
                                                className="w-24"
                                                value={crf}
                                                onChange={(e) => setCrf(Number(e.target.value))}
                                                disabled={useDefaultCrf}
                                                min={0}
                                                max={100}
                                            />
                                            {defaultCrf > 0 && (
                                                <span>
                                                    (Default: {defaultCrf})
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label htmlFor="audio-codec-select">Audio Codec:</label>
                                        <select
                                            id="audio-codec-select"
                                            value={audioCodec}
                                            onChange={(e) => setAudioCodec(e.target.value)}
                                            className="w-full"
                                        >
                                            {audioEncoders.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="copy">copy</option>
                                            <option value="none">none (remove audio)</option>
                                        </select>
                                    </div>

                                    <div className="field-row mt-2">
                                        <input
                                            type="checkbox"
                                            id="keepmeta"
                                            checked={keepMetadata}
                                            onChange={(e) => setKeepMetadata(e.target.checked)}
                                        />
                                        <label htmlFor="keepmeta">Copy Metadata</label>
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