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
      setError('Nepodařilo se načíst data z databáze.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Prohlížeč Databáze
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
                  acl_platform.db
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Přímý přístup k záznamům pacientů, vyšetření a geometrických metrik
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Obnovit data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <a
              href={getDatabaseDownloadUrl()}
              download="acl_platform.db"
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Stáhnout SQLite databázi"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stáhnout .db</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Quick Stats Bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-slate-950/60 border-b border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">Celkem pacientů:</span>
                <span className="font-mono font-semibold text-teal-300">{stats.total_patients}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">Celkem MRI skenů:</span>
                <span className="font-mono font-semibold text-emerald-300">{stats.total_scans}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-400 block text-[11px]">Úložiště databáze:</span>
                <span className="font-mono font-semibold text-amber-300 truncate block">
                  SQLite (acl_platform.db)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search & Tabs Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-900">
          {/* Tabs */}
          <div className="flex items-center space-x-2 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('scans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'scans'
                  ? 'bg-teal-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Tabulka Skenů ({records.scans.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('patients')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'patients'
                  ? 'bg-teal-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tabulka Pacientů ({records.patients.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrovat podle ID, štěpu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Table Area */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-4">
              {error}
            </div>
          )}

          {activeTab === 'scans' ? (
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">ID Skenu</th>
                    <th className="py-2.5 px-3">Pacient</th>
                    <th className="py-2.5 px-3">Datum skenu</th>
                    <th className="py-2.5 px-3">Měsíců post-op</th>
                    <th className="py-2.5 px-3">Objem vazu</th>
                    <th className="py-2.5 px-3">Integrita</th>
                    <th className="py-2.5 px-3">3D Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredScans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        Žádné záznamy vyšetření neodpovídají filtru.
                      </td>
                    </tr>
                  ) : (
                    filteredScans.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-teal-300 font-semibold">{s.id}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">
                          <button
                            onClick={() => {
                              onSelectPatient(s.patient_id);
                              onClose();
                            }}
                            className="text-teal-400 hover:underline hover:text-teal-300 font-medium cursor-pointer"
                            title="Vybrat tohoto pacienta v hlavní aplikaci"
                          >
                            {s.patient_id}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{s.scan_date}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{s.months_post_op} mo</td>
                        <td className="py-2.5 px-3 font-mono text-teal-300">{s.volume_mm3} mm³</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono font-medium text-[11px] ${
                              s.integrity_score >= 80
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : s.integrity_score >= 65
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {s.integrity_score}%
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3 font-mono text-slate-400 text-[11px] truncate max-w-[150px]"
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
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">ID Pacienta</th>
                    <th className="py-2.5 px-3">Datum operace</th>
                    <th className="py-2.5 px-3">Typ štěpu (Graft Type)</th>
                    <th className="py-2.5 px-3">Počet skenů</th>
                    <th className="py-2.5 px-3 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        Žádní pacienti neodpovídají filtru.
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((p) => (
                      <tr key={p.patient_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-teal-300 font-semibold">{p.patient_id}</td>
                        <td className="py-2.5 px-3 text-slate-300">{p.surgery_date}</td>
                        <td className="py-2.5 px-3 text-slate-200">{p.graft_type}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{p.total_scans}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              onSelectPatient(p.patient_id);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/40 font-medium text-[11px] transition-colors cursor-pointer"
                          >
                            Otevřít profil
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
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>
              SQLite soubor:{' '}
              <code className="text-slate-300 font-mono">c:\acl-web-app\backend\acl_platform.db</code>
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Lze otevřít také v bezplatném programu DB Browser for SQLite
          </span>
        </div>
      </div>
    </div>
  );
}
