import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  RotateCw,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Info,
  Layers,
} from 'lucide-react';
import { resolveModelUrl } from '../services/api';
import { ScanRecord } from '../types';

interface MeshViewerProps {
  scan: ScanRecord | null;
  patientId: string;
  isExpansive?: boolean;
  onToggleExpansive?: (() => void) | null;
}

interface LayerState {
  femur: boolean;
  tibia: boolean;
  acl: boolean;
  plateau: boolean;
  grid: boolean;
}

export default function MeshViewer({
  scan,
  patientId,
  isExpansive = false,
  onToggleExpansive = null,
}: MeshViewerProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const [exposure] = useState('1.1');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePreset, setActivePreset] = useState<'anterior' | 'sagittal' | 'axial' | 'oblique'>('anterior');

  // Layer visibility toggles matching C:\ACL_analysis\ACL_graft_analysis
  const [layers, setLayers] = useState<LayerState>({
    femur: true,
    tibia: true,
    acl: true,
    plateau: true,
    grid: true,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);

  // Apply material opacity / visibility dynamically in model-viewer
  const applyLayerVisibilities = useCallback((currentLayers: LayerState = layers) => {
    if (!modelViewerRef.current || !modelViewerRef.current.model) return;
    const model = modelViewerRef.current.model;
    const materials = model.materials || [];

    materials.forEach((mat) => {
      const name = (mat.name || '').toLowerCase();
      let targetVisible = true;
      let targetAlpha = 0.95;

      if (name.includes('femur')) {
        targetVisible = currentLayers.femur;
        targetAlpha = 0.35;
      } else if (name.includes('tibia')) {
        targetVisible = currentLayers.tibia;
        targetAlpha = 0.35;
      } else if (name.includes('acl')) {
        targetVisible = currentLayers.acl;
        targetAlpha = 0.95;
      } else if (name.includes('plateau')) {
        targetVisible = currentLayers.plateau;
        targetAlpha = 0.45;
      } else if (name.includes('bh') || name.includes('grid') || name.includes('ref') || name.includes('blum')) {
        targetVisible = currentLayers.grid;
        targetAlpha = 0.85;
      } else if (name.includes('footprint')) {
        targetVisible = currentLayers.acl;
        targetAlpha = 0.95;
      }

      if (typeof mat.setAlphaMode === 'function') {
        mat.setAlphaMode(targetVisible ? 'BLEND' : 'MASK');
        if (typeof mat.setAlphaCutoff === 'function') {
          mat.setAlphaCutoff(targetVisible ? 0.0 : 1.0);
        }
      }

      if (mat.pbrMetallicRoughness) {
        const baseColor = mat.pbrMetallicRoughness.baseColorFactor;
        mat.pbrMetallicRoughness.setBaseColorFactor([
          baseColor[0],
          baseColor[1],
          baseColor[2],
          targetVisible ? targetAlpha : 0.0,
        ]);
      }
    });
  }, [layers]);

  const toggleLayer = (layerKey: keyof LayerState) => {
    setLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      applyLayerVisibilities(next);
      return next;
    });
  };

  // Listen to model load event to apply layers immediately
  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;

    const handleLoad = () => {
      applyLayerVisibilities(layers);
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [scan?.model_url, layers, applyLayerVisibilities]);

  // Fullscreen Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Camera presets
  const setCameraPreset = (preset: 'anterior' | 'sagittal' | 'axial' | 'oblique') => {
    if (!modelViewerRef.current) return;
    setActivePreset(preset);
    if (preset === 'anterior') {
      modelViewerRef.current.cameraOrbit = '0deg 85deg 105%';
    } else if (preset === 'sagittal') {
      modelViewerRef.current.cameraOrbit = '90deg 85deg 105%';
    } else if (preset === 'axial') {
      modelViewerRef.current.cameraOrbit = '0deg 0deg 105%';
    } else if (preset === 'oblique') {
      modelViewerRef.current.cameraOrbit = '35deg 80deg 105%';
    }
    modelViewerRef.current.fieldOfView = 'auto';
  };

  const resetCamera = () => {
    setCameraPreset('anterior');
  };

  if (!scan) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center min-h-[480px] text-center">
        <div className="p-4 rounded-full bg-slate-800/80 text-slate-500 mb-3 border border-slate-700/60">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">Nebyl vybrán žádný 3D sken</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Vyberte pacienta a vyšetření z časové osy nebo nahrajte nový MRI sken pro kompletní 3D zobrazení kolenního kloubu.
        </p>
      </div>
    );
  }

  const modelUrl = resolveModelUrl(scan.model_url);

  const getIntegrityBadge = (score: number) => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        label: 'Maturation / High Integrity',
      };
    }
    if (score >= 65) {
      return {
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        label: 'Revascularization / Moderate',
      };
    }
    return {
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      label: 'Early Remodeling / Vulnerable',
    };
  };

  const badge = getIntegrityBadge(scan.integrity_score);

  return (
    <div
      ref={containerRef}
      className={`glass-panel rounded-2xl transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-950/98 p-4 sm:p-6 rounded-none'
          : 'p-5 mb-6 relative overflow-hidden'
      }`}
    >
      {/* Header with Title and Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              3D Rekonstrukce Kolene (Anatomie & Geometrie)
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.bg}`}>
                {scan.integrity_score.toFixed(1)}% Integrita
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Subjekt <span className="font-mono text-teal-300">{patientId}</span> • Kontrola{' '}
              <strong className="text-slate-200">{scan.months_post_op} měs.</strong> od plastiky
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleExpansive && !isFullscreen && (
            <button
              onClick={onToggleExpansive}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isExpansive
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Přepnout širokoúhlé zobrazení"
            >
              <span>{isExpansive ? 'Kompaktní' : 'Širokoúhlé 3D'}</span>
            </button>
          )}

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
            title="Přepnout 360° rotaci"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`}
              style={{ animationDuration: '8s' }}
            />
            <span className="hidden sm:inline">360° Rotace</span>
          </button>

          <button
            onClick={resetCamera}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Resetovat pohled kamery"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
              isFullscreen
                ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isFullscreen ? 'Ukončit celou obrazovku (Esc)' : 'Celá obrazovka (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Zpět' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Anatomical Layer Toggles Bar (Femur, Tibia, ACL, Plato, B&H Grid) */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 mt-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-medium mr-2">
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden md:inline">Anatomické vrstvy:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Femur Toggle */}
          <button
            onClick={() => toggleLayer('femur')}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.femur
                ? 'bg-[#e8dcc8]/20 border-[#e8dcc8]/60 text-[#e8dcc8] font-medium'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through'
            }`}
            title="Přepnout viditelnost kosti stehenní (Femur)"
          >
            <span className="w-2 h-2 rounded-full bg-[#e8dcc8]" />
            <span>Femur</span>
          </button>

          {/* Tibia Toggle */}
          <button
            onClick={() => toggleLayer('tibia')}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.tibia
                ? 'bg-[#d4c5a9]/20 border-[#d4c5a9]/60 text-[#d4c5a9] font-medium'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through'
            }`}
            title="Přepnout viditelnost kosti holenní (Tibia)"
          >
            <span className="w-2 h-2 rounded-full bg-[#d4c5a9]" />
            <span>Tibia</span>
          </button>

          {/* ACL Graft Toggle */}
          <button
            onClick={() => toggleLayer('acl')}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.acl
                ? 'bg-[#ff8c42]/20 border-[#ff8c42]/60 text-[#ff8c42] font-semibold'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through'
            }`}
            title="Přepnout viditelnost ACL vazu a úponů"
          >
            <span className="w-2 h-2 rounded-full bg-[#ff8c42]" />
            <span>ACL Štěp</span>
          </button>

          {/* Tibial Plateau Toggle */}
          <button
            onClick={() => toggleLayer('plateau')}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.plateau
                ? 'bg-[#22d3ee]/20 border-[#22d3ee]/60 text-[#22d3ee] font-medium'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through'
            }`}
            title="Přepnout rovinu tibiálního plata (RANSAC)"
          >
            <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
            <span>Tibiální Plato</span>
          </button>

          {/* Bernard-Hertel Grid Toggle */}
          <button
            onClick={() => toggleLayer('grid')}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.grid
                ? 'bg-[#4ade80]/20 border-[#4ade80]/60 text-[#4ade80] font-medium'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through'
            }`}
            title="Přepnout Bernard-Hertel mřížku & Blumensaatovu linii"
          >
            <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
            <span>B&H Mřížka</span>
          </button>
        </div>

        {/* Camera Preset Buttons */}
        <div className="flex items-center space-x-1 border-l border-slate-800 pl-2">
          <button
            onClick={() => setCameraPreset('anterior')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'anterior'
                ? 'bg-teal-500/25 text-teal-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Přední pohled (Anterior)"
          >
            Ant
          </button>
          <button
            onClick={() => setCameraPreset('sagittal')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'sagittal'
                ? 'bg-teal-500/25 text-teal-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Sagitální boční pohled (Lateral)"
          >
            Sag
          </button>
          <button
            onClick={() => setCameraPreset('axial')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'axial'
                ? 'bg-teal-500/25 text-teal-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Axiální shora na plato"
          >
            Ax
          </button>
          <button
            onClick={() => setCameraPreset('oblique')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'oblique'
                ? 'bg-teal-500/25 text-teal-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Šikmý 3D pohled"
          >
            3D
          </button>
        </div>
      </div>

      {/* 3D Model Viewer Container */}
      <div
        className={`relative w-full rounded-xl overflow-hidden mt-3 border border-slate-800/80 bg-slate-950 transition-all ${
          isFullscreen
            ? 'flex-1 min-h-[500px]'
            : isExpansive
            ? 'h-[580px] lg:h-[660px]'
            : 'h-[460px] md:h-[540px]'
        }`}
      >
        <model-viewer
          ref={modelViewerRef}
          src={modelUrl}
          alt={`3D Model kolene - ${scan.id}`}
          camera-controls
          touch-action="pan-y"
          auto-rotate={autoRotate ? true : undefined}
          auto-rotate-delay="500"
          rotation-per-second="18deg"
          shadow-intensity="1.2"
          shadow-softness="0.7"
          exposure={exposure}
          camera-orbit="0deg 85deg 105%"
          min-camera-orbit="auto 0deg 30%"
          max-camera-orbit="auto 180deg 280%"
          interaction-prompt="none"
          loading="eager"
          style={{ width: '100%', height: '100%', backgroundColor: '#090d16' }}
        >
          {/* Slot for loading fallback */}
          <div slot="poster" className="w-full h-full flex items-center justify-center bg-slate-950/80">
            <div className="flex flex-col items-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
              <span className="text-xs">Načítání kompletního 3D modelu kolenního kloubu...</span>
            </div>
          </div>
        </model-viewer>

        {/* In-viewport metric HUD overlay (upper-left) */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md rounded-xl p-3 border border-slate-800/80 shadow-xl text-xs space-y-1.5 pointer-events-none z-10">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Objem štěpu:</span>
            <span className="font-mono font-semibold text-teal-300">{scan.volume_mm3.toFixed(1)} mm³</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Integrita vazu:</span>
            <span className="font-mono font-semibold text-amber-300">{scan.integrity_score.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Časová osa:</span>
            <span className="font-mono text-slate-200">{scan.months_post_op} měs.</span>
          </div>
        </div>

        {/* In-viewport gesture helper overlay (bottom-right) */}
        <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-slate-800/60 text-[11px] text-slate-400 pointer-events-none flex items-center gap-1.5 z-10">
          <Eye className="w-3.5 h-3.5 text-teal-400" />
          <span>Levé tlačítko/dotyk: rotace • Kolečko/gesto: zoom • Pravé tlačítko: posun</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-teal-400" />
          <span>Kompletní anatomická scéna: Femur, Tibia, ACL štěp, Tibiální plato & B&H mřížka.</span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Sken: {scan.id}
        </div>
      </div>
    </div>
  );
}
