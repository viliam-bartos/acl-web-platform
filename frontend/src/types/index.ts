/**
 * TypeScript domain definitions for ACL Web Platform.
 *
 * Názvy metrik se **musí** shodovat s `spec/data-contracts.md` v repu
 * `ACL_graft_analysis`. Drží se proto i tady pod původními názvy (PascalCase),
 * aby nevznikalo místo, kde by se klíč mohl rozejít – přesně na tom se dřív
 * ztrácely naměřené hodnoty mezi vrstvami.
 */

// ====================================================================
// Klinické metriky
// ====================================================================

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

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  precision: number;
  group: 'Geometrie štěpu' | 'Orientace' | 'Prostorové vztahy';
  meaning: string;
}

/**
 * Jediný zdroj pravdy pro popisky, jednotky a přesnost metrik.
 * Karta kvantifikace i graf trendu z něj čtou, aby se popisky nemohly rozejít.
 */
export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: 'acl_volume_mm3',
    label: 'Objem štěpu',
    unit: 'mm³',
    precision: 0,
    group: 'Geometrie štěpu',
    meaning: 'Fyzikální objem segmentovaného štěpu',
  },
  {
    key: 'Staubli_Tibial_pct',
    label: 'Stäubli tibial',
    unit: '%',
    precision: 1,
    group: 'Geometrie štěpu',
    meaning: 'Relativní předozadní poloha tibiálního úponu',
  },
  {
    key: 'ATT_mm',
    label: 'Anterior tibial translation',
    unit: 'mm',
    precision: 2,
    group: 'Geometrie štěpu',
    meaning: 'Přední posun tibie vůči femuru – ukazatel laxity',
  },
  {
    key: 'Tortuosity_Index',
    label: 'Tortuozita',
    unit: '–',
    precision: 2,
    group: 'Geometrie štěpu',
    meaning: 'Zakřivení štěpu; 1,0 znamená přímý průběh',
  },
  {
    key: 'BH_Length_pct',
    label: 'B&H délka',
    unit: '%',
    precision: 1,
    group: 'Geometrie štěpu',
    meaning: 'Bernard-Hertel: délkové procento femorálního úponu',
  },
  {
    key: 'BH_Depth_pct',
    label: 'B&H hloubka',
    unit: '%',
    precision: 1,
    group: 'Geometrie štěpu',
    meaning: 'Bernard-Hertel: hloubkové procento femorálního úponu',
  },
  {
    key: 'angle_to_plateau_deg',
    label: 'Elevace k platu',
    unit: '°',
    precision: 1,
    group: 'Orientace',
    meaning: 'Úhel štěpu vůči rovině tibiálního plata',
  },
  {
    key: 'sagittal_angle_deg',
    label: 'Sagitální úhel',
    unit: '°',
    precision: 1,
    group: 'Orientace',
    meaning: 'Úhel štěpu v sagitální rovině',
  },
  {
    key: 'coronal_angle_deg',
    label: 'Koronální úhel',
    unit: '°',
    precision: 1,
    group: 'Orientace',
    meaning: 'Úhel štěpu v koronální rovině',
  },
  {
    key: 'notch_width_mm',
    label: 'Šířka fossy',
    unit: 'mm',
    precision: 1,
    group: 'Prostorové vztahy',
    meaning: 'Šířka interkondylární fossy v místě štěpu',
  },
  {
    key: 'min_dist_to_femur_mm',
    label: 'Vzdálenost k femuru',
    unit: 'mm',
    precision: 2,
    group: 'Prostorové vztahy',
    meaning: 'Nejmenší vzdálenost štěpu od femuru (impingement)',
  },
];

/** Metriky vhodné pro graf vývoje v čase. */
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
    throw new Error(`Neznámá metrika: ${key}`);
  }
  return found;
}

/**
 * Naformátuje hodnotu metriky. Chybějící hodnota se zobrazuje jako `—`,
 * nikdy jako nula – nula je platná naměřená hodnota a nesmí ji zastupovat.
 */
export function formatMetric(
  value: number | null | undefined,
  definition: MetricDefinition
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(definition.precision);
}

// ====================================================================
// Pacienti a vyšetření
// ====================================================================

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

// ====================================================================
// Stav služeb
// ====================================================================

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
