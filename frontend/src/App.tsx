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
      if (targetId) setSelectedPatientId(targetId);
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
    if (selectedPatientId) loadHistory(selectedPatientId);
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
      await applyResult(patientId, 'Vyšetření zpracováno.', res.warnings);
    } catch (err) {
      if (err instanceof AnalysisPendingError) {
        setPendingScanId(err.scanId ?? null);
        setWarnings([]);
        showToast(err.message, 'error');
        await loadHistory(patientId);
      } else {
        showToast(err instanceof Error ? err.message : 'Analýza selhala.', 'error');
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
      await applyResult(patientId, 'Referenční případ zpracován.', res.warnings);
    } catch (err) {
      if (err instanceof AnalysisPendingError) {
        setPendingScanId(err.scanId ?? null);
        showToast(err.message, 'error');
        await loadHistory(patientId);
      } else {
        showToast(err instanceof Error ? err.message : 'Analýza selhala.', 'error');
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
        await applyResult(selectedPatientId, 'Výsledek převzat.', res.warnings);
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Výsledek se nepodařilo převzít.', 'error');
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
    <div className="min-h-screen flex flex-col bg-paper-100 text-composite-900 font-sans">
      <header className="sticky top-0 z-40 bg-paper-50 border-b border-paper-400 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-kraft-600" />
          <h1 className="text-lg font-bold font-display uppercase tracking-wider">ACL</h1>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setIsDatabaseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-100 hover:bg-paper-200 border border-paper-400 transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4 text-kraft-600" />
            Databáze
          </button>

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-100 border border-paper-400"
            title={worker?.detail ?? worker?.device ?? 'Výpočetní worker'}
          >
            <span className={`w-2 h-2 rounded-full ${worker?.reachable ? 'bg-cyan-500' : 'bg-hazard-500'}`} />
            <span className="text-kraft-700">Worker</span>
            <span className={worker?.reachable ? 'text-cyan-600 font-bold' : 'text-hazard-600 font-bold'}>
              {worker?.reachable ? 'OK' : 'OFF'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-100 border border-paper-400">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-kraft-700">Server</span>
            <span className={backendOnline ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
              {backendOnline ? 'OK' : 'OFF'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-4">
        {toast && (
          <div
            className={`p-3 rounded-lg flex items-center justify-between border text-xs font-mono ${
              toast.type === 'error'
                ? 'bg-rose-100 border-rose-300 text-rose-800'
                : 'bg-paper-50 border-paper-400 text-composite-900'
            }`}
          >
            <span className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              )}
              {toast.message}
            </span>
            <button onClick={() => setToast(null)} className="px-2 cursor-pointer">
              zavřít
            </button>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-paper-50 border border-hazard-500/50 text-xs font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-hazard-600">
                <AlertTriangle className="w-4 h-4" />
                Poznámky k výpočtu
              </span>
              <button onClick={() => setWarnings([])} className="px-2 cursor-pointer">
                zavřít
              </button>
            </div>
            {warnings.map((warning, index) => (
              <div key={index} className="pl-6">
                {warning}
              </div>
            ))}
          </div>
        )}

        {pendingScanId && (
          <div className="p-3 rounded-lg bg-paper-50 border border-cyan-500/50 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <span>
              Výpočet běží, vyšetření {pendingScanId} je zařazené.
            </span>
            <button
              onClick={handleRefreshPending}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              Převzít výsledek
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <MeshViewer scan={selectedScan} patientId={selectedPatientId} />
            {selectedScan && <QuantificationCard scan={selectedScan} />}
          </div>

          <div className="lg:col-span-5 space-y-4">
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
        </div>
      </main>

      <DatabaseExplorerModal
        isOpen={isDatabaseOpen}
        onClose={() => setIsDatabaseOpen(false)}
        onSelectPatient={(id) => setSelectedPatientId(id)}
      />
    </div>
  );
}
