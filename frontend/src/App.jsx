import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Cpu,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import PatientSelect from './components/PatientSelect';
import FileUpload from './components/FileUpload';
import MeshViewer from './components/MeshViewer';
import TrendChart from './components/TrendChart';
import {
  getPatients,
  getPatientHistory,
  analyzeScan,
  createPatient
} from './services/api';

export default function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('ACL_042');
  const [history, setHistory] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [toast, setToast] = useState(null);

  // Show transient toast notifications
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load cohort patients list
  const loadPatients = async (preferredId = null) => {
    setIsLoadingCohort(true);
    try {
      const data = await getPatients();
      setPatients(data);
      setBackendOnline(true);

      const targetId = preferredId || (data.length > 0 ? data[0].patient_id : null);
      if (targetId) {
        setSelectedPatientId(targetId);
      }
    } catch (err) {
      console.error('Failed to connect to backend:', err);
      setBackendOnline(false);
    } finally {
      setIsLoadingCohort(false);
    }
  };

  // Load specific patient history when selected
  const loadHistory = async (patientId) => {
    if (!patientId) return;
    try {
      const data = await getPatientHistory(patientId);
      setHistory(data);
      setBackendOnline(true);
      // Automatically select latest scan
      if (data.scans && data.scans.length > 0) {
        const sorted = [...data.scans].sort((a, b) => b.months_post_op - a.months_post_op);
        setSelectedScan(sorted[0]);
      } else {
        setSelectedScan(null);
      }
    } catch (err) {
      console.error(`Failed to load history for ${patientId}:`, err);
    }
  };

  useEffect(() => {
    loadPatients('ACL_042');
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      loadHistory(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Handle uploading and analyzing a new MRI scan
  const handleUploadScan = async (patientId, monthsPostOp, file) => {
    setIsProcessing(true);
    try {
      const res = await analyzeScan(patientId, monthsPostOp, file);
      showToast(`Scan at ${monthsPostOp} months processed successfully! Reconstructed 3D mesh ready.`);
      await loadPatients(patientId);
      await loadHistory(patientId);
      setSelectedScan(res.scan);
    } catch (err) {
      showToast(err.message || 'Error processing MRI scan', 'error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle creating a new anonymized subject ID
  const handleCreatePatient = async (patientData) => {
    const res = await createPatient(patientData);
    showToast(`Registered anonymized subject ${res.patient_id}`);
    await loadPatients(res.patient_id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Clinical Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/20 font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                ACL Web Platform
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                v1.0 • PyVista & 3D UNet
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Longitudinal ACL Graft Remodeling & Ligamentization Analysis
            </p>
          </div>
        </div>

        {/* Status Indicators & Privacy Badge */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">Pseudoanonymized</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className={`w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300 hidden md:inline">Backend:</span>
            <span className={backendOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {backendOnline ? 'FastAPI Active' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Toast alert banner */}
        {toast && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between border shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              : 'bg-teal-500/20 border-teal-500/40 text-teal-200'
          }`}>
            <div className="flex items-center space-x-3 text-sm">
              {toast.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Patient Selector Bar */}
        <PatientSelect
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={(id) => setSelectedPatientId(id)}
          onRefresh={() => loadPatients(selectedPatientId)}
          onCreatePatient={handleCreatePatient}
          isLoading={isLoadingCohort}
        />

        {/* Main 2-Column Responsive Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload and Trend Chart (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-6">
            <FileUpload
              patientId={selectedPatientId}
              onUploadSuccess={handleUploadScan}
              isProcessing={isProcessing}
            />

            <TrendChart
              scans={history?.scans || []}
              selectedScanId={selectedScan?.id}
              onSelectScan={(scan) => setSelectedScan(scan)}
            />
          </div>

          {/* Right Column: 3D Mesh Viewer and Quantitative Metrics (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-6">
            <MeshViewer
              scan={selectedScan}
              patientId={selectedPatientId}
            />

            {/* Remodeling Morphometrics & Radiomics Card */}
            {selectedScan && (
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                  <Cpu className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Radiomic & Morphometric Quantitation
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Ligament Volume</span>
                    <span className="font-mono text-base font-bold text-teal-300">
                      {selectedScan.volume_mm3.toFixed(1)} <span className="text-xs text-slate-400 font-sans">mm³</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Integrity Index</span>
                    <span className="font-mono text-base font-bold text-amber-300">
                      {selectedScan.integrity_score.toFixed(1)} <span className="text-xs text-slate-400 font-sans">%</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Follow-Up Post-Op</span>
                    <span className="font-mono text-sm font-semibold text-slate-200">
                      {selectedScan.months_post_op} <span className="text-xs text-slate-400 font-sans">months</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Examination Date</span>
                    <span className="font-mono text-sm font-semibold text-slate-200">
                      {selectedScan.scan_date}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">Ligamentization Maturation Assessment</span>
                    <span>
                      {selectedScan.integrity_score >= 80
                        ? 'Mature collagen remodeling detected. High fiber density and structural integrity suitable for unrestricted sports load.'
                        : selectedScan.integrity_score >= 65
                        ? 'Active revascularization and cellular proliferation phase. Graft remodeling proceeding within expected clinical bounds.'
                        : 'Early postoperative remodeling phase with characteristic temporary signal drop and biological graft incorporation.'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-4 sm:px-8 py-4 text-center text-xs text-slate-400">
        <p>ACL Web Platform • Designed for Longitudinal Graft Remodeling Assessment • Strict Zero-PII Policy</p>
      </footer>
    </div>
  );
}
