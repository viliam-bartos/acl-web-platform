/**
 * API service for communicating with FastAPI ACL Platform backend.
 */

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export function resolveModelUrl(modelUrl) {
  if (!modelUrl) return '';
  if (modelUrl.startsWith('http://') || modelUrl.startsWith('https://')) {
    return modelUrl;
  }
  return `${API_BASE_URL}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`;
}

export async function getPatients() {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`);
  if (!response.ok) {
    throw new Error(`Failed to load patients: ${response.statusText}`);
  }
  return response.json();
}

export async function getPatientHistory(patientId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/history`);
  if (!response.ok) {
    throw new Error(`Failed to load history for ${patientId}: ${response.statusText}`);
  }
  return response.json();
}

export async function analyzeScan(patientId, monthsPostOp, file) {
  const formData = new FormData();
  formData.append('patient_id', patientId);
  formData.append('months_post_op', monthsPostOp);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/scans/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Scan analysis failed (${response.status})`);
  }

  return response.json();
}

/**
 * 1-Click analysis using the real reference 3D MRI volume (Case 074).
 */
export async function analyzeReferenceScan(patientId, monthsPostOp) {
  const formData = new FormData();
  formData.append('patient_id', patientId);
  formData.append('months_post_op', monthsPostOp);

  const response = await fetch(`${API_BASE_URL}/api/v1/scans/analyze-reference`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Reference scan analysis failed (${response.status})`);
  }

  return response.json();
}

export async function createPatient(patientData) {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patientData),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to create patient record');
  }

  return response.json();
}
