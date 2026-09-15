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
  AlertCircle,
  Compass,
  Maximize,
  Database
} from 'lucide-react';
import PatientSelect from './components/PatientSelect';
import FileUpload from './components/FileUpload';
import MeshViewer from './components/MeshViewer';
import TrendChart from './components/TrendChart';
import DatabaseExplorerModal from './components/DatabaseExplorerModal';
import {
  getPatients,
  getPatientHistory,
  analyzeScan,
  analyzeReferenceScan,
  createPatient
} from './services/api';

export default function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('ACL_042');
  const [history, setHistory] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isExpansive3D, setIsExpansive3D] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

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

  const loadHistory = async (patientId) => {
    if (!patientId) return;
    try {
      const data = await getPatientHistory(patientId);
      setHistory(data);
      setBackendOnline(true);
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

  const handleUploadScan = async (patientId, monthsPostOp, file) => {
    setIsProcessing(true);
    try {
      const res = await analyzeScan(patientId, monthsPostOp, file);
      setLatestAnalysis(res.radiomics_summary);
      showToast(`Scan processed: ${res.message}`);
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

  const handleAnalyzeReference = async (patientId, monthsPostOp) => {
    setIsProcessing(true);
    try {
      const res = await analyzeReferenceScan(patientId, monthsPostOp);
      setLatestAnalysis(res.radiomics_summary);
      showToast(`Referenční vyšetření (Case 074) načteno.`);
      await loadPatients(patientId);
      await loadHistory(patientId);
      setSelectedScan(res.scan);
    } catch (err) {
      showToast(err.message || 'Error evaluating reference scan', 'error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePatient = async (patientData) => {
    const res = await createPatient(patientData);
    showToast(`Registrován pacient ${res.patient_id}`);
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
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Longitudinal ACL Graft Remodeling & Ligamentization Analysis
            </p>
          </div>
        </div>

        {/* Status Indicators & Database Button */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
          <button
            onClick={() => setIsDatabaseOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-teal-300 transition-colors shadow-sm"
            title="Otevřít Prohlížeč Databáze"
          >
            <Database className="w-4 h-4 text-teal-400" />
            <span className="font-semibold">Databáze</span>
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80">
            <span className={`w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300 hidden md:inline">Server:</span>
            <span className={backendOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {backendOnline ? 'Aktivní' : 'Odpojeno'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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

        <PatientSelect
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={(id) => setSelectedPatientId(id)}
          onRefresh={() => loadPatients(selectedPatientId)}
          onCreatePatient={handleCreatePatient}
          isLoading={isLoadingCohort}
        />

        {isExpansive3D ? (
          /* Expansive 3D Studio Layout: Widescreen 3D Model on top */
          <div className="space-y-6">
            <MeshViewer
              scan={selectedScan}
              patientId={selectedPatientId}
              isExpansive={true}
              onToggleExpansive={() => setIsExpansive3D(false)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <FileUpload
                  patientId={selectedPatientId}
                  onUploadSuccess={handleUploadScan}
                  onAnalyzeReference={handleAnalyzeReference}
                  isProcessing={isProcessing}
                />
              </div>

              <div className="lg:col-span-4">
                {selectedScan && (
                  <div className="glass-panel rounded-2xl p-5 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2.5">
                          <Cpu className="w-4 h-4 text-teal-400" />
                          <h3 className="text-sm font-semibold text-white">
                            Anatomická & Radiomická Kvantifikace
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">ACL Objem</span>
                          <span className="font-mono text-base font-bold text-teal-300">
                            {selectedScan.volume_mm3.toFixed(1)} <span className="text-xs text-slate-400 font-sans">mm³</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Index integrity</span>
                          <span className="font-mono text-base font-bold text-amber-300">
                            {selectedScan.integrity_score.toFixed(1)} <span className="text-xs text-slate-400 font-sans">%</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Stäubli Tibial %</span>
                          <span className="font-mono text-sm font-semibold text-slate-200">
                            {latestAnalysis?.staubli_tibial_pct ? `${latestAnalysis.staubli_tibial_pct}%` : '32.6%'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Anterior Tibial Transl.</span>
                          <span className="font-mono text-sm font-semibold text-slate-200">
                            {latestAnalysis?.att_mm ? `${latestAnalysis.att_mm} mm` : '-1.3 mm'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Blumensaat Délka</span>
                          <span className="font-mono text-sm font-semibold text-slate-200">
                            {latestAnalysis?.bh_length_pct ? `${latestAnalysis.bh_length_pct}%` : '43.9%'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Šířka fosse</span>
                          <span className="font-mono text-sm font-semibold text-slate-200">
                            {latestAnalysis?.notch_width_mm ? `${latestAnalysis.notch_width_mm} mm` : '20.0 mm'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div className="text-[11px]">
                        <span className="font-semibold block text-white">Status hojení štěpu</span>
                        <span>
                          {selectedScan.integrity_score >= 80
                            ? 'Pokročilá ligamentizace s vysokou denzitou kolagenu vhodná pro plné sportovní zatížení.'
                            : selectedScan.integrity_score >= 65
                            ? 'Probíhá aktivní revaskularizace a buněčná proliferace. Hojení odpovídá pooperačnímu období.'
                            : 'Časná pooperační fáze biologické inkorporace štěpu v kostních tunelech.'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-4">
                <TrendChart
                  scans={history?.scans || []}
                  selectedScanId={selectedScan?.id}
                  onSelectScan={(scan) => setSelectedScan(scan)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Standard Split Layout: Prominent 3D viewer on right, Upload + Trend on left */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <FileUpload
                patientId={selectedPatientId}
                onUploadSuccess={handleUploadScan}
                onAnalyzeReference={handleAnalyzeReference}
                isProcessing={isProcessing}
              />

              <TrendChart
                scans={history?.scans || []}
                selectedScanId={selectedScan?.id}
                onSelectScan={(scan) => setSelectedScan(scan)}
              />
            </div>

            <div className="lg:col-span-7 space-y-6">
              <MeshViewer
                scan={selectedScan}
                patientId={selectedPatientId}
                isExpansive={false}
                onToggleExpansive={() => setIsExpansive3D(true)}
              />

              {/* Geometric & Radiomic Quantitation Panel */}
              {selectedScan && (
                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                      <Cpu className="w-4 h-4 text-teal-400" />
                      <h3 className="text-sm font-semibold text-white">
                        Anatomická & Radiomická Kvantifikace
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">ACL Objem</span>
                      <span className="font-mono text-base font-bold text-teal-300">
                        {selectedScan.volume_mm3.toFixed(1)} <span className="text-xs text-slate-400 font-sans">mm³</span>
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Integrita vazu</span>
                      <span className="font-mono text-base font-bold text-amber-300">
                        {selectedScan.integrity_score.toFixed(1)} <span className="text-xs text-slate-400 font-sans">%</span>
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Stäubli Tibial %</span>
                      <span className="font-mono text-sm font-semibold text-slate-200">
                        {latestAnalysis?.staubli_tibial_pct ? `${latestAnalysis.staubli_tibial_pct}%` : '32.6%'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Anterior Tibial Transl.</span>
                      <span className="font-mono text-sm font-semibold text-slate-200">
                        {latestAnalysis?.att_mm ? `${latestAnalysis.att_mm} mm` : '-1.3 mm'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Blumensaat Délka</span>
                      <span className="font-mono text-sm font-semibold text-slate-200">
                        {latestAnalysis?.bh_length_pct ? `${latestAnalysis.bh_length_pct}%` : '43.9%'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Šířka fosse</span>
                      <span className="font-mono text-sm font-semibold text-slate-200">
                        {latestAnalysis?.notch_width_mm ? `${latestAnalysis.notch_width_mm} mm` : '20.0 mm'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-white">Status hojení štěpu</span>
                      <span>
                        {selectedScan.integrity_score >= 80
                          ? 'Pokročilá ligamentizace s vysokou denzitou kolagenu vhodná pro plné sportovní zatížení.'
                          : selectedScan.integrity_score >= 65
                          ? 'Probíhá aktivní revaskularizace a buněčná proliferace. Hojení odpovídá pooperačnímu období.'
                          : 'Časná pooperační fáze biologické inkorporace štěpu v kostních tunelech.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Database Explorer Modal */}
      <DatabaseExplorerModal
        isOpen={isDatabaseOpen}
        onClose={() => setIsDatabaseOpen(false)}
        onSelectPatient={(id) => setSelectedPatientId(id)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-4 sm:px-8 py-4 text-center text-xs text-slate-400">
        <p>ACL Web Platform • Systém pro analýzu a 3D vizualizaci rekonstrukce předního zkříženého vazu</p>
      </footer>
    </div>
  );
}
