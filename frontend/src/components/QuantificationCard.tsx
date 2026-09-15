import { AlertTriangle, Cpu, Info, Loader2 } from 'lucide-react';
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
      className="p-3 rounded-lg bg-composite-850 border border-composite-800"
      title={definition.meaning}
    >
      <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider truncate">
        {definition.label}
      </span>
      <span
        className={`font-mono text-base font-bold ${
          measured ? 'text-kraft-300' : 'text-paper-400/50'
        }`}
      >
        {formatMetric(value, definition)}{' '}
        {measured && <span className="text-xs text-paper-400 font-mono">{definition.unit}</span>}
      </span>
    </div>
  );
}

export default function QuantificationCard({ scan }: QuantificationCardProps) {
  if (scan.status === 'pending') {
    return (
      <div className="panel-composite rounded-xl p-5 h-full flex flex-col items-center justify-center text-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-kraft-400 mb-2" />
        <p className="text-sm text-paper-100 font-semibold">Výpočet na workeru běží</p>
        <p className="text-xs text-paper-300/70 font-mono mt-1">
          Výsledek se dotáhne přes „Dotáhnout výsledek“.
        </p>
      </div>
    );
  }

  if (scan.status === 'failed') {
    return (
      <div className="panel-composite rounded-xl p-5 h-full flex flex-col justify-center min-h-[200px]">
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
    <div className="panel-composite rounded-xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-composite-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-composite-850 text-cyan-400 border border-composite-800">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-display uppercase tracking-wider text-paper-100">
              Naměřené parametry
            </h3>
            <p className="text-[11px] text-paper-300/60 font-mono">
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
              <div className="text-[11px] font-mono uppercase tracking-wider text-paper-400/60 mb-2">
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

      <div className="mt-4 p-3 rounded-lg bg-composite-850 border border-composite-800 text-[11px] text-paper-300/80 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <span>
          Zobrazeny jsou pouze naměřené hodnoty. Souhrnné skóre („integrita štěpu“) se záměrně
          nepočítá – dokud neexistuje model natrénovaný na datech, interpretace patří lékaři.
          {scan.worker_job_id && (
            <span className="block mt-1 font-mono text-paper-400/60">
              Úloha na workeru: {scan.worker_job_id}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
