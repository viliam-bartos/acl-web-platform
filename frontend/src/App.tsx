import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Database, RefreshCw } from 'lucide-react';
import PatientSelect from './components/PatientSelect';
import FileUpload from './components/FileUpload';
import MeshViewer from './components/MeshViewer';
import TrendChart from './components/TrendChart';
import QuantificationCard from './components/QuantificationCard';
import DatabaseExplorerModal from './components/DatabaseExplorerModal';
import {
  AnalysisPendingError,
  getHealth,
  getPatientHistory,
  getPatients,
  analyzeScan,
  analyzeReferenceScan,
  createPatient,
  latestReadyScan,
  refreshScan,
} from './services/api';
import { Patient, PatientCreateData, PatientHistory, ScanRecord, WorkerHealth } from './types';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('ACL_042');
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingCohort, setIsLoadingCohort] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [worker, setWorker] = useState<WorkerHealth | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingScanId, setPendingScanId] = useState<string | null>(null);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState<boolean>(false);
  const [isExpansive3D, setIsExpansive3D] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const loadHealth = useCallback(async () => {
    try {
      const health = await getHealth();
      setWorker(health.compute_worker);
      setBackendOnline(true);
    } catch (err) {
      console.error('Backend není dostupný:', err);
      setBackendOnline(false);
      setWorker(null);
    }
  }, []);

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
      // Vybíráme nejnovější **hotové** vyšetření; rozpracované nemá metriky.
      setSelectedScan(latestReadyScan(data.scans));
    } catch (err) {
      console.error(`Failed to load history for ${patientId}:`, err);
    }
  };

  useEffect(() => {
    loadPatients('ACL_042');
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (selectedPatientId) {
      loadHistory(selectedPatientId);
    }
  }, [selectedPatientId]);

  const applyResult = async (patientId: string, message: string, resultWarnings: string[]) => {
    setWarnings(resultWarnings);
    showToast(message);
    await loadPatients(patientId);
    await loadHistory(patientId);
    await loadHealth();
  };

  const handleUploadScan = async (patientId: string, monthsPostOp: number, file: File) => {
    setIsProcessing(true);
    setPendingScanId(null);
    try {
      const res = await analyzeScan(patientId, monthsPostOp, file);
      setSelectedScan(res.scan);
      await applyResult(patientId, `Vyšetření zpracováno workerem. ${res.message}`, res.warnings);
    } catch (err) {
      if (err instanceof AnalysisPendingError) {
        // Výpočet běží dál; záznam zůstává ve stavu pending a jde dotáhnout.
        setPendingScanId(err.scanId ?? null);
        setWarnings([]);
        showToast(err.message, 'error');
        await loadHistory(patientId);
      } else {
        showToast(err instanceof Error ? err.message : 'Analýza skenu selhala.', 'error');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeReference = async (patientId: string, monthsPostOp: number) => {
    setIsProcessing(true);
    setPendingScanId(null);
    try {
      const res = await analyzeReferenceScan(patientId, monthsPostOp);
      setSelectedScan(res.scan);
      await applyResult(patientId, 'Referenční vyšetření (Case 074) zpracováno.', res.warnings);
    } catch (err) {
      if (err instanceof AnalysisPendingError) {
        setPendingScanId(err.scanId ?? null);
        showToast(err.message, 'error');
        await loadHistory(patientId);
      } else {
        showToast(err instanceof Error ? err.message : 'Zhodnocení referenčního skenu selhalo.', 'error');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshPending = async () => {
    if (!pendingScanId || !selectedPatientId) return;
    setIsProcessing(true);
    try {
      const res = await refreshScan(pendingScanId);
      if (res.status === 'success') {
        setPendingScanId(null);
        setSelectedScan(res.scan);
        await applyResult(selectedPatientId, 'Výsledek dotažen z workera.', res.warnings);
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Výsledek se nepodařilo dotáhnout.', 'error');
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
                v2.0
              </span>
            </div>
            <p className="text-xs text-paper-300/70 hidden sm:block font-sans">
              Tenká aplikace • veškerý výpočet dělá worker na výkonném počítači
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

          <div
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-composite-850 border border-composite-800 font-mono text-xs"
            title={worker?.detail ?? worker?.device ?? 'Výpočetní worker'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                worker?.reachable ? 'bg-cyan-400' : 'bg-hazard-500'
              }`}
            />
            <span className="text-paper-300/70 hidden md:inline">Worker:</span>
            <span className={worker?.reachable ? 'text-cyan-400 font-bold' : 'text-hazard-400 font-bold'}>
              {worker?.reachable ? 'Připojen' : 'Nedostupný'}
            </span>
          </div>

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

        {/* Varování z workera – například že se nepočítala radiomika */}
        {warnings.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-composite-850 border border-hazard-500/40 text-paper-200 text-xs font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-hazard-400">
                <AlertTriangle className="w-4 h-4" />
                Poznámky k výpočtu
              </span>
              <button
                onClick={() => setWarnings([])}
                className="text-xs opacity-70 hover:opacity-100 px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
            {warnings.map((warning, index) => (
              <div key={index} className="pl-6">
                • {warning}
              </div>
            ))}
          </div>
        )}

        {/* Nedokončený výpočet, který překročil časový limit požadavku */}
        {pendingScanId && (
          <div className="mb-6 p-4 rounded-xl bg-composite-850 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono text-paper-200">
              <span className="font-bold text-cyan-400 block">Výpočet na workeru stále běží</span>
              Vyšetření {pendingScanId} je zařazené. Až doběhne, dotáhněte výsledek.
            </div>
            <button
              onClick={handleRefreshPending}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-composite-950 font-display uppercase tracking-wider font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              Dotáhnout výsledek
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
                {selectedScan && <QuantificationCard scan={selectedScan} />}
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

              {selectedScan && <QuantificationCard scan={selectedScan} />}
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
        <p>
          ACL Web Platform • Naměřené parametry, žádné odhady. Souhrnné skóre se nepočítá, dokud
          neexistuje model natrénovaný na datech.
        </p>
      </footer>
    </div>
  );
}
