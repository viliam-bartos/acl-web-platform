/**
 * Domain definitions for the ACL Web Platform frontend.
 *
 * Metric keys must match `spec/data-contracts.md` in the `ACL_graft_analysis`
 * repository, which is why they keep their original PascalCase names here: a
 * mismatch between layers silently dropped measured values in the past.
 */

export interface ScanMetrics {
  Staubli_Tibial_pct: number | null;
  Tortuosity_Index: number | null;
  ATT_mm: number | null;
  BH_Length_pct: number | null;
  BH_Depth_pct: number | null;
  angle_to_plateau_deg: number | null;
  sagittal_angle_deg: number | null;
  coronal_angle_deg: number | null;
  acl_volume_mm3: number | null;
  min_dist_to_femur_mm: number | null;
  notch_width_mm: number | null;
}

export type MetricKey = keyof ScanMetrics;

export type MetricGroup = 'Graft geometry' | 'Orientation' | 'Spatial relations';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  precision: number;
  group: MetricGroup;
  meaning: string;
}

/** Single source of truth for metric labels, units and precision. */
export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: 'acl_volume_mm3',
    label: 'Graft volume',
    unit: 'mm³',
    precision: 0,
    group: 'Graft geometry',
    meaning: 'Physical volume of the segmented graft',
  },
  {
    key: 'Staubli_Tibial_pct',
    label: 'Stäubli tibial',
    unit: '%',
    precision: 1,
    group: 'Graft geometry',
    meaning: 'Anteroposterior position of the tibial footprint',
  },
  {
    key: 'ATT_mm',
    label: 'Anterior tibial translation',
    unit: 'mm',
    precision: 2,
    group: 'Graft geometry',
    meaning: 'Anterior shift of the tibia relative to the femur; a laxity marker',
  },
  {
    key: 'Tortuosity_Index',
    label: 'Tortuosity',
    unit: '–',
    precision: 2,
    group: 'Graft geometry',
    meaning: 'Curvature of the graft; 1.0 is a straight course',
  },
  {
    key: 'BH_Length_pct',
    label: 'B&H length',
    unit: '%',
    precision: 1,
    group: 'Graft geometry',
    meaning: 'Bernard-Hertel length percentage of the femoral footprint',
  },
  {
    key: 'BH_Depth_pct',
    label: 'B&H depth',
    unit: '%',
    precision: 1,
    group: 'Graft geometry',
    meaning: 'Bernard-Hertel depth percentage of the femoral footprint',
  },
  {
    key: 'angle_to_plateau_deg',
    label: 'Elevation to plateau',
    unit: '°',
    precision: 1,
    group: 'Orientation',
    meaning: 'Angle of the graft to the tibial plateau plane',
  },
  {
    key: 'sagittal_angle_deg',
    label: 'Sagittal angle',
    unit: '°',
    precision: 1,
    group: 'Orientation',
    meaning: 'Angle of the graft in the sagittal plane',
  },
  {
    key: 'coronal_angle_deg',
    label: 'Coronal angle',
    unit: '°',
    precision: 1,
    group: 'Orientation',
    meaning: 'Angle of the graft in the coronal plane',
  },
  {
    key: 'notch_width_mm',
    label: 'Notch width',
    unit: 'mm',
    precision: 1,
    group: 'Spatial relations',
    meaning: 'Width of the intercondylar notch at the graft',
  },
  {
    key: 'min_dist_to_femur_mm',
    label: 'Distance to femur',
    unit: 'mm',
    precision: 2,
    group: 'Spatial relations',
    meaning: 'Smallest distance from the graft to the femur (impingement)',
  },
];

/** Metrics offered by the trend chart. */
export const TREND_METRICS: readonly MetricDefinition[] = [
  'acl_volume_mm3',
  'ATT_mm',
  'Staubli_Tibial_pct',
  'Tortuosity_Index',
  'BH_Length_pct',
  'angle_to_plateau_deg',
]
  .map((key) => METRIC_DEFINITIONS.find((definition) => definition.key === key))
  .filter((definition): definition is MetricDefinition => definition !== undefined);

export function metricDefinition(key: MetricKey): MetricDefinition {
  const found = METRIC_DEFINITIONS.find((definition) => definition.key === key);
  if (!found) {
    throw new Error(`Unknown metric: ${key}`);
  }
  return found;
}

/**
 * Formats a metric value. A missing value renders as an em dash, never as
 * zero: zero is a valid measurement and must not stand in for a gap.
 */
export function formatMetric(value: number | null | undefined, definition: MetricDefinition): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(definition.precision);
}

export interface Patient {
  patient_id: string;
  surgery_date: string;
  graft_type: string;
  total_scans?: number;
  latest_acl_volume_mm3?: number | null;
  latest_scan_date?: string | null;
  has_demo_scans?: boolean;
}

export interface PatientCreateData {
  patient_id: string;
  surgery_date: string;
  graft_type: string;
}

export type ScanStatus = 'pending' | 'ready' | 'failed';

export interface ScanRecord {
  id: string;
  patient_id: string;
  scan_date: string;
  months_post_op: number;
  model_url: string;
  status: ScanStatus;
  error: string | null;
  is_demo: boolean;
  worker_job_id: string | null;
  metrics: ScanMetrics;
}

export interface PatientHistory {
  patient: Patient;
  scans: ScanRecord[];
}

export interface AnalyzeResponse {
  status: string;
  message: string;
  scan: ScanRecord;
  warnings: string[];
  compute: Record<string, unknown>;
}

export interface WorkerHealth {
  reachable: boolean;
  status?: string;
  detail?: string;
  version?: string;
  device?: string;
  queue?: Record<string, number>;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  service: string;
  compute_worker: WorkerHealth;
  compute_worker_url: string;
}

export interface DatabaseStats {
  status: string;
  database_file: string;
  size_bytes: number;
  size_kb: number;
  total_patients: number;
  total_scans: number;
  pending_scans: number;
  failed_scans: number;
  demo_scans: number;
  compute_worker: WorkerHealth;
  compute_worker_url: string;
  last_modified: number | null;
}

export interface DatabaseRecordScan {
  id: string;
  patient_id: string;
  scan_date: string;
  months_post_op: number;
  status: ScanStatus;
  is_demo: boolean;
  worker_job_id: string | null;
  model_url: string;
  metrics: ScanMetrics;
}

export interface DatabaseRecordsResponse {
  patients: Patient[];
  scans: DatabaseRecordScan[];
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
