import { useState, useEffect } from 'react';
import {
  Database,
  Download,
  RefreshCw,
  Search,
  X,
  Activity,
  User,
  Users,
  FileCheck,
} from 'lucide-react';
import { getDatabaseStats, getDatabaseRecords, getDatabaseDownloadUrl } from '../services/api';
import { DatabaseRecordsResponse, DatabaseStats } from '../types';

interface DatabaseExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatient: (patientId: string) => void;
}

export default function DatabaseExplorerModal({
  isOpen,
  onClose,
  onSelectPatient,
}: DatabaseExplorerModalProps) {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [records, setRecords] = useState<DatabaseRecordsResponse>({ patients: [], scans: [] });
  const [activeTab, setActiveTab] = useState<'scans' | 'patients'>('scans');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, recordsData] = await Promise.all([
        getDatabaseStats(),
        getDatabaseRecords(),
      ]);
      setStats(statsData);
      setRecords(recordsData);
    } catch (err) {
      console.error('Failed to load database explorer data:', err);
      setError('Could not load database records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPatients = (records.patients || []).filter(
    (p) =>
      p.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.graft_type && p.graft_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredScans = (records.scans || []).filter(
    (s) =>
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="panel-paper border border-paper-400 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-paper-400 bg-paper-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-paper-100 text-kraft-600 border border-paper-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-display uppercase tracking-wider text-composite-900">
                  Database
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper-100 text-kraft-600 border border-paper-400 font-bold">
                  acl_platform.db
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-paper-100 hover:bg-paper-200 text-composite-900 border border-paper-400 transition-colors"
              title="Obnovit data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-kraft-600' : ''}`} />
            </button>
            <a
              href={getDatabaseDownloadUrl()}
              download="acl_platform.db"
              className="px-3.5 py-1.5 rounded-lg bg-hazard-500 hover:bg-hazard-600 text-composite-950 text-xs font-display uppercase tracking-wider font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Download SQLite database"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download .db</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-paper-100 hover:bg-paper-200 text-kraft-600 hover:text-white border border-paper-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Quick Stats Bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-paper-100 border-b border-paper-400 text-xs">
            <div className="flex items-center space-x-2 font-mono">
              <Users className="w-4 h-4 text-kraft-600 flex-shrink-0" />
              <div>
                <span className="text-kraft-600 block text-[11px] uppercase">Patients</span>
                <span className="font-mono font-bold text-kraft-600">{stats.total_patients}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono">
              <FileCheck className="w-4 h-4 text-cyan-600 flex-shrink-0" />
              <div>
                <span className="text-kraft-600 block text-[11px] uppercase">Examinations</span>
                <span className="font-mono font-bold text-cyan-600">{stats.total_scans}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono">
              <Database className="w-4 h-4 text-kraft-700 flex-shrink-0" />
              <div className="truncate">
                <span className="text-kraft-600 block text-[11px] uppercase">Storage</span>
                <span className="font-mono font-bold text-composite-900 truncate block">
                  SQLite (acl_platform.db)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search & Tabs Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-paper-400 bg-paper-200">
          {/* Tabs */}
          <div className="flex items-center space-x-2 bg-paper-100 p-1 rounded-lg border border-paper-400">
            <button
              onClick={() => setActiveTab('scans')}
              className={`px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'scans'
                  ? 'bg-kraft-400 text-composite-950 font-bold shadow-sm'
                  : 'text-kraft-600 hover:text-composite-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Examinations ({records.scans.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('patients')}
              className={`px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'patients'
                  ? 'bg-kraft-400 text-composite-950 font-bold shadow-sm'
                  : 'text-kraft-600 hover:text-composite-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Patients ({records.patients.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-kraft-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by ID or graft..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper-100 border border-paper-400 rounded-lg text-xs text-composite-900 placeholder-paper-400/50 font-mono focus:outline-none focus:border-kraft-400 transition-colors"
            />
          </div>
        </div>

        {/* Content Table Area */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-4 font-mono">
              {error}
            </div>
          )}

          {activeTab === 'scans' ? (
            <div className="border border-paper-400 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-paper-100 border-b border-paper-400 text-kraft-700 font-mono uppercase text-[11px]">
                    <th className="py-2.5 px-3">Examination</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Scan date</th>
                    <th className="py-2.5 px-3">Months</th>
                    <th className="py-2.5 px-3">Graft volume</th>
                    <th className="py-2.5 px-3">Stav</th>
                    <th className="py-2.5 px-3">3D Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-400 bg-paper-100/40">
                  {filteredScans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-kraft-600 font-mono">
                        No examinations match the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredScans.map((s) => (
                      <tr key={s.id} className="hover:bg-paper-200/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-kraft-600 font-bold">{s.id}</td>
                        <td className="py-2.5 px-3 font-mono text-composite-900">
                          <button
                            onClick={() => {
                              onSelectPatient(s.patient_id);
                              onClose();
                            }}
                            className="text-cyan-600 hover:underline hover:text-cyan-300 font-bold cursor-pointer"
                            title="Select patient"
                          >
                            {s.patient_id}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-composite-900 font-mono">{s.scan_date}</td>
                        <td className="py-2.5 px-3 font-mono text-composite-900">{s.months_post_op} mo</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-600 font-semibold">
                          {s.metrics.acl_volume_mm3 === null
                            ? '—'
                            : `${s.metrics.acl_volume_mm3.toFixed(0)} mm³`}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                              s.status === 'ready'
                                ? 'bg-paper-100 border border-emerald-500/40 text-emerald-300'
                                : s.status === 'pending'
                                ? 'bg-paper-100 border border-amber-500/40 text-amber-300'
                                : 'bg-paper-100 border border-rose-500/40 text-rose-300'
                            }`}
                          >
                            {s.status === 'ready' ? 'READY' : s.status === 'pending' ? 'RUNNING' : 'FAILED'}
                          </span>
                          {s.is_demo && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-paper-100 border border-hazard-500/40 text-hazard-600">
                              DEMO
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 font-mono text-kraft-600 text-[11px] truncate max-w-[150px]"
                          title={s.model_url}
                        >
                          {s.model_url.split('/').pop()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-paper-400 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-paper-100 border-b border-paper-400 text-kraft-700 font-mono uppercase text-[11px]">
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Surgery date</th>
                    <th className="py-2.5 px-3">Graft type</th>
                    <th className="py-2.5 px-3">Examinations</th>
                    <th className="py-2.5 px-3 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-400 bg-paper-100/40">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-kraft-600 font-mono">
                        No patients match the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((p) => (
                      <tr key={p.patient_id} className="hover:bg-paper-200/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-kraft-600 font-bold">{p.patient_id}</td>
                        <td className="py-2.5 px-3 text-composite-900 font-mono">{p.surgery_date}</td>
                        <td className="py-2.5 px-3 text-composite-900">{p.graft_type}</td>
                        <td className="py-2.5 px-3 font-mono text-composite-900">{p.total_scans}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              onSelectPatient(p.patient_id);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-paper-100 hover:bg-paper-200 text-kraft-600 border border-kraft-400/40 font-mono text-[11px] transition-colors cursor-pointer"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-paper-400 bg-paper-100 flex flex-wrap items-center justify-between text-xs text-kraft-600 font-mono gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-kraft-600" />
            <span>
              SQLite soubor:{' '}
              <code className="text-kraft-700 font-mono">c:\acl-web-app\backend\acl_platform.db</code>
            </span>
          </div>
          <span className="text-[11px] text-kraft-600">
            Open with DB Browser for SQLite
          </span>
        </div>
      </div>
    </div>
  );
}
