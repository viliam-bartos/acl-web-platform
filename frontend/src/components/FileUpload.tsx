import React, { useState, useRef } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Loader2, Sparkles, Layers, Database } from 'lucide-react';

interface FileUploadProps {
  patientId: string;
  onUploadSuccess: (patientId: string, monthsPostOp: number, file: File) => Promise<unknown>;
  onAnalyzeReference: (patientId: string, monthsPostOp: number) => Promise<unknown>;
  isProcessing: boolean;
}

export default function FileUpload({
  patientId,
  onUploadSuccess,
  onAnalyzeReference,
  isProcessing,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [monthsPostOp, setMonthsPostOp] = useState('6.0');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMsg('');
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select or drop an MRI scan file (DICOM / NIfTI).');
      return;
    }
    if (!patientId) {
      setErrorMsg('Please select a subject ID before uploading.');
      return;
    }

    try {
      setErrorMsg('');
      await onUploadSuccess(patientId, parseFloat(monthsPostOp) || 0, selectedFile);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload and 3D reconstruction failed.');
    }
  };

  const handleQuickReference = async () => {
    if (!patientId) {
      setErrorMsg('Please select a subject ID first.');
      return;
    }
    try {
      setErrorMsg('');
      await onAnalyzeReference(patientId, parseFloat(monthsPostOp) || 6.0);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reference scan evaluation failed.');
    }
  };

  return (
    <div className="panel-composite rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-composite-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-composite-850 text-kraft-400 border border-composite-800">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display uppercase tracking-wider text-paper-100 flex items-center gap-2">
              Nahrání MRI Vyšetření
            </h2>
            <p className="text-xs text-paper-300/70">
              Segmentace struktur kolenního kloubu a geometrická analýza štěpu
            </p>
          </div>
        </div>

        {/* 1-Click Reference Dataset Button */}
        <button
          type="button"
          onClick={handleQuickReference}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-composite-850 hover:bg-composite-800 text-kraft-300 border border-kraft-400/40 text-xs font-mono font-medium transition-all shadow-sm disabled:opacity-50"
          title="Načíst referenční MRI data (Case 074)"
        >
          <Database className="w-3.5 h-3.5 text-kraft-400" />
          <span>Referenční MRI (Case 074)</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-mono uppercase tracking-wider text-paper-300/80 mb-1.5 flex items-center justify-between">
              <span>Time Post-Op (Months)</span>
              <span className="text-[11px] text-cyan-400 font-mono font-bold">{monthsPostOp} mo</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              required
              value={monthsPostOp}
              onChange={(e) => setMonthsPostOp(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-composite-950 border border-composite-800 text-paper-100 text-sm focus:border-kraft-400 focus:outline-none font-mono"
            />
            <span className="text-[10px] text-paper-400/60 mt-1 block font-mono">e.g. 1.5, 3.0, 6.0, 12.0, 24.0</span>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-paper-300/80 mb-1.5">
              Subject Target ID
            </label>
            <div className="px-3.5 py-2.5 rounded-lg bg-composite-950 border border-composite-800 text-kraft-400 text-sm font-mono flex items-center justify-between">
              <span className="font-bold">{patientId || 'No patient selected'}</span>
              <span className="text-xs text-paper-400/60 font-mono">Active Subject</span>
            </div>
          </div>
        </div>

        {/* Drag and drop container */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-hazard-500 bg-hazard-500/10 scale-[0.99]'
              : selectedFile
              ? 'border-kraft-400 bg-composite-850/80'
              : 'border-composite-800 hover:border-kraft-400/60 bg-composite-950/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            accept=".nii,.gz,.dcm,.zip,.mha,.nrrd"
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 rounded-full bg-kraft-400/20 text-kraft-400">
                <FileCheck className="w-7 h-7" />
              </div>
              <div className="font-medium text-sm text-paper-100 font-mono max-w-sm truncate">
                {selectedFile.name}
              </div>
              <div className="text-xs text-cyan-400 font-mono">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for 3D processing
              </div>
              <span className="text-[11px] text-paper-400/70 underline pt-1 font-mono">Click to change file</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 rounded-full bg-composite-850 text-paper-300 group-hover:text-kraft-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-paper-200">
                Drag & drop 3D MRI volume or <span className="text-kraft-400 underline">browse</span>
              </div>
              <div className="text-xs text-paper-400/60 font-mono">
                Supports DICOM (.dcm, .zip), NIfTI (.nii, .nii.gz), or MHA
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isProcessing || !selectedFile}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-hazard-500 hover:bg-hazard-600 text-composite-950 font-display uppercase tracking-wider font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Probíhá zpracování a 3D rekonstrukce...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Spustit 3D Analýzu</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
