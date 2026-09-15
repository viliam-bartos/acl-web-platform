import { AlertTriangle, Cpu, Loader2 } from 'lucide-react';
import { METRIC_DEFINITIONS, MetricDefinition, MetricGroup, ScanRecord, formatMetric } from '../types';

interface QuantificationCardProps {
  scan: ScanRecord;
}

const GROUP_ORDER: MetricGroup[] = ['Graft geometry', 'Orientation', 'Spatial relations'];

function MetricTile({ definition, value }: { definition: MetricDefinition; value: number | null }) {
  const measured = value !== null && value !== undefined && !Number.isNaN(value);
  return (
    <div className="p-2.5 rounded-lg bg-paper-100 border border-paper-300" title={definition.meaning}>
      <span className="block text-[10px] font-mono uppercase tracking-wider text-kraft-700 truncate">
        {definition.label}
      </span>
      <span className={`font-mono text-sm font-bold ${measured ? 'text-cyan-600' : 'text-kraft-600'}`}>
        {formatMetric(value, definition)}
        {measured && definition.unit !== '–' && (
          <span className="text-[10px] text-kraft-700 font-normal"> {definition.unit}</span>
        )}
      </span>
    </div>
  );
}

export default function QuantificationCard({ scan }: QuantificationCardProps) {
  if (scan.status === 'pending') {
    return (
      <div className="panel-paper rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-hazard-500 mb-2" />
        <p className="text-sm font-semibold">Computation running</p>
        <p className="text-xs text-kraft-700 mt-1">Use Collect result once it finishes.</p>
      </div>
    );
  }

  if (scan.status === 'failed') {
    return (
      <div className="panel-paper rounded-xl p-4 flex flex-col justify-center min-h-[200px]">
        <div className="flex items-start gap-2.5 text-rose-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold block text-sm">Computation failed</span>
            <span className="font-mono">{scan.error ?? 'No further detail.'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-paper rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-paper-400">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-cyan-600" />
          <h2 className="text-lg font-bold font-display uppercase tracking-wider">
            Measured parameters
          </h2>
        </div>
        <span className="text-[11px] font-mono text-kraft-700 whitespace-nowrap">
          {scan.scan_date} · {scan.months_post_op} mo
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {GROUP_ORDER.map((group) => {
          const definitions = METRIC_DEFINITIONS.filter((definition) => definition.group === group);
          if (definitions.length === 0) return null;
          return (
            <div key={group}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-kraft-600 mb-1.5">
                {group}
              </div>
              <div className="grid grid-cols-2 gap-2">
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
