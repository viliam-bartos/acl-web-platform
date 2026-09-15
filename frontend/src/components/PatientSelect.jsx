import React, { useState } from 'react';
import { UserCheck, Plus, RefreshCw, Calendar, Dna } from 'lucide-react';

export default function PatientSelect({
  patients,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  onCreatePatient,
  isLoading
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newSurgeryDate, setNewSurgeryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGraftType, setNewGraftType] = useState('Hamstring Tendon Autograft (ST/G)');
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newId.trim()) return;
    setCreateLoading(true);
    setErrorMsg('');
    try {
      await onCreatePatient({
        patient_id: newId.trim().toUpperCase(),
        surgery_date: newSurgeryDate,
        graft_type: newGraftType
      });
      setShowNewModal(false);
      setNewId('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create patient');
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.patient_id === selectedPatientId);

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              Seznam Pacientů
            </h2>
            <p className="text-xs text-slate-400">Výběr ID pacienta pro zobrazení průběhu hojení a vyšetření</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50"
            title="Refresh cohort"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-teal-600/90 hover:bg-teal-500 text-white text-xs font-medium transition-colors shadow-sm"
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
              className={`px-4 py-2.5 rounded-xl text-left transition-all border ${
                isSelected
                  ? 'bg-teal-500/15 border-teal-500/60 text-white shadow-lg shadow-teal-950/40 ring-1 ring-teal-400/40'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-semibold text-sm tracking-wide text-teal-300">
                  {patient.patient_id}
                </span>
                {patient.latest_integrity_score !== null && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                    patient.latest_integrity_score >= 80
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : patient.latest_integrity_score >= 65
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {patient.latest_integrity_score.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <span>{patient.total_scans} scan{patient.total_scans === 1 ? '' : 's'}</span>
                <span>•</span>
                <span className="truncate max-w-[140px]">{patient.graft_type.split(' ')[0]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active patient detail banner */}
      {selectedPatient && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Reconstruction Date: <strong className="text-slate-200">{selectedPatient.surgery_date}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Dna className="w-3.5 h-3.5 text-teal-400/80" />
              Graft: <strong className="text-slate-200">{selectedPatient.graft_type}</strong>
            </span>
          </div>
          {selectedPatient.latest_volume_mm3 && (
            <div className="text-slate-300">
              Latest Graft Volume: <span className="font-mono text-teal-300 font-medium">{selectedPatient.latest_volume_mm3} mm³</span>
            </div>
          )}
        </div>
      )}

      {/* Modal for adding new patient */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel-glow bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-teal-500/30">
            <h3 className="text-lg font-bold text-white mb-2">Registrace nového pacienta</h3>
            <p className="text-xs text-slate-400 mb-4">
              Zadejte ID pacienta (např. ACL_105) a datum operace plastiky vazu.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject ID (e.g. ACL_202)</label>
                <input
                  type="text"
                  required
                  placeholder="ACL_XXX"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-teal-400 focus:outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Surgery Date</label>
                <input
                  type="date"
                  required
                  value={newSurgeryDate}
                  onChange={(e) => setNewSurgeryDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Graft Type</label>
                <select
                  value={newGraftType}
                  onChange={(e) => setNewGraftType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-teal-400 focus:outline-none"
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
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Saving...' : 'Register ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
