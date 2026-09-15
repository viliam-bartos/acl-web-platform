import React, { useState } from 'react';
import { UserCheck, Plus, RefreshCw, Calendar, Dna } from 'lucide-react';
import { Patient, PatientCreateData } from '../types';

interface PatientSelectProps {
  patients: Patient[];
  selectedPatientId: string;
  onSelectPatient: (patientId: string) => void;
  onRefresh: () => void;
  onCreatePatient: (data: PatientCreateData) => Promise<unknown>;
  isLoading: boolean;
}

export default function PatientSelect({
  patients,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  onCreatePatient,
  isLoading,
}: PatientSelectProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newSurgeryDate, setNewSurgeryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGraftType, setNewGraftType] = useState('Hamstring Tendon Autograft (ST/G)');
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim()) return;
    setCreateLoading(true);
    setErrorMsg('');
    try {
      await onCreatePatient({
        patient_id: newId.trim().toUpperCase(),
        surgery_date: newSurgeryDate,
        graft_type: newGraftType,
      });
      setShowNewModal(false);
      setNewId('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => p.patient_id === selectedPatientId);

  return (
    <div className="panel-composite rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-composite-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-composite-850 text-kraft-400 border border-composite-800">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display uppercase tracking-wider text-paper-100 flex items-center gap-2">
              Seznam Pacientů
            </h2>
            <p className="text-xs text-paper-300/70">Výběr ID pacienta pro zobrazení průběhu hojení a vyšetření</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-composite-850 hover:bg-composite-800 text-paper-200 transition-colors border border-composite-800 disabled:opacity-50"
            title="Refresh cohort"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-kraft-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-kraft-400 hover:bg-kraft-300 text-composite-950 text-xs font-display uppercase tracking-wider font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New ID</span>
          </button>
        </div>
      </div>

      {/* Patient selector pills */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {patients.map((patient) => {
          const isSelected = patient.patient_id === selectedPatientId;
          return (
            <button
              key={patient.patient_id}
              onClick={() => onSelectPatient(patient.patient_id)}
              className={`px-4 py-2.5 rounded-lg text-left transition-all border ${
                isSelected
                  ? 'bg-kraft-400 border-kraft-400 text-composite-950 shadow-md font-medium'
                  : 'bg-composite-850 border-composite-800 text-paper-200 hover:border-composite-800 hover:bg-composite-800'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-mono font-bold text-sm tracking-wide ${
                    isSelected ? 'text-composite-950' : 'text-kraft-400'
                  }`}
                >
                  {patient.patient_id}
                </span>
                {patient.latest_integrity_score !== null && patient.latest_integrity_score !== undefined && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isSelected
                        ? 'bg-composite-950/80 text-paper-100'
                        : patient.latest_integrity_score >= 80
                        ? 'bg-composite-900 border border-emerald-500/40 text-emerald-300'
                        : patient.latest_integrity_score >= 65
                        ? 'bg-composite-900 border border-amber-500/40 text-amber-300'
                        : 'bg-composite-900 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {patient.latest_integrity_score.toFixed(0)}%
                  </span>
                )}
              </div>
              <div
                className={`text-[11px] mt-1 flex items-center gap-1.5 ${
                  isSelected ? 'text-composite-900 font-medium' : 'text-paper-300/60'
                }`}
              >
                <span>
                  {patient.total_scans} scan{patient.total_scans === 1 ? '' : 's'}
                </span>
                <span>•</span>
                <span className="truncate max-w-[140px]">{patient.graft_type.split(' ')[0]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active patient detail banner */}
      {selectedPatient && (
        <div className="mt-4 pt-3.5 border-t border-composite-800 flex flex-wrap items-center justify-between text-xs text-paper-300/80 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-kraft-400" />
              Operace: <strong className="text-paper-100 font-mono">{selectedPatient.surgery_date}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Dna className="w-3.5 h-3.5 text-cyan-400" />
              Štěp: <strong className="text-paper-100 font-sans font-medium">{selectedPatient.graft_type}</strong>
            </span>
          </div>
          {selectedPatient.latest_volume_mm3 && (
            <div className="text-paper-200 font-mono">
              Objem štěpu:{' '}
              <span className="font-mono text-cyan-400 font-bold">{selectedPatient.latest_volume_mm3} mm³</span>
            </div>
          )}
        </div>
      )}

      {/* Modal for adding new patient */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel-composite rounded-xl p-6 max-w-md w-full border border-composite-800 shadow-2xl">
            <h3 className="text-xl font-bold font-display uppercase tracking-wider text-paper-100 mb-2">
              Registrace nového pacienta
            </h3>
            <p className="text-xs text-paper-300/70 mb-4">
              Zadejte ID pacienta (např. ACL_105) a datum operace plastiky vazu.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-paper-300/80 mb-1">
                  Subject ID (e.g. ACL_202)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACL_XXX"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-composite-950 border border-composite-800 text-paper-100 text-sm focus:border-kraft-400 focus:outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-paper-300/80 mb-1">
                  Surgery Date
                </label>
                <input
                  type="date"
                  required
                  value={newSurgeryDate}
                  onChange={(e) => setNewSurgeryDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-composite-950 border border-composite-800 text-paper-100 text-sm focus:border-kraft-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-paper-300/80 mb-1">
                  Graft Type
                </label>
                <select
                  value={newGraftType}
                  onChange={(e) => setNewGraftType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-composite-950 border border-composite-800 text-paper-100 text-sm focus:border-kraft-400 focus:outline-none"
                >
                  <option value="Hamstring Tendon Autograft (ST/G)">Hamstring Tendon Autograft (ST/G)</option>
                  <option value="Bone-Patellar Tendon-Bone (BPTB)">Bone-Patellar Tendon-Bone (BPTB)</option>
                  <option value="Quadriceps Tendon Autograft">Quadriceps Tendon Autograft</option>
                  <option value="Allograft (Peroneal/Achilles)">Allograft (Peroneal/Achilles)</option>
                  <option value="Synthetic Augmentation">Synthetic Augmentation</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg text-paper-400 hover:text-paper-100 text-xs font-mono uppercase tracking-wider"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-lg bg-hazard-500 hover:bg-hazard-600 text-composite-950 font-display uppercase tracking-wider font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Ukládám...' : 'Registrovat ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
