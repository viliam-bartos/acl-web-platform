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
    <div className="panel-paper rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-paper-400">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-paper-100 text-kraft-600 border border-paper-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display uppercase tracking-wider text-composite-900 flex items-center gap-2">
              Patients
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-paper-100 hover:bg-paper-200 text-composite-900 transition-colors border border-paper-400 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-kraft-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-kraft-400 hover:bg-kraft-300 text-composite-950 text-xs font-display uppercase tracking-wider font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New patient</span>
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
                  : 'bg-paper-100 border-paper-400 text-composite-900 hover:border-paper-400 hover:bg-paper-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-mono font-bold text-sm tracking-wide ${
                    isSelected ? 'text-composite-950' : 'text-kraft-600'
                  }`}
                >
                  {patient.patient_id}
                </span>
                {patient.has_demo_scans && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isSelected
                        ? 'bg-paper-100/90 text-composite-900'
                        : 'bg-paper-200 border border-hazard-500/40 text-hazard-600'
                    }`}
                    title="Contains demo data"
                  >
                    DEMO
                  </span>
                )}
              </div>
              <div
                className={`text-[11px] mt-1 flex items-center gap-1.5 ${
                  isSelected ? 'text-composite-900 font-medium' : 'text-kraft-600'
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
        <div className="mt-4 pt-3.5 border-t border-paper-400 flex flex-wrap items-center justify-between text-xs text-kraft-700 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-kraft-600" />
              Surgery: <strong className="text-composite-900 font-mono">{selectedPatient.surgery_date}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Dna className="w-3.5 h-3.5 text-cyan-600" />
              Graft: <strong className="text-composite-900 font-sans font-medium">{selectedPatient.graft_type}</strong>
            </span>
          </div>
          {selectedPatient.latest_acl_volume_mm3 !== null &&
            selectedPatient.latest_acl_volume_mm3 !== undefined && (
              <div className="text-composite-900 font-mono">
                Graft volume:{' '}
                <span className="font-mono text-cyan-600 font-bold">
                  {selectedPatient.latest_acl_volume_mm3.toFixed(0)} mm³
                </span>
                {selectedPatient.latest_scan_date && (
                  <span className="text-kraft-600"> ({selectedPatient.latest_scan_date})</span>
                )}
              </div>
            )}
        </div>
      )}

      {/* Modal for adding new patient */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel-paper rounded-xl p-6 max-w-md w-full border border-paper-400 shadow-2xl">
            <h3 className="text-xl font-bold font-display uppercase tracking-wider text-composite-900 mb-2">
              Register patient
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-kraft-700 mb-1">
                  Subject ID (e.g. ACL_202)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACL_XXX"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-paper-100 border border-paper-400 text-composite-900 text-sm focus:border-kraft-400 focus:outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-kraft-700 mb-1">
                  Surgery Date
                </label>
                <input
                  type="date"
                  required
                  value={newSurgeryDate}
                  onChange={(e) => setNewSurgeryDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-paper-100 border border-paper-400 text-composite-900 text-sm focus:border-kraft-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-kraft-700 mb-1">
                  Graft Type
                </label>
                <select
                  value={newGraftType}
                  onChange={(e) => setNewGraftType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-paper-100 border border-paper-400 text-composite-900 text-sm focus:border-kraft-400 focus:outline-none"
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
                  className="px-4 py-2 rounded-lg text-kraft-600 hover:text-composite-900 text-xs font-mono uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-lg bg-hazard-500 hover:bg-hazard-600 text-composite-950 font-display uppercase tracking-wider font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Saving...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
