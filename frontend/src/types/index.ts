/**
 * TypeScript domain definitions for ACL Web Platform.
 */

export interface Patient {
  patient_id: string;
  surgery_date: string;
  graft_type: string;
  total_scans?: number;
  latest_integrity_score?: number | null;
  latest_volume_mm3?: number | null;
}

export interface PatientCreateData {
  patient_id: string;
  surgery_date: string;
  graft_type: string;
}

export interface ScanRecord {
  id: string;
  patient_id: string;
  scan_date: string;
  months_post_op: number;
  volume_mm3: number;
  integrity_score: number;
  model_url: string;
}

export interface PatientHistory {
  patient: Patient;
  scans: ScanRecord[];
}

export interface RadiomicsSummary {
  volume_mm3?: number;
  integrity_score?: number;
  length_mm?: number;
  sagittal_angle_deg?: number;
  coronal_angle_deg?: number;
  tibial_sagittal_pos_pct?: number;
  femoral_bh_depth_pct?: number;
  femoral_bh_height_pct?: number;
  inference_duration_ms?: number;
  model_architecture?: string;
  compute_device?: string;
  gpu_name?: string;
  [key: string]: unknown;
}

export interface AnalyzeResponse {
  status: string;
  message: string;
  scan: ScanRecord;
  radiomics_summary: RadiomicsSummary;
}

export interface DatabaseStats {
  db_size_bytes: number;
  db_size_kb: number;
  total_patients: number;
  total_scans: number;
  has_cuda: boolean;
  gpu_name: string;
}

export interface DatabaseRecordItem {
  id: string;
  patient_id: string;
  scan_date: string;
  months_post_op: number;
  volume_mm3: number;
  integrity_score: number;
  model_url: string;
}

export interface DatabaseRecordsResponse {
  patients: Patient[];
  scans: DatabaseRecordItem[];
}

export interface ModelPartVisibility {
  femur: boolean;
  tibia: boolean;
  acl: boolean;
  plateau: boolean;
  bhGrid: boolean;
  blumensaat: boolean;
  footprints: boolean;
}
