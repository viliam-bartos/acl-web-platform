import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AlarmClock, Clock, TrendingUp } from 'lucide-react';
import { ScanRecord, TREND_METRICS, MetricDefinition, formatMetric } from '../types';

interface TrendChartProps {
  scans?: ScanRecord[];
  selectedScanId?: string;
  onSelectScan: (scan: ScanRecord) => void;
}

interface TrendPoint {
  id: string;
  months: number;
  value: number | null;
  scan_date: string;
  raw: ScanRecord;
}

interface TooltipPayload {
  payload: TrendPoint;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  definition: MetricDefinition;
}

const TrendTooltip: React.FC<TrendTooltipProps> = ({ active, payload, label, definition }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-paper-50 p-3 rounded-lg border border-paper-400 text-xs font-mono text-composite-900 space-y-1.5 shadow-lg">
      <div className="font-semibold flex items-center justify-between gap-4 border-b border-paper-300 pb-1">
        <span>{label} MĚSÍCŮ</span>
        <span className="text-kraft-700 text-[11px]">{point.scan_date}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-paper-200 inline-block" />
          {definition.label}:
        </span>
        <span className="font-bold text-composite-900">
          {formatMetric(point.value, definition)} {definition.unit}
        </span>
      </div>
    </div>
  );
};

export default function TrendChart({ scans = [], selectedScanId, onSelectScan }: TrendChartProps) {
  const [metricKey, setMetricKey] = useState<MetricDefinition['key']>(TREND_METRICS[0].key);
  const definition = TREND_METRICS.find((metric) => metric.key === metricKey) ?? TREND_METRICS[0];

  const sortedScans = useMemo(
    () => [...scans].sort((a, b) => a.months_post_op - b.months_post_op),
    [scans]
  );

  const chartData: TrendPoint[] = useMemo(
    () =>
      sortedScans
        .filter((scan) => scan.status === 'ready' && scan.metrics[definition.key] !== null)
        .map((scan) => ({
          id: scan.id,
          months: scan.months_post_op,
          value: scan.metrics[definition.key],
          scan_date: scan.scan_date,
          raw: scan,
        })),
    [sortedScans, definition]
  );

  if (sortedScans.length === 0) {
    return (
      <div className="panel-paper rounded-xl p-6 text-center">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-kraft-600" />
        <p className="text-sm font-semibold text-composite-900">Zatím žádná vyšetření</p>
      </div>
    );
  }

  return (
    <div className="panel-paper rounded-xl p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-paper-400">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-paper-200 text-composite-900">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display uppercase tracking-wider text-composite-900">
              Vývoj štěpu v čase
            </h2>
          </div>
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {TREND_METRICS.map((metric) => (
          <button
            key={metric.key}
            onClick={() => setMetricKey(metric.key)}
            title={metric.meaning}
            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
              metric.key === definition.key
                ? 'bg-composite-900 text-paper-50 border-composite-900 font-semibold'
                : 'bg-paper-50 text-composite-900 border-paper-400 hover:bg-paper-200'
            }`}
          >
            {metric.label}
            {metric.unit !== '–' && <span className="opacity-60"> ({metric.unit})</span>}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-72 sm:h-80 mt-4">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-xs text-kraft-700 font-mono">
              Pro metriku „{definition.label}“ zatím není naměřená žádná hodnota.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 20, bottom: 20, left: -10 }}
              onClick={(state) => {
                const clicked = state?.activePayload?.[0]?.payload as TrendPoint | undefined;
                if (clicked) onSelectScan(clicked.raw);
              }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A1D20" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1A1D20" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#DFD3BD" />

              <XAxis
                dataKey="months"
                unit=" m"
                stroke="#78716C"
                fontSize={11}
                fontFamily="JetBrains Mono"
                tickLine={false}
              />

              <YAxis
                domain={['auto', 'auto']}
                unit={definition.unit === '–' ? '' : ` ${definition.unit}`}
                stroke="#1A1D20"
                fontSize={11}
                fontFamily="JetBrains Mono"
                tickLine={false}
                width={78}
              />

              <Tooltip content={<TrendTooltip definition={definition} />} />

              <Area
                type="monotone"
                dataKey="value"
                name={definition.label}
                stroke="#1A1D20"
                strokeWidth={3}
                fill="url(#trendGradient)"
                connectNulls={false}
                activeDot={{ r: 5, stroke: '#1A1D20', strokeWidth: 2, fill: '#FAF6EE' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={definition.label}
                stroke="#1A1D20"
                strokeWidth={2}
                dot={{ r: 3.5, stroke: '#1A1D20', fill: '#FAF6EE' }}
                activeDot={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-4 pt-3 border-t border-paper-400">
        <div className="text-xs font-mono text-kraft-700 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-composite-900">
            <Clock className="w-3.5 h-3.5" />
            ČASOVÁ OSA VYŠETŘENÍ:
          </span>
          <span className="text-[11px]">{sortedScans.length} ZÁZNAMŮ</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sortedScans.map((scan) => {
            const isSelected = scan.id === selectedScanId;
            const value = scan.metrics[definition.key];
            return (
              <button
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className={`p-2.5 rounded-lg text-left transition-all border text-xs cursor-pointer font-mono ${
                  isSelected
                    ? 'bg-kraft-400 text-composite-950 border-kraft-600 shadow-sm font-semibold'
                    : 'bg-paper-50 border-paper-400 text-composite-900 hover:bg-paper-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold">{scan.months_post_op} měs.</span>
                  {scan.status !== 'ready' ? (
                    <span className="flex items-center gap-1 text-[10px] text-hazard-600 font-bold">
                      {scan.status === 'pending' ? (
                        <>
                          <AlarmClock className="w-3 h-3" /> BĚŽÍ
                        </>
                      ) : (
                        'SELHALO'
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] opacity-80">
                      {formatMetric(value, definition)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-75 mt-1 flex items-center justify-between gap-2">
                  <span>{definition.unit !== '–' ? definition.unit : definition.label}</span>
                  <span className="text-[10px]">{scan.scan_date}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
