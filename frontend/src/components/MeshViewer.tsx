import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Expand, Eye, Layers, Minimize, RefreshCw, RotateCw, Shrink } from 'lucide-react';
import { resolveModelUrl } from '../services/api';
import { ScanRecord } from '../types';

interface MeshViewerProps {
  scan: ScanRecord | null;
  patientId: string;
}

interface LayerState {
  femur: boolean;
  tibia: boolean;
  acl: boolean;
  footprints: boolean;
  plateau: boolean;
  grid: boolean;
  centroids: boolean;
  axis: boolean;
}

const INITIAL_LAYERS: LayerState = {
  femur: true,
  tibia: true,
  acl: true,
  footprints: true,
  plateau: true,
  grid: true,
  centroids: true,
  axis: true,
};

/** Materiály, které mají zůstat průhledné i po opětovném zobrazení. */
const TRANSPARENT_PARTS = new Set(['femur', 'tibia']);

/**
 * Přiřadí materiál k vrstvě. Pořadí je podstatné: `Femoral_Centroid` obsahuje
 * "femur" a `ACL_Axis` obsahuje "acl", takže specifické názvy musí být první.
 */
function layerForMaterial(name: string): keyof LayerState | null {
  if (name.includes('centroid')) return 'centroids';
  if (name.includes('axis')) return 'axis';
  if (name.includes('footprint')) return 'footprints';
  if (name.includes('femur')) return 'femur';
  if (name.includes('tibia')) return 'tibia';
  if (name.includes('acl')) return 'acl';
  if (name.includes('plateau')) return 'plateau';
  if (name.includes('bh') || name.includes('grid') || name.includes('ref') || name.includes('blum')) {
    return 'grid';
  }
  return null;
}

const LAYER_BUTTONS: Array<{ key: keyof LayerState; label: string; swatch: string; title: string }> = [
  { key: 'femur', label: 'Femur', swatch: 'bg-white border border-slate-400', title: 'Kost stehenní' },
  { key: 'tibia', label: 'Tibia', swatch: 'bg-white border border-slate-400', title: 'Kost holenní' },
  { key: 'acl', label: 'Vaz', swatch: 'bg-yellow-400', title: 'Štěp' },
  { key: 'footprints', label: 'Úpony', swatch: 'bg-orange-500', title: 'Úponové plochy' },
  { key: 'plateau', label: 'Plato', swatch: 'bg-cyan-500', title: 'Rovina tibiálního plata' },
  { key: 'grid', label: 'B&H', swatch: 'bg-cyan-500', title: 'Bernard-Hertelova mřížka a Blumensaatova linie' },
  { key: 'centroids', label: 'Těžiště', swatch: 'bg-sky-500', title: 'Těžiště femorálního a tibiálního úponu' },
  { key: 'axis', label: 'Osa', swatch: 'bg-purple-400', title: 'Osa procházející štěpem' },
];

const CAMERA_PRESETS: Array<{ key: 'anterior' | 'sagittal' | 'axial' | 'oblique'; label: string; orbit: string; title: string }> = [
  { key: 'anterior', label: 'ANT', orbit: '0deg 85deg 105%', title: 'Přední pohled' },
  { key: 'sagittal', label: 'SAG', orbit: '90deg 85deg 105%', title: 'Sagitální pohled' },
  { key: 'axial', label: 'AX', orbit: '0deg 0deg 105%', title: 'Axiální pohled' },
  { key: 'oblique', label: '3D', orbit: '35deg 80deg 105%', title: 'Šikmý pohled' },
];

export default function MeshViewer({ scan, patientId }: MeshViewerProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverlayOnly, setIsOverlayOnly] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('anterior');
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS);

  const containerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);

  const applyLayerVisibilities = useCallback((current: LayerState) => {
    const model = modelViewerRef.current?.model;
    if (!model) return;

    for (const material of model.materials || []) {
      const name = (material.name || '').toLowerCase();
      const key = layerForMaterial(name);
      const visible = key === null ? true : current[key];

      if (typeof material.setAlphaMode !== 'function') continue;
      if (visible) {
        material.setAlphaMode(TRANSPARENT_PARTS.has(name) ? 'BLEND' : 'OPAQUE');
        if (typeof material.setAlphaCutoff === 'function') material.setAlphaCutoff(0);
      } else {
        material.setAlphaMode('MASK');
        if (typeof material.setAlphaCutoff === 'function') material.setAlphaCutoff(1);
      }
    }
  }, []);

  const toggleLayer = (key: keyof LayerState) => {
    setLayers((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      applyLayerVisibilities(next);
      return next;
    });
  };

  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;
    const handleLoad = () => applyLayerVisibilities(layers);
    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [scan?.model_url, layers, applyLayerVisibilities]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null || isOverlayOnly);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isOverlayOnly]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isOverlayOnly) {
        setIsOverlayOnly(false);
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayOnly]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (isOverlayOnly) {
      setIsOverlayOnly(false);
      setIsFullscreen(false);
      return;
    }
    if (typeof container.requestFullscreen === 'function') {
      container.requestFullscreen().catch(() => {
        setIsOverlayOnly(true);
        setIsFullscreen(true);
      });
      return;
    }
    setIsOverlayOnly(true);
    setIsFullscreen(true);
  }, [isOverlayOnly]);

  const setCameraPreset = (preset: (typeof CAMERA_PRESETS)[number]) => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;
    setActivePreset(preset.key);
    viewer.cameraOrbit = preset.orbit;
    viewer.fieldOfView = 'auto';
  };

  if (!scan) {
    return (
      <div className="panel-paper rounded-xl p-10 flex flex-col items-center justify-center min-h-[420px] text-center">
        <Box className="w-8 h-8 text-kraft-600 mb-3" />
        <p className="text-sm font-semibold text-composite-900">Není vybráno vyšetření</p>
        <p className="text-xs text-kraft-700 mt-1">
          Vyberte pacienta a vyšetření, nebo nahrajte nový sken.
        </p>
      </div>
    );
  }

  const modelUrl = resolveModelUrl(scan.model_url);
  const hasModel = scan.status === 'ready' && Boolean(modelUrl);

  return (
    <div
      ref={containerRef}
      className={`panel-paper transition-all duration-200 flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none p-4' : 'rounded-xl p-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-paper-400">
        <div className="flex flex-wrap items-center gap-2.5">
          <Box className="w-5 h-5 text-kraft-600" />
          <h2 className="text-lg font-bold font-display uppercase tracking-wider text-composite-900">
            3D rekonstrukce
          </h2>
          <span className="text-xs font-mono text-kraft-700">
            {patientId} · {scan.months_post_op} měs.
          </span>
          {scan.is_demo && <span className="badge-hazard text-[11px] px-2 py-0.5 rounded">UKÁZKOVÁ DATA</span>}
          {scan.status !== 'ready' && (
            <span className="badge-hazard text-[11px] px-2 py-0.5 rounded">
              {scan.status === 'pending' ? 'VÝPOČET BĚŽÍ' : 'VÝPOČET SELHAL'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAutoRotate((value) => !value)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-hazard-500 text-composite-950 border-hazard-600 font-bold'
                : 'bg-paper-50 border-paper-400 text-kraft-700 hover:bg-paper-200'
            }`}
            title="Otáčení modelu"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>360</span>
          </button>

          <button
            onClick={() => setCameraPreset(CAMERA_PRESETS[0])}
            className="p-1.5 rounded-lg bg-paper-50 hover:bg-paper-200 text-kraft-700 border border-paper-400 transition-colors cursor-pointer"
            title="Obnovit výchozí pohled"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isFullscreen
                ? 'bg-hazard-500 text-composite-950 border-hazard-600 font-bold'
                : 'bg-paper-50 hover:bg-paper-200 text-kraft-700 border-paper-400'
            }`}
            title={isFullscreen ? 'Ukončit celou obrazovku' : 'Zobrazit přes celou obrazovku'}
          >
            {isFullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Zavřít' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 border-b border-paper-400">
        <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-kraft-700">
          <Layers className="w-3.5 h-3.5" />
          Vrstvy
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {LAYER_BUTTONS.map((button) => (
            <button
              key={button.key}
              onClick={() => toggleLayer(button.key)}
              title={button.title}
              className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                layers[button.key]
                  ? 'bg-paper-50 border-paper-400 text-composite-900 font-semibold'
                  : 'bg-paper-200 border-paper-300 text-kraft-600 line-through opacity-60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${button.swatch}`} />
              {button.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setCameraPreset(preset)}
              title={preset.title}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                activePreset === preset.key
                  ? 'bg-composite-900 text-paper-50 font-bold'
                  : 'text-kraft-700 hover:bg-paper-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`relative w-full rounded-lg overflow-hidden mt-3 border border-paper-400 ${
          isFullscreen ? 'flex-1 min-h-0' : 'h-[480px] md:h-[560px]'
        }`}
      >
        {hasModel ? (
          <>
            <model-viewer
              ref={modelViewerRef}
              src={modelUrl}
              alt={`3D model kolene ${scan.id}`}
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
              style={{ width: '100%', height: '100%', background: 'transparent' }}
            >
              <div slot="poster" className="w-full h-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-hazard-500" />
              </div>
            </model-viewer>

            <div className="absolute bottom-3 right-3 rounded px-2.5 py-1 text-[11px] font-mono text-kraft-700 bg-paper-50/80 border border-paper-400 pointer-events-none flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Rotace, zoom, posun
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center gap-2">
            {scan.status === 'pending' ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin text-hazard-500" />
                <p className="text-sm text-composite-900">Model se ještě počítá</p>
              </>
            ) : (
              <>
                <Minimize className="w-6 h-6 text-kraft-600" />
                <p className="text-sm text-composite-900">Model není k dispozici</p>
                {scan.error && <p className="text-xs font-mono text-kraft-700">{scan.error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
