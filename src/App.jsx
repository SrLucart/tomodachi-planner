import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Save,
    Upload,
    RotateCw,
    Trash2,
    Brush,
    Eraser,
    ZoomIn,
    ZoomOut,
    MousePointer2,
    Map,
    Building,
    Undo,
    Redo,
    Globe
} from 'lucide-react';

const GRID_W = 118;
const GRID_H = 78;

const TERRAINS = [
    { id: 0, name: { en: 'Sea (Water)', pt: 'Mar (Água)' }, color: '#0284c7' },
    { id: 1, name: { en: 'Sand (Beach)', pt: 'Areia (Praia)' }, color: '#fde047' },
    { id: 2, name: { en: 'Grass', pt: 'Grama' }, color: '#4ade80' },
    { id: 3, name: { en: 'Concrete', pt: 'Cimento' }, color: '#94a3b8' },
    { id: 4, name: { en: 'Asphalt', pt: 'Asfalto' }, color: '#334155' },
    { id: 5, name: { en: 'Dirt', pt: 'Terra' }, color: '#a16207' },
];

const BUILDINGS = {
    mii_house: { id: 'mii_house', name: { en: 'Individual Mii House', pt: 'Casa Mii Individual' }, w: 3, h: 4, color: '#facc15' },
    shared_house: { id: 'shared_house', name: { en: 'Shared House', pt: 'Casa Conjunta' }, w: 6, h: 4, color: '#f97316' },
    shop: { id: 'shop', name: { en: 'Shop', pt: 'Loja' }, w: 4, h: 4, color: '#ef4444' },
    ferris_wheel: { id: 'ferris_wheel', name: { en: 'Ferris Wheel', pt: 'Roda Gigante' }, w: 9, h: 6, color: '#a855f7' },
    marketplace: { id: 'marketplace', name: { en: 'Marketplace', pt: 'Marketplace' }, w: 3, h: 3, color: '#10b981' },
    news_tower: { id: 'news_tower', name: { en: 'News Tower', pt: 'Torre de Notícias' }, w: 4, h: 4, color: '#3b82f6' },
    restaurant: { id: 'restaurant', name: { en: 'Restaurant', pt: 'Restaurante' }, w: 6, h: 5, color: '#ec4899' },
    custom: { id: 'custom', name: { en: 'Custom Lot', pt: 'Lote Personalizado' }, w: 1, h: 1, color: '#14b8a6' },
};

// Dicionário de Traduções
const TRANSLATIONS = {
    en: {
        terrainTab: 'Terrain', buildingTab: 'Buildings', terrainPaint: 'Terrain Paint', brushSize: 'Brush Size',
        blueprints: 'Blueprints', normal: 'Normal', rotated: 'Rotated', tiles: 'tiles', tile: 'tile',
        shortcutRot: 'Shortcut: Space or R', tipRot: 'Tip: Use the Space key to rotate quickly.',
        width: 'Width', depth: 'Depth', actions: 'Actions', cursor: 'Cursor', shortcutEsc: 'Shortcut: Esc',
        eraser: 'Eraser', clear: 'Clear', save: 'Save', open: 'Open', zoomIn: 'Zoom In', zoomOut: 'Zoom Out',
        clearTitle: 'Clear Island?', clearDesc: 'Are you sure you want to clear all terrain and buildings? This action cannot be undone.',
        cancel: 'Cancel', confirmClear: 'Yes, clear everything', invalidFile: 'Invalid project file.',
        undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y or Ctrl+Shift+Z)'
    },
    pt: {
        terrainTab: 'Terreno', buildingTab: 'Edifícios', terrainPaint: 'Pintura de Solo', brushSize: 'Tamanho do Pincel',
        blueprints: 'Projetos', normal: 'Normal', rotated: 'Girado', tiles: 'tiles', tile: 'tile',
        shortcutRot: 'Atalho: Espaço ou R', tipRot: 'Dica: Use a tecla Espaço para girar rapidamente.',
        width: 'Largura', depth: 'Profund.', actions: 'Ações', cursor: 'Cursor', shortcutEsc: 'Atalho: Esc',
        eraser: 'Borracha', clear: 'Limpar', save: 'Salvar', open: 'Abrir', zoomIn: 'Aproximar', zoomOut: 'Afastar',
        clearTitle: 'Limpar Ilha?', clearDesc: 'Tem certeza que deseja apagar todo o terreno e os edifícios? Esta ação não pode ser desfeita.',
        cancel: 'Cancelar', confirmClear: 'Sim, limpar tudo', invalidFile: 'Arquivo de projeto inválido.',
        undo: 'Desfazer (Ctrl+Z)', redo: 'Refazer (Ctrl+Y ou Ctrl+Shift+Z)'
    }
};

export default function App() {
    // State for UI
    const [lang, setLang] = useState('en'); // Default to English
    const t = TRANSLATIONS[lang]; // Shortcut for translations

    const [activeTab, setActiveTab] = useState('terrain');
    const [tool, setTool] = useState('paint');
    const [selectedTerrain, setSelectedTerrain] = useState(2);
    const [selectedBuilding, setSelectedBuilding] = useState('mii_house');
    const [brushSize, setBrushSize] = useState(1);
    const [zoom, setZoom] = useState(15);
    const [isRotated, setIsRotated] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Custom Building Dimensions
    const [customW, setCustomW] = useState(2);
    const [customH, setCustomH] = useState(2);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Estado para armazenar o edifício sendo movido
    const [movingState, setMovingState] = useState(null);

    // Refs for Data & Canvas 
    const gridData = useRef(new Uint8Array(GRID_W * GRID_H));
    const buildingsData = useRef([]);
    const history = useRef([]);
    const redoStack = useRef([]);
    const hasSavedStroke = useRef(false);
    const canvasRef = useRef(null);
    const hoverCanvasRef = useRef(null);
    const isMouseDown = useRef(false);
    const mousePos = useRef({ x: -1, y: -1 });

    // --------------------------------------------------------
    // Logic Helpers (Movidos para cima e como function para evitar erro de hoisting)
    // --------------------------------------------------------
    function isSpaceFree(x, y, w, h) {
        if (x + w > GRID_W || y + h > GRID_H) return false;
        return !buildingsData.current.some(b =>
            x < b.x + b.w && x + w > b.x &&
            y < b.y + b.h && y + h > b.y
        );
    }

    function removeBuildingAt(x, y) {
        const initialLen = buildingsData.current.length;
        buildingsData.current = buildingsData.current.filter(b =>
            !(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)
        );
        return buildingsData.current.length !== initialLen;
    }

    // Função unificada para trocar a ferramenta de forma segura
    const handleSetTool = (newTool) => {
        if (newTool !== 'pointer' && movingState) {
            buildingsData.current.push(movingState.original);
            setMovingState(null);
            drawBase();
        }
        setTool(newTool);
    };

    // --------------------------------------------------------
    // Core Drawing Logic
    // --------------------------------------------------------
    const drawBase = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear & draw sea background
        ctx.fillStyle = TERRAINS[0].color;
        ctx.fillRect(0, 0, GRID_W * zoom, GRID_H * zoom);

        // Draw grid terrains
        for (let i = 0; i < gridData.current.length; i++) {
            const terrainId = gridData.current[i];
            if (terrainId !== 0) {
                const x = i % GRID_W;
                const y = Math.floor(i / GRID_W);
                ctx.fillStyle = TERRAINS[terrainId].color;
                ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
            }
        }

        // Draw grid lines
        if (zoom >= 10) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= GRID_W; x++) { ctx.moveTo(x * zoom, 0); ctx.lineTo(x * zoom, GRID_H * zoom); }
            for (let y = 0; y <= GRID_H; y++) { ctx.moveTo(0, y * zoom); ctx.lineTo(GRID_W * zoom, y * zoom); }
            ctx.stroke();
        }

        // Draw buildings
        buildingsData.current.forEach((b) => {
            const rx = b.x * zoom;
            const ry = b.y * zoom;
            const rw = b.w * zoom;
            const rh = b.h * zoom;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(rx + 2, ry + 2, rw, rh);

            // Building Box
            ctx.fillStyle = BUILDINGS[b.type].color;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.strokeRect(rx, ry, rw, rh);

            // Inner details 
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);

            // Text
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${Math.max(10, zoom / 1.5)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const text = BUILDINGS[b.type].name[lang];
            const displayTxt = (zoom < 15 && b.w <= 3) ? text.substring(0, 3) + '.' : text;

            // Multi-line text for better fit
            const words = displayTxt.split(' ');
            if (words.length > 1 && b.h * zoom > 30) {
                ctx.fillText(words[0], rx + rw / 2, ry + rh / 2 - 6);
                ctx.fillText(words.slice(1).join(' '), rx + rw / 2, ry + rh / 2 + 6);
            } else {
                ctx.fillText(displayTxt, rx + rw / 2, ry + rh / 2);
            }
        });
    }, [zoom, lang]);

    const drawHover = useCallback(() => {
        const canvas = hoverCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { x, y } = mousePos.current;
        if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;

        // Desenha o edifício se estiver movendo
        if (movingState) {
            const { w, h, type } = movingState.current;
            const bDef = BUILDINGS[type];
            const canPlace = isSpaceFree(x, y, w, h);

            ctx.fillStyle = canPlace ? bDef.color : '#ef4444';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x * zoom, y * zoom, w * zoom, h * zoom);

            if (!canPlace) {
                ctx.strokeStyle = '#991b1b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x * zoom, y * zoom);
                ctx.lineTo((x + w) * zoom, (y + h) * zoom);
                ctx.moveTo((x + w) * zoom, y * zoom);
                ctx.lineTo(x * zoom, (y + h) * zoom);
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * zoom, y * zoom, w * zoom, h * zoom);
            return;
        }

        if (activeTab === 'terrain' && tool === 'paint') {
            const offset = Math.floor(brushSize / 2);
            ctx.fillStyle = TERRAINS[selectedTerrain].color;
            ctx.globalAlpha = 0.5;

            for (let i = 0; i < brushSize; i++) {
                for (let j = 0; j < brushSize; j++) {
                    const paintX = x - offset + i;
                    const paintY = y - offset + j;
                    if (paintX >= 0 && paintX < GRID_W && paintY >= 0 && paintY < GRID_H) {
                        ctx.fillRect(paintX * zoom, paintY * zoom, zoom, zoom);
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        }
        else if (activeTab === 'building' && tool === 'paint') {
            const bDef = BUILDINGS[selectedBuilding];
            let w = isRotated ? bDef.h : bDef.w;
            let h = isRotated ? bDef.w : bDef.h;

            // Resolução de dimensões para lote customizado
            if (selectedBuilding === 'custom') {
                w = isRotated ? customH : customW;
                h = isRotated ? customW : customH;
            }

            // Check collision
            const canPlace = isSpaceFree(x, y, w, h);

            ctx.fillStyle = canPlace ? bDef.color : '#ef4444';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x * zoom, y * zoom, w * zoom, h * zoom);

            if (!canPlace) {
                ctx.strokeStyle = '#991b1b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x * zoom, y * zoom);
                ctx.lineTo((x + w) * zoom, (y + h) * zoom);
                ctx.moveTo((x + w) * zoom, y * zoom);
                ctx.lineTo(x * zoom, (y + h) * zoom);
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * zoom, y * zoom, w * zoom, h * zoom);
        }
        else if (tool === 'erase') {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, tool, selectedTerrain, selectedBuilding, brushSize, zoom, isRotated, movingState, customW, customH]);

    useEffect(() => {
        drawBase();
    }, [drawBase]);

    // Força o desenho do hover quando os estados visuais atualizarem
    useEffect(() => {
        drawHover();
    }, [drawHover]);

    const toggleLang = () => {
        setLang(prev => prev === 'en' ? 'pt' : 'en');
    };

    // --------------------------------------------------------
    // History Logic
    // --------------------------------------------------------
    const saveState = useCallback((snapshot) => {
        history.current.push(snapshot);
        if (history.current.length > 50) history.current.shift(); // Limite de 50 ações
        redoStack.current = [];
        setCanUndo(true);
        setCanRedo(false);
    }, []);

    const performUndo = useCallback(() => {
        if (movingState) {
            buildingsData.current.push(movingState.original);
            setMovingState(null);
            drawBase();
            return;
        }
        if (history.current.length === 0) return;

        redoStack.current.push({
            grid: new Uint8Array(gridData.current),
            buildings: JSON.parse(JSON.stringify(buildingsData.current))
        });

        const prevState = history.current.pop();
        gridData.current = new Uint8Array(prevState.grid);
        buildingsData.current = prevState.buildings;

        setCanUndo(history.current.length > 0);
        setCanRedo(true);
        drawBase();
        drawHover();
    }, [movingState, drawBase, drawHover]);

    const performRedo = useCallback(() => {
        if (movingState) return;
        if (redoStack.current.length === 0) return;

        history.current.push({
            grid: new Uint8Array(gridData.current),
            buildings: JSON.parse(JSON.stringify(buildingsData.current))
        });

        const nextState = redoStack.current.pop();
        gridData.current = new Uint8Array(nextState.grid);
        buildingsData.current = nextState.buildings;

        setCanUndo(true);
        setCanRedo(redoStack.current.length > 0);
        drawBase();
        drawHover();
    }, [movingState, drawBase, drawHover]);

    const applyAction = (gx, gy) => {
        if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return;

        let changed = false;

        if (activeTab === 'terrain' && tool === 'paint') {
            const offset = Math.floor(brushSize / 2);
            for (let i = 0; i < brushSize; i++) {
                for (let j = 0; j < brushSize; j++) {
                    const px = gx - offset + i;
                    const py = gy - offset + j;
                    if (px >= 0 && px < GRID_W && py >= 0 && py < GRID_H) {
                        const idx = py * GRID_W + px;
                        if (gridData.current[idx] !== selectedTerrain) {
                            gridData.current[idx] = selectedTerrain;
                            changed = true;
                        }
                    }
                }
            }
        }
        else if (activeTab === 'building' && tool === 'paint') {
            if (isMouseDown.current) return;
            const bDef = BUILDINGS[selectedBuilding];

            let w = isRotated ? bDef.h : bDef.w;
            let h = isRotated ? bDef.w : bDef.h;

            if (selectedBuilding === 'custom') {
                w = isRotated ? customH : customW;
                h = isRotated ? customW : customH;
            }

            if (isSpaceFree(gx, gy, w, h)) {
                buildingsData.current.push({
                    id: Date.now() + Math.random(),
                    type: selectedBuilding,
                    x: gx, y: gy, w, h, rotated: isRotated
                });
                changed = true;
            }
        }
        else if (tool === 'erase') {
            const buildingRemoved = removeBuildingAt(gx, gy);
            if (buildingRemoved) {
                changed = true;
            } else {
                const offset = Math.floor(brushSize / 2);
                for (let i = 0; i < brushSize; i++) {
                    for (let j = 0; j < brushSize; j++) {
                        const px = gx - offset + i;
                        const py = gy - offset + j;
                        if (px >= 0 && px < GRID_W && py >= 0 && py < GRID_H) {
                            const idx = py * GRID_W + px;
                            if (gridData.current[idx] !== 0) {
                                gridData.current[idx] = 0;
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        if (changed) {
            drawBase();
        }

        return changed;
    };

    // --------------------------------------------------------
    // Event Handlers
    // --------------------------------------------------------
    const getGridCoords = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / zoom);
        const y = Math.floor((e.clientY - rect.top) / zoom);
        return { x, y };
    };

    const handlePointerDown = (e) => {
        if (e.button !== 0) return;
        const { x, y } = getGridCoords(e);
        mousePos.current = { x, y };

        if (movingState) {
            const { w, h } = movingState.current;
            if (isSpaceFree(x, y, w, h)) {
                saveState(movingState.snapshot);
                buildingsData.current.push({ ...movingState.current, x, y });
                setMovingState(null);
                drawBase();
            }
            return;
        }

        if (tool === 'pointer') {
            const clickedIdx = buildingsData.current.findIndex(b =>
                x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h
            );
            if (clickedIdx !== -1) {
                const b = buildingsData.current[clickedIdx];
                const snapshot = {
                    grid: new Uint8Array(gridData.current),
                    buildings: JSON.parse(JSON.stringify(buildingsData.current))
                };
                buildingsData.current.splice(clickedIdx, 1);
                setMovingState({
                    original: { ...b },
                    current: { ...b },
                    snapshot
                });
                drawBase();
                return;
            }
        }

        hasSavedStroke.current = false;
        const snapshot = {
            grid: new Uint8Array(gridData.current),
            buildings: JSON.parse(JSON.stringify(buildingsData.current))
        };

        const changed = applyAction(x, y);
        if (changed) {
            saveState(snapshot);
            hasSavedStroke.current = true;
        }

        isMouseDown.current = true;
        drawHover();
    };

    const handlePointerMove = (e) => {
        const { x, y } = getGridCoords(e);
        if (mousePos.current.x !== x || mousePos.current.y !== y) {
            mousePos.current = { x, y };
            if (isMouseDown.current && !movingState && (activeTab === 'terrain' || tool === 'erase')) {
                const snapshot = !hasSavedStroke.current ? {
                    grid: new Uint8Array(gridData.current),
                    buildings: JSON.parse(JSON.stringify(buildingsData.current))
                } : null;

                const changed = applyAction(x, y);

                if (changed && !hasSavedStroke.current) {
                    saveState(snapshot);
                    hasSavedStroke.current = true;
                }
            }
            drawHover();
        }
    };

    const handlePointerUp = () => {
        isMouseDown.current = false;
    };

    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        return () => window.removeEventListener('mouseup', handlePointerUp);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    performRedo();
                } else {
                    performUndo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                performRedo();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                if (movingState) {
                    buildingsData.current.push(movingState.original);
                    setMovingState(null);
                    drawBase();
                } else {
                    handleSetTool('pointer');
                }
            } else if (e.key.toLowerCase() === 'r' || e.code === 'Space') {
                if (e.code === 'Space') e.preventDefault();

                if (movingState) {
                    setMovingState(prev => ({
                        ...prev,
                        current: {
                            ...prev.current,
                            rotated: !prev.current.rotated,
                            w: prev.current.h,
                            h: prev.current.w
                        }
                    }));
                } else {
                    setIsRotated(r => !r);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawBase, movingState, isRotated, performUndo, performRedo]);

    // --------------------------------------------------------
    // Actions
    // --------------------------------------------------------
    const handleClearClick = () => {
        setShowClearConfirm(true);
    };

    const confirmClearMap = () => {
        saveState({
            grid: new Uint8Array(gridData.current),
            buildings: JSON.parse(JSON.stringify(buildingsData.current))
        });
        gridData.current.fill(0);
        buildingsData.current = [];
        setMovingState(null);
        drawBase();
        setShowClearConfirm(false);
    };

    const exportMap = () => {
        const data = {
            grid: Array.from(gridData.current),
            buildings: buildingsData.current
        };
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "projeto-ilha-tomodachi.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const importMap = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.grid && data.buildings) {
                    saveState({
                        grid: new Uint8Array(gridData.current),
                        buildings: JSON.parse(JSON.stringify(buildingsData.current))
                    });
                    gridData.current = new Uint8Array(data.grid);
                    buildingsData.current = data.buildings;
                    setMovingState(null);
                    drawBase();
                }
            } catch (err) {
                console.error(err);
                alert(t.invalidFile);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const cursorClass = movingState ? 'cursor-grabbing' : (tool === 'pointer' ? 'cursor-pointer' : 'cursor-crosshair');

    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------
    return (
        <div className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">

            {/* Sidebar Tools */}
            <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col shadow-xl z-10 shrink-0">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Map className="text-sky-400" />
                        <div>
                            <h1 className="font-bold text-lg text-white leading-tight">Tomodachi Life</h1>
                            <p className="text-xs text-slate-400">Living the Dream Planner</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleLang}
                        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs font-bold text-slate-300 transition-colors"
                        title="Toggle Language"
                    >
                        <Globe size={12} /> {lang.toUpperCase()}
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex p-2 gap-2 border-b border-slate-700 bg-slate-800/50">
                    <button
                        className={`flex-1 py-2 text-sm font-medium rounded transition-colors flex justify-center items-center gap-2 ${activeTab === 'terrain' ? 'bg-sky-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                        onClick={() => { setActiveTab('terrain'); handleSetTool('paint'); }}
                    >
                        <Brush size={16} /> {t.terrainTab}
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-medium rounded transition-colors flex justify-center items-center gap-2 ${activeTab === 'building' ? 'bg-sky-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                        onClick={() => { setActiveTab('building'); handleSetTool('paint'); }}
                    >
                        <Building size={16} /> {t.buildingTab}
                    </button>
                </div>

                {/* Tools Section */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">

                    {/* TERRAIN TAB */}
                    {activeTab === 'terrain' && (
                        <div className="animate-in fade-in duration-200">
                            <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">{t.terrainPaint}</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {TERRAINS.map((terrainItem) => (
                                    <button
                                        key={terrainItem.id}
                                        className={`flex items-center gap-2 p-2 rounded border transition-all ${selectedTerrain === terrainItem.id && tool === 'paint' ? 'border-sky-500 bg-slate-700' : 'border-slate-700 hover:border-slate-500'}`}
                                        onClick={() => { setSelectedTerrain(terrainItem.id); handleSetTool('paint'); }}
                                    >
                                        <div className="w-5 h-5 rounded shadow-sm border border-slate-900" style={{ backgroundColor: terrainItem.color }} />
                                        <span className="text-sm truncate">{terrainItem.name[lang]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6">
                                <h2 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center justify-between">
                                    {t.brushSize} <span>{brushSize}x{brushSize}</span>
                                </h2>
                                <input
                                    type="range" min="1" max="5" value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-full accent-sky-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* BUILDING TAB */}
                    {activeTab === 'building' && (
                        <div className="animate-in fade-in duration-200">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-xs font-bold text-slate-500 uppercase">{t.blueprints}</h2>
                                <button
                                    onClick={() => setIsRotated(!isRotated)}
                                    className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded border border-slate-600 transition-colors"
                                    title={t.shortcutRot}
                                >
                                    <RotateCw size={12} /> {isRotated ? t.rotated : t.normal}
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {Object.values(BUILDINGS).map((b) => {
                                    const isCustom = b.id === 'custom';
                                    const currentW = isCustom ? customW : b.w;
                                    const currentH = isCustom ? customH : b.h;
                                    const displayW = isRotated ? currentH : currentW;
                                    const displayH = isRotated ? currentW : currentH;

                                    return (
                                        <div key={b.id} className="flex flex-col">
                                            <button
                                                className={`flex items-center justify-between p-2 rounded border transition-all ${selectedBuilding === b.id && tool === 'paint' ? 'border-sky-500 bg-slate-700' : 'border-slate-700 hover:border-slate-500'}`}
                                                onClick={() => { setSelectedBuilding(b.id); handleSetTool('paint'); }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-4 h-4 rounded-sm border border-slate-900 shrink-0" style={{ backgroundColor: b.color }} />
                                                    <div className="flex flex-col items-start overflow-hidden">
                                                        <span className="text-sm truncate w-full text-left">{b.name[lang]}</span>
                                                        <span className="text-xs text-slate-400">
                                                            {displayW}x{displayH} {t.tiles}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Controles de Lote Personalizado */}
                                            {isCustom && selectedBuilding === 'custom' && (
                                                <div className="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t.width}</label>
                                                        <select
                                                            value={customW}
                                                            onChange={(e) => setCustomW(Number(e.target.value))}
                                                            className="w-full bg-slate-800 border border-slate-600 rounded text-sm p-1.5 text-slate-200 outline-none focus:border-sky-500"
                                                        >
                                                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} {n === 1 ? t.tile : t.tiles}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t.depth}</label>
                                                        <select
                                                            value={customH}
                                                            onChange={(e) => setCustomH(Number(e.target.value))}
                                                            className="w-full bg-slate-800 border border-slate-600 rounded text-sm p-1.5 text-slate-200 outline-none focus:border-sky-500"
                                                        >
                                                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} {n === 1 ? t.tile : t.tiles}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500 mt-3 text-center">{t.tipRot}</p>
                        </div>
                    )}

                    {/* GLOBAL TOOLS */}
                    <div className="mt-auto pt-4 border-t border-slate-700">
                        <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">{t.actions}</h2>
                        <div className="flex gap-2">
                            <button
                                className={`flex-1 flex flex-col items-center justify-center p-2 rounded border transition-all ${tool === 'pointer' ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-slate-700 hover:border-slate-500'}`}
                                onClick={() => handleSetTool('pointer')}
                                title={t.shortcutEsc}
                            >
                                <MousePointer2 size={20} className="mb-1" />
                                <span className="text-xs">{t.cursor}</span>
                            </button>

                            <button
                                className={`flex-1 flex flex-col items-center justify-center p-2 rounded border transition-all ${tool === 'erase' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-slate-700 hover:border-slate-500'}`}
                                onClick={() => handleSetTool('erase')}
                            >
                                <Eraser size={20} className="mb-1" />
                                <span className="text-xs">{t.eraser}</span>
                            </button>

                            <button
                                className="flex-1 flex flex-col items-center justify-center p-2 rounded border border-slate-700 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
                                onClick={handleClearClick}
                            >
                                <Trash2 size={20} className="mb-1" />
                                <span className="text-xs">{t.clear}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-800 border-t border-slate-700 grid grid-cols-2 gap-2">
                    <button
                        onClick={exportMap}
                        className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-sm py-2 rounded transition-colors"
                    >
                        <Save size={16} /> {t.save}
                    </button>

                    <label className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-sm py-2 rounded transition-colors cursor-pointer">
                        <Upload size={16} /> {t.open}
                        <input type="file" accept=".json" className="hidden" onChange={importMap} />
                    </label>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className={`flex-1 relative bg-[#0a0f18] overflow-auto custom-scrollbar ${cursorClass}`} id="canvas-container">

                {/* History Controls Overlay */}
                <div className="fixed top-4 left-[340px] bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 flex gap-1 z-20 shadow-lg">
                    <button
                        onClick={performUndo}
                        disabled={!canUndo}
                        className={`p-2 rounded transition-colors ${canUndo ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}`}
                        title={t.undo}
                    >
                        <Undo size={18} />
                    </button>
                    <div className="w-px bg-slate-700 my-1"></div>
                    <button
                        onClick={performRedo}
                        disabled={!canRedo}
                        className={`p-2 rounded transition-colors ${canRedo ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}`}
                        title={t.redo}
                    >
                        <Redo size={18} />
                    </button>
                </div>

                {/* Zoom Controls Overlay */}
                <div className="fixed top-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 flex gap-1 z-20 shadow-lg">
                    <button
                        onClick={() => setZoom(Math.max(5, zoom - 5))}
                        className="p-2 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        title={t.zoomOut}
                    >
                        <ZoomOut size={18} />
                    </button>
                    <div className="flex items-center px-2 text-sm font-medium w-12 justify-center border-x border-slate-700">
                        {zoom}px
                    </div>
                    <button
                        onClick={() => setZoom(Math.min(30, zoom + 5))}
                        className="p-2 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        title={t.zoomIn}
                    >
                        <ZoomIn size={18} />
                    </button>
                </div>

                {/* Canvas Wrapper */}
                <div
                    className="relative origin-top-left"
                    style={{ width: GRID_W * zoom, height: GRID_H * zoom, margin: '20px auto' }}
                >
                    <canvas
                        ref={canvasRef}
                        width={GRID_W * zoom}
                        height={GRID_H * zoom}
                        className="absolute top-0 left-0 bg-slate-800 shadow-2xl"
                    />
                    <canvas
                        ref={hoverCanvasRef}
                        width={GRID_W * zoom}
                        height={GRID_H * zoom}
                        className="absolute top-0 left-0 pointer-events-auto"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onMouseLeave={() => {
                            const ctx = hoverCanvasRef.current.getContext('2d');
                            ctx.clearRect(0, 0, hoverCanvasRef.current.width, hoverCanvasRef.current.height);
                        }}
                    />
                </div>
            </div>

            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">{t.clearTitle}</h3>
                        <p className="text-slate-300 text-sm mb-6">{t.clearDesc}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={confirmClearMap}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                            >
                                {t.confirmClear}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155; 
          border-radius: 6px;
          border: 3px solid #0f172a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #475569; 
        }
      `}} />
        </div>
    );
}