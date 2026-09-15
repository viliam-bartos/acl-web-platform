import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Database,
} from 'lucide-react';
import PatientSelect from './components/PatientSelect';
import FileUpload from './components/FileUpload';
import MeshViewer from './components/MeshViewer';
import TrendChart from './components/TrendChart';
import QuantificationCard from './components/QuantificationCard';
import DatabaseExplorerModal from './components/DatabaseExplorerModal';
import {
  getPatients,
  getPatientHistory,
  analyzeScan,
  analyzeReferenceScan,
  createPatient,
} from './services/api';
import {
  Patient,
  PatientCreateData,
  PatientHistory,
  RadiomicsSummary,
  ScanRecord,
} from './types';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('ACL_042');
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<RadiomicsSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState<boolean>(false);
  const [isExpansive3D, setIsExpansive3D] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadPatients = async (preferredId: string | null = null) => {
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

  const loadHistory = async (patientId: string) => {
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

  const handleUploadScan = async (patientId: string, monthsPostOp: number, file: File) => {
    setIsProcessing(true);
    try {
      const res = await analyzeScan(patientId, monthsPostOp, file);
      setLatestAnalysis(res.radiomics_summary);
      showToast(`Scan processed: ${res.message}`);
      await loadPatients(patientId);
      await loadHistory(patientId);
      setSelectedScan(res.scan);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error processing MRI scan', 'error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeReference = async (patientId: string, monthsPostOp: number) => {
    setIsProcessing(true);
    try {
      const res = await analyzeReferenceScan(patientId, monthsPostOp);
      setLatestAnalysis(res.radiomics_summary);
      showToast(`Referenční vyšetření (Case 074) načteno.`);
      await loadPatients(patientId);
      await loadHistory(patientId);
      setSelectedScan(res.scan);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error evaluating reference scan', 'error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePatient = async (patientData: PatientCreateData) => {
    const res = await createPatient(patientData);
    showToast(`Registrován pacient ${res.patient_id}`);
    await loadPatients(res.patient_id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-composite-950 text-paper-100 font-sans">
      {/* Top Clinical Header */}
      <header className="sticky top-0 z-40 bg-composite-900 border-b border-composite-800 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-composite-850 text-kraft-400 border border-composite-800 shadow-md font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-display uppercase tracking-wider text-paper-100">
                ACL Web Platform
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-composite-850 text-kraft-400 border border-composite-800 font-bold">
                v1.0
              </span>
            </div>
            <p className="text-xs text-paper-300/70 hidden sm:block font-sans">
              Longitudinal ACL Graft Remodeling & Ligamentization Analysis
            </p>
          </div>
        </div>

        {/* Status Indicators & Database Button */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
          <button
            onClick={() => setIsDatabaseOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-composite-850 hover:bg-composite-800 border border-composite-800 text-paper-200 hover:text-kraft-300 transition-colors shadow-sm font-mono text-xs cursor-pointer"
            title="Otevřít Prohlížeč Databáze"
          >
            <Database className="w-4 h-4 text-kraft-400" />
            <span className="font-semibold">Databáze</span>
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-composite-850 border border-composite-800 font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
            <span className="text-paper-300/70 hidden md:inline">Server:</span>
            <span className={backendOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {backendOnline ? 'Aktivní' : 'Odpojeno'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {toast && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center justify-between border shadow-xl transition-all font-mono text-xs ${
              toast.type === 'error'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                : 'bg-composite-850 border border-kraft-400/50 text-paper-100'
            }`}
          >
            <div className="flex items-center space-x-3 text-sm">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              ) : (
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-kraft-400" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-1 cursor-pointer font-mono"
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
                  <QuantificationCard
                    scan={selectedScan}
                    latestAnalysis={latestAnalysis}
                  />
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

              {selectedScan && (
                <QuantificationCard
                  scan={selectedScan}
                  latestAnalysis={latestAnalysis}
                />
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
      <footer className="border-t border-composite-800 px-4 sm:px-8 py-4 text-center text-xs text-paper-400/60 font-mono">
        <p>ACL Web Platform • Systém pro analýzu a 3D vizualizaci rekonstrukce předního zkříženého vazu</p>
      </footer>
    </div>
  );
}
