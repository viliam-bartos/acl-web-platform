import React, { useState, useRef } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Loader2, Sparkles, Layers, Database } from 'lucide-react';

export default function FileUpload({
  patientId,
  onUploadSuccess,
  onAnalyzeReference,
  isProcessing
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [monthsPostOp, setMonthsPostOp] = useState('6.0');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMsg('');
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
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
      setErrorMsg(err.message || 'Upload and 3D reconstruction failed.');
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
      setErrorMsg(err.message || 'Reference scan evaluation failed.');
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              Upload MRI Examination
            </h2>
            <p className="text-xs text-slate-400">
              3D LightUNet segmentation, PyRadiomics textural extraction & PyVista 3D meshing
            </p>
          </div>
        </div>

        {/* 1-Click Reference Dataset Button */}
        <button
          type="button"
          onClick={handleQuickReference}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
          title="Analyze reference MRI volume right_case_074.nii.gz from C:\ACL_analysis\ACL_graft_analysis"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ Load Reference MRI (Case 074)</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Time Post-Op (Months)</span>
              <span className="text-[11px] text-teal-400 font-mono">{monthsPostOp} mo</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              required
              value={monthsPostOp}
              onChange={(e) => setMonthsPostOp(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-teal-400 focus:outline-none font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">e.g. 1.5 (6wks), 3.0, 6.0, 12.0, 24.0</span>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Subject Target ID
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-teal-300 text-sm font-mono flex items-center justify-between">
              <span>{patientId || 'No patient selected'}</span>
              <span className="text-xs text-slate-400 font-sans">Active Subject</span>
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
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-teal-400 bg-teal-500/10 scale-[0.99]'
              : selectedFile
              ? 'border-teal-500/50 bg-teal-950/20'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40'
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
              <div className="p-3 rounded-full bg-teal-500/20 text-teal-400">
                <FileCheck className="w-7 h-7" />
              </div>
              <div className="font-medium text-sm text-white max-w-sm truncate">
                {selectedFile.name}
              </div>
              <div className="text-xs text-teal-400/80">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for 3D processing
              </div>
              <span className="text-[11px] text-slate-400 underline pt-1">Click to change file</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 rounded-full bg-slate-800 text-slate-400 group-hover:text-teal-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-slate-200">
                Drag & drop 3D MRI volume or <span className="text-teal-400 underline">browse</span>
              </div>
              <div className="text-xs text-slate-500">
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
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-teal-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running 3D Segment & PyVista Meshing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Execute 3D Remodeling Pipeline</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
