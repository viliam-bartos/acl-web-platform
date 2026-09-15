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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePreset, setActivePreset] = useState<'anterior' | 'sagittal' | 'axial' | 'oblique'>('anterior');

  // Layer visibility toggles
  const [layers, setLayers] = useState<LayerState>({
    femur: true,
    tibia: true,
    acl: true,
    plateau: true,
    grid: true,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);

  // Apply material opacity and exact color scheme dynamically in model-viewer
  // Kosti = jasně bílé, Vaz = matně žlutý, Úpony = matně oranžové, Plato a Grid = cyan
  const applyLayerVisibilities = useCallback((currentLayers: LayerState = layers) => {
    if (!modelViewerRef.current || !modelViewerRef.current.model) return;
    const model = modelViewerRef.current.model;
    const materials = model.materials || [];

    materials.forEach((mat) => {
      const name = (mat.name || '').toLowerCase();
      let targetVisible = true;
      let targetAlpha = 0.95;
      let targetColor = [1.0, 1.0, 1.0];

      if (name.includes('femur')) {
        targetVisible = currentLayers.femur;
        targetAlpha = 0.40;
        targetColor = [1.0, 1.0, 1.0]; // Jasně bílé kosti
      } else if (name.includes('tibia')) {
        targetVisible = currentLayers.tibia;
        targetAlpha = 0.40;
        targetColor = [1.0, 1.0, 1.0]; // Jasně bílé kosti
      } else if (name.includes('acl')) {
        targetVisible = currentLayers.acl;
        targetAlpha = 0.95;
        targetColor = [0.92, 0.70, 0.05]; // Matně žlutý ACL vaz
      } else if (name.includes('plateau')) {
        targetVisible = currentLayers.plateau;
        targetAlpha = 0.45;
        targetColor = [0.22, 0.71, 1.0]; // Technická cyan
      } else if (name.includes('bh') || name.includes('grid') || name.includes('ref') || name.includes('blum')) {
        targetVisible = currentLayers.grid;
        targetAlpha = 0.85;
        targetColor = [0.22, 0.71, 1.0]; // Technická cyan
      } else if (name.includes('footprint')) {
        targetVisible = currentLayers.acl;
        targetAlpha = 0.95;
        targetColor = [0.96, 0.46, 0.12]; // Matně oranžové úpony
      }

      if (typeof mat.setAlphaMode === 'function') {
        mat.setAlphaMode(targetVisible ? 'BLEND' : 'MASK');
        if (typeof mat.setAlphaCutoff === 'function') {
          mat.setAlphaCutoff(targetVisible ? 0.0 : 1.0);
        }
      }

      if (mat.pbrMetallicRoughness) {
        mat.pbrMetallicRoughness.setBaseColorFactor([
          targetColor[0],
          targetColor[1],
          targetColor[2],
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

  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;

    const handleLoad = () => {
      applyLayerVisibilities(layers);
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [scan?.model_url, layers, applyLayerVisibilities]);

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
      <div className="panel-composite rounded-2xl p-8 flex flex-col items-center justify-center min-h-[480px] text-center">
        <div className="p-4 rounded-xl bg-composite-850 text-paper-300 mb-3 border border-composite-800">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-paper-100 font-display tracking-wide uppercase">
          Nebyl vybrán žádný 3D sken
        </h3>
        <p className="text-xs text-paper-300 max-w-sm mt-1">
          Vyberte pacienta a vyšetření z časové osy nebo nahrajte nový MRI sken pro 3D zobrazení kolenního kloubu.
        </p>
      </div>
    );
  }

  const modelUrl = resolveModelUrl(scan.model_url);

  return (
    <div
      ref={containerRef}
      className={`panel-composite rounded-2xl transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#121416] p-4 sm:p-6 rounded-none'
          : 'p-5 mb-6 relative overflow-hidden'
      }`}
    >
      {/* Header with Title and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-composite-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-kraft-400 text-composite-950">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-paper-100 font-display uppercase tracking-wider">
                3D Rekonstrukce Kolene
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded badge-kraft">
                {scan.integrity_score.toFixed(1)}% INTEGRITA
              </span>
            </div>
            <p className="text-xs text-paper-300 font-mono mt-0.5">
              ID: <span className="text-paper-100 font-semibold">{patientId}</span> • Kontrola{' '}
              <span className="text-paper-100 font-semibold">{scan.months_post_op} měs.</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleExpansive && !isFullscreen && (
            <button
              onClick={onToggleExpansive}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                isExpansive
                  ? 'bg-kraft-400 text-composite-950 border-kraft-500 font-semibold'
                  : 'bg-composite-850 hover:bg-composite-800 text-paper-200 border-composite-800'
              }`}
              title="Přepnout širokoúhlé zobrazení"
            >
              <span>{isExpansive ? 'KOMPAKTNÍ' : 'ŠIROKOÚHLÉ'}</span>
            </button>
          )}

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-hazard-500 text-composite-950 border-hazard-600 font-bold'
                : 'bg-composite-850 border-composite-800 text-paper-300 hover:text-paper-100'
            }`}
            title="Přepnout 360° rotaci"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`}
              style={{ animationDuration: '8s' }}
            />
            <span>360°</span>
          </button>

          <button
            onClick={resetCamera}
            className="p-1.5 rounded-lg bg-composite-850 hover:bg-composite-800 text-paper-200 border border-composite-800 transition-colors cursor-pointer"
            title="Resetovat pohled kamery"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-mono cursor-pointer ${
              isFullscreen
                ? 'bg-hazard-500 text-composite-950 border-hazard-600 font-bold'
                : 'bg-composite-850 hover:bg-composite-800 text-paper-200 border-composite-800'
            }`}
            title={isFullscreen ? 'Ukončit celou obrazovku (Esc)' : 'Celá obrazovka (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Anatomical Layer Toggles Bar (Jasně bílá, matně žlutá, oranžová, cyan) */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 mt-3 rounded-xl bg-composite-850 border border-composite-800 text-xs">
        <div className="flex items-center space-x-1.5 text-paper-300 text-[11px] font-mono mr-2">
          <Layers className="w-3.5 h-3.5 text-cyan-500" />
          <span className="hidden md:inline uppercase">Vrstvy:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Femur (Jasně bílá) */}
          <button
            onClick={() => toggleLayer('femur')}
            className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.femur
                ? 'bg-paper-100 text-composite-950 border-paper-200 font-semibold'
                : 'bg-composite-900 border-composite-800 text-paper-400 line-through opacity-60'
            }`}
            title="Přepnout viditelnost kosti stehenní (Femur)"
          >
            <span className="w-2 h-2 rounded-full bg-white border border-slate-300" />
            <span>FEMUR</span>
          </button>

          {/* Tibia (Jasně bílá) */}
          <button
            onClick={() => toggleLayer('tibia')}
            className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.tibia
                ? 'bg-paper-100 text-composite-950 border-paper-200 font-semibold'
                : 'bg-composite-900 border-composite-800 text-paper-400 line-through opacity-60'
            }`}
            title="Přepnout viditelnost kosti holenní (Tibia)"
          >
            <span className="w-2 h-2 rounded-full bg-white border border-slate-300" />
            <span>TIBIA</span>
          </button>

          {/* ACL Štěp (Matně žlutý) */}
          <button
            onClick={() => toggleLayer('acl')}
            className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.acl
                ? 'bg-yellow-400 text-composite-950 border-yellow-500 font-bold'
                : 'bg-composite-900 border-composite-800 text-paper-400 line-through opacity-60'
            }`}
            title="Přepnout viditelnost ACL vazu a úponů"
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>ACL ŠTĚP</span>
          </button>

          {/* Tibiální Plato (Cyan) */}
          <button
            onClick={() => toggleLayer('plateau')}
            className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.plateau
                ? 'bg-cyan-500 text-composite-950 border-cyan-600 font-semibold'
                : 'bg-composite-900 border-composite-800 text-paper-400 line-through opacity-60'
            }`}
            title="Přepnout rovinu tibiálního plata"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>PLATO</span>
          </button>

          {/* Bernard-Hertel Grid (Cyan) */}
          <button
            onClick={() => toggleLayer('grid')}
            className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              layers.grid
                ? 'bg-cyan-500 text-composite-950 border-cyan-600 font-semibold'
                : 'bg-composite-900 border-composite-800 text-paper-400 line-through opacity-60'
            }`}
            title="Přepnout Bernard-Hertel mřížku & Blumensaatovu linii"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>B&H MŘÍŽKA</span>
          </button>
        </div>

        {/* Camera Preset Buttons */}
        <div className="flex items-center space-x-1 border-l border-composite-800 pl-2">
          <button
            onClick={() => setCameraPreset('anterior')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'anterior'
                ? 'bg-paper-100 text-composite-950 font-bold'
                : 'text-paper-300 hover:text-paper-100'
            }`}
            title="Přední pohled (Anterior)"
          >
            ANT
          </button>
          <button
            onClick={() => setCameraPreset('sagittal')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'sagittal'
                ? 'bg-paper-100 text-composite-950 font-bold'
                : 'text-paper-300 hover:text-paper-100'
            }`}
            title="Sagitální boční pohled (Lateral)"
          >
            SAG
          </button>
          <button
            onClick={() => setCameraPreset('axial')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'axial'
                ? 'bg-paper-100 text-composite-950 font-bold'
                : 'text-paper-300 hover:text-paper-100'
            }`}
            title="Axiální shora na plato"
          >
            AX
          </button>
          <button
            onClick={() => setCameraPreset('oblique')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activePreset === 'oblique'
                ? 'bg-paper-100 text-composite-950 font-bold'
                : 'text-paper-300 hover:text-paper-100'
            }`}
            title="Šikmý 3D pohled"
          >
            3D
          </button>
        </div>
      </div>

      {/* 3D Model Viewer Container (Off-white paper with subtle vignette) */}
      <div
        className={`relative w-full rounded-xl overflow-hidden mt-3 border border-composite-800 transition-all ${
          isFullscreen
            ? 'flex-1 min-h-[500px]'
            : isExpansive
            ? 'h-[580px] lg:h-[660px]'
            : 'h-[460px] md:h-[540px]'
        }`}
        style={{
          background: 'radial-gradient(circle at center, #FAF7F0 0%, #F3E9D7 70%, #E6D9C0 100%)',
        }}
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
          shadow-intensity="1.1"
          shadow-softness="0.8"
          exposure="1.05"
          camera-orbit="0deg 85deg 105%"
          min-camera-orbit="auto 0deg 30%"
          max-camera-orbit="auto 180deg 280%"
          interaction-prompt="none"
          loading="eager"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
          }}
        >
          {/* Slot for loading fallback */}
          <div slot="poster" className="w-full h-full flex items-center justify-center bg-[#F4EBD9]/90">
            <div className="flex flex-col items-center text-composite-950 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-hazard-500" />
              <span className="text-xs font-mono font-medium">Načítání 3D modelu...</span>
            </div>
          </div>
        </model-viewer>

        {/* Unobtrusive bottom-right gesture hint */}
        <div className="absolute bottom-3 right-3 bg-composite-950/70 backdrop-blur-sm rounded px-2.5 py-1 text-[11px] font-mono text-paper-200 pointer-events-none flex items-center gap-1.5 z-10 border border-composite-800">
          <Eye className="w-3.5 h-3.5 text-cyan-500" />
          <span>Rotace / Zoom / Posun</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-paper-300 pt-2 border-t border-composite-800 gap-2 font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-500" />
          <span>Bílé kosti • Žlutý štěp • Oranžové úpony • Cyan plato a mřížka</span>
        </div>
        <div className="text-[11px] text-paper-400">
          SKEN: {scan.id}
        </div>
      </div>
    </div>
  );
}
