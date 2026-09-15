import { AlertTriangle, Cpu, Loader2 } from 'lucide-react';
import { METRIC_DEFINITIONS, MetricDefinition, ScanRecord, formatMetric } from '../types';

interface QuantificationCardProps {
  scan: ScanRecord;
}

const GROUP_ORDER: Array<MetricDefinition['group']> = [
  'Geometrie štěpu',
  'Orientace',
  'Prostorové vztahy',
];

function MetricTile({ definition, value }: { definition: MetricDefinition; value: number | null }) {
  const measured = value !== null && value !== undefined && !Number.isNaN(value);
  return (
    <div
      className="p-3 rounded-lg bg-paper-50 border border-paper-400"
      title={definition.meaning}
    >
      <span className="text-kraft-700 block text-[11px] font-mono uppercase tracking-wider truncate">
        {definition.label}
      </span>
      <span
        className={`font-mono text-base font-bold ${
          measured ? 'text-kraft-700' : 'text-kraft-600'
        }`}
      >
        {formatMetric(value, definition)}{' '}
        {measured && <span className="text-xs text-kraft-600 font-mono">{definition.unit}</span>}
      </span>
    </div>
  );
}

export default function QuantificationCard({ scan }: QuantificationCardProps) {
  if (scan.status === 'pending') {
    return (
      <div className="panel-paper rounded-xl p-5 h-full flex flex-col items-center justify-center text-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-kraft-600 mb-2" />
        <p className="text-sm text-composite-900 font-semibold">Výpočet na workeru běží</p>
        <p className="text-xs text-kraft-700 font-mono mt-1">
          Výsledek se převezme tlačítkem Převzít výsledek.
        </p>
      </div>
    );
  }

  if (scan.status === 'failed') {
    return (
      <div className="panel-paper rounded-xl p-5 h-full flex flex-col justify-center min-h-[200px]">
        <div className="flex items-start gap-2.5 text-rose-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold block text-white text-sm">Výpočet selhal</span>
            <span className="font-mono">{scan.error ?? 'Bez bližšího popisu.'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-paper rounded-xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-paper-400">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-paper-50 text-cyan-600 border border-paper-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-display uppercase tracking-wider text-composite-900">
              Naměřené parametry
            </h3>
            <p className="text-[11px] text-kraft-600 font-mono">
              {scan.scan_date} • {scan.months_post_op} měs. po plastice
            </p>
          </div>
        </div>
        {scan.is_demo && (
          <span className="badge-hazard text-[11px] px-2 py-0.5 rounded">UKÁZKOVÁ DATA</span>
        )}
      </div>

      <div className="mt-4 space-y-4 flex-1">
        {GROUP_ORDER.map((group) => {
          const definitions = METRIC_DEFINITIONS.filter((definition) => definition.group === group);
          if (definitions.length === 0) return null;
          return (
            <div key={group}>
              <div className="text-[11px] font-mono uppercase tracking-wider text-kraft-600 mb-2">
                {group}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {definitions.map((definition) => (
                  <MetricTile
                    key={definition.key}
                    definition={definition}
                    value={scan.metrics[definition.key]}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
