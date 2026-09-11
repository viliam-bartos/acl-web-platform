import React, { useState, useRef } from 'react';
import { Box, RotateCw, Maximize2, RefreshCw, Eye, Activity, Info } from 'lucide-react';
import { resolveModelUrl } from '../services/api';

export default function MeshViewer({
  scan,
  patientId
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [exposure, setExposure] = useState('1.1');
  const modelViewerRef = useRef(null);

  if (!scan) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center min-h-[440px] text-center">
        <div className="p-4 rounded-full bg-slate-800/80 text-slate-500 mb-3 border border-slate-700/60">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No 3D Scan Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Select a patient and scan from the timeline or upload a new MRI volume to view the reconstructed 3D graft mesh.
        </p>
      </div>
    );
  }

  const modelUrl = resolveModelUrl(scan.model_url);

  const resetCamera = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.cameraOrbit = '45deg 75deg 105%';
      modelViewerRef.current.fieldOfView = 'auto';
    }
  };

  const getIntegrityBadge = (score) => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        label: 'Maturation / High Integrity'
      };
    }
    if (score >= 65) {
      return {
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        label: 'Revascularization / Moderate'
      };
    }
    return {
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      label: 'Early Necrotic / Vulnerable'
    };
  };

  const badge = getIntegrityBadge(scan.integrity_score);

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6 relative overflow-hidden flex flex-col">
      {/* Header with Title and Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              3D ACL Graft Surface Mesh
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.bg}`}>
                {scan.integrity_score.toFixed(1)}% Integrity
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Subject <span className="font-mono text-teal-300">{patientId}</span> • Follow-up at <strong className="text-slate-200">{scan.months_post_op} months</strong> post-op
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              autoRotate
                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle 360 Auto-Rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            <span>Auto-Rotate</span>
          </button>

          <button
            onClick={resetCamera}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Reset Camera View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Model Viewer Container */}
      <div className="relative w-full h-[400px] md:h-[480px] rounded-xl overflow-hidden mt-4 border border-slate-800/80">
        <model-viewer
          ref={modelViewerRef}
          src={modelUrl}
          alt={`3D Model of ACL Graft - ${scan.id}`}
          camera-controls
          touch-action="pan-y"
          auto-rotate={autoRotate ? true : undefined}
          auto-rotate-delay="500"
          rotation-per-second="18deg"
          shadow-intensity="1.4"
          shadow-softness="0.8"
          exposure={exposure}
          camera-orbit="45deg 75deg 105%"
          min-camera-orbit="auto auto 30%"
          max-camera-orbit="auto auto 250%"
          interaction-prompt="none"
          loading="eager"
        >
          {/* Slot for progress or loading fallback */}
          <div slot="poster" className="w-full h-full flex items-center justify-center bg-slate-950/80">
            <div className="flex flex-col items-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
              <span className="text-xs">Loading 3D mesh surface...</span>
            </div>
          </div>
        </model-viewer>

        {/* In-viewport metric HUD overlay (upper-left) */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md rounded-xl p-3 border border-slate-800/80 shadow-lg text-xs space-y-1.5 pointer-events-none">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Graft Volume:</span>
            <span className="font-mono font-semibold text-teal-300">{scan.volume_mm3.toFixed(1)} mm³</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Integrity Score:</span>
            <span className="font-mono font-semibold text-amber-300">{scan.integrity_score.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Timeline:</span>
            <span className="font-mono text-slate-200">{scan.months_post_op} mo</span>
          </div>
        </div>

        {/* In-viewport gesture helper overlay (bottom-right) */}
        <div className="absolute bottom-3 right-3 bg-slate-950/70 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-slate-800/60 text-[11px] text-slate-400 pointer-events-none flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-teal-400" />
          <span>Left click/touch to orbit • Scroll/pinch to zoom</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-teal-400" />
          <span>Surface mesh processed via PyVista 3D Isosurface algorithm.</span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          ID: {scan.id}
        </div>
      </div>
    </div>
  );
}
