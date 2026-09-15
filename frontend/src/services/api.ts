/**
 * API service for communicating with the thin ACL Platform backend.
 *
 * Backend je tenká vrstva: veškerý výpočet dělá worker na výkonném počítači.
 * Odtud se proto nikdy nepočítá ani neodhaduje žádná metrika – co nepřijde
 * z API, je `null` a v UI se zobrazí jako `—`.
 */

import {
  AnalyzeResponse,
  DatabaseRecordsResponse,
  DatabaseStats,
  HealthResponse,
  Patient,
  PatientCreateData,
  PatientHistory,
  ScanRecord,
} from '../types';

const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export function resolveModelUrl(modelUrl: string | null | undefined): string {
  if (!modelUrl) return '';
  if (modelUrl.startsWith('http://') || modelUrl.startsWith('https://')) {
    return modelUrl;
  }
  return `${API_BASE_URL}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`;
}

/**
 * Chyba, kdy výpočet na workeru stále běží a překročil časový limit požadavku.
 * Backend v takovém případě založí vyšetření ve stavu `pending` a vrátí HTTP 504
 * včetně jeho ID – výsledek se pak dotáhne přes `refreshScan`.
 */
export class AnalysisPendingError extends Error {
  readonly scanId?: string;

  constructor(message: string, scanId?: string) {
    super(message);
    this.name = 'AnalysisPendingError';
    this.scanId = scanId;
  }
}

interface ApiErrorDetail {
  message?: string;
  hint?: string;
  scan_id?: string;
}

function extractErrorDetail(payload: unknown, fallback: string): { message: string; scanId?: string } {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) {
    return { message: fallback };
  }
  const detail = (payload as { detail: unknown }).detail;

  if (typeof detail === 'string') {
    return { message: detail };
  }
  if (typeof detail === 'object' && detail !== null) {
    const structured = detail as ApiErrorDetail;
    const message = [structured.message, structured.hint].filter(Boolean).join(' ');
    return { message: message || fallback, scanId: structured.scan_id };
  }
  return { message: fallback };
}

async function readError(response: Response): Promise<{ message: string; scanId?: string }> {
  const payload = await response.json().catch(() => null);
  return extractErrorDetail(payload, `Požadavek selhal (HTTP ${response.status}).`);
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`);
  if (!response.ok) {
    throw new Error(`Stav služby se nepodařilo načíst: ${response.statusText}`);
  }
  return response.json();
}

export async function getPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`);
  if (!response.ok) {
    throw new Error(`Failed to load patients: ${response.statusText}`);
  }
  return response.json();
}

export async function getPatientHistory(patientId: string): Promise<PatientHistory> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/patients/${encodeURIComponent(patientId)}/history`
  );
  if (!response.ok) {
    throw new Error(`Failed to load history for ${patientId}: ${response.statusText}`);
  }
  return response.json();
}

async function submitAnalysis(url: string, formData: FormData, fallbackMessage: string): Promise<AnalyzeResponse> {
  const response = await fetch(url, { method: 'POST', body: formData });

  if (response.status === 504) {
    const { message, scanId } = await readError(response);
    throw new AnalysisPendingError(message, scanId);
  }
  if (!response.ok) {
    const { message } = await readError(response);
    throw new Error(message || fallbackMessage);
  }
  return response.json();
}

export async function analyzeScan(
  patientId: string,
  monthsPostOp: number | string,
  file: File,
  options: { computeRadiomics?: boolean; runInference?: boolean; laterality?: string } = {}
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('patient_id', patientId);
  formData.append('months_post_op', String(monthsPostOp));
  formData.append('file', file);
  if (options.computeRadiomics !== undefined) {
    formData.append('compute_radiomics', String(options.computeRadiomics));
  }
  if (options.runInference !== undefined) {
    formData.append('run_inference', String(options.runInference));
  }
  if (options.laterality) {
    formData.append('laterality', options.laterality);
  }

  return submitAnalysis(`${API_BASE_URL}/api/v1/scans/analyze`, formData, 'Analýza skenu selhala.');
}

/**
 * Nechá worker zhodnotit jeho vestavěný referenční případ (074).
 * Aplikace přitom nezná žádnou cestu k datům na straně workera.
 */
export async function analyzeReferenceScan(
  patientId: string,
  monthsPostOp: number | string,
  useInference = false
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('patient_id', patientId);
  formData.append('months_post_op', String(monthsPostOp));
  formData.append('use_inference', String(useInference));

  return submitAnalysis(
    `${API_BASE_URL}/api/v1/scans/analyze-reference`,
    formData,
    'Zhodnocení referenčního skenu selhalo.'
  );
}

/** Dotáhne výsledek vyšetření, které doběhlo až po časovém limitu požadavku. */
export async function refreshScan(scanId: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/scans/${encodeURIComponent(scanId)}/refresh`, {
    method: 'POST',
  });
  if (!response.ok) {
    const { message } = await readError(response);
    throw new Error(message || 'Výsledek se nepodařilo dotáhnout.');
  }
  return response.json();
}

export async function createPatient(patientData: PatientCreateData): Promise<Patient> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patientData),
  });

  if (!response.ok) {
    const { message } = await readError(response);
    throw new Error(message || 'Failed to create patient record');
  }

  return response.json();
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const response = await fetch(`${API_BASE_URL}/api/v1/database/stats`);
  if (!response.ok) {
    throw new Error(`Failed to load database stats: ${response.statusText}`);
  }
  return response.json();
}

export async function getDatabaseRecords(): Promise<DatabaseRecordsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/database/records`);
  if (!response.ok) {
    throw new Error(`Failed to load database records: ${response.statusText}`);
  }
  return response.json();
}

export function getDatabaseDownloadUrl(): string {
  return `${API_BASE_URL}/api/v1/database/download`;
}

/** Vybere nejnovější vyšetření, které je hotové; jinak vrátí `null`. */
export function latestReadyScan(scans: ScanRecord[] | undefined): ScanRecord | null {
  if (!scans || scans.length === 0) return null;
  const ready = scans.filter((scan) => scan.status === 'ready');
  if (ready.length === 0) return null;
  return [...ready].sort((a, b) => b.months_post_op - a.months_post_op)[0];
}
