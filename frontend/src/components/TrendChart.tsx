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
import { Theme, chartPalette } from '../services/theme';

interface TrendChartProps {
  scans?: ScanRecord[];
  selectedScanId?: string;
  onSelectScan: (scan: ScanRecord) => void;
  theme: Theme;
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
    <div className="bg-paper-50 p-2.5 rounded-lg border border-paper-400 text-xs font-mono space-y-1 shadow-lg">
      <div className="flex items-center justify-between gap-4 border-b border-paper-300 pb-1">
        <span>{label} months</span>
        <span className="text-kraft-700 text-[11px]">{point.scan_date}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span>{definition.label}:</span>
        <span className="font-bold">
          {formatMetric(point.value, definition)} {definition.unit}
        </span>
      </div>
    </div>
  );
};

export default function TrendChart({ scans = [], selectedScanId, onSelectScan, theme }: TrendChartProps) {
  const [metricKey, setMetricKey] = useState<MetricDefinition['key']>(TREND_METRICS[0].key);
  const definition = TREND_METRICS.find((metric) => metric.key === metricKey) ?? TREND_METRICS[0];
  const palette = chartPalette(theme);

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
        <TrendingUp className="w-7 h-7 mx-auto mb-2 text-kraft-600" />
        <p className="text-sm font-semibold">No examinations yet</p>
      </div>
    );
  }

  return (
    <div className="panel-paper rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-paper-400">
        <TrendingUp className="w-5 h-5 text-kraft-600" />
        <h2 className="text-lg font-bold font-display uppercase tracking-wider">
          Graft development over time
        </h2>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {TREND_METRICS.map((metric) => (
          <button
            key={metric.key}
            onClick={() => setMetricKey(metric.key)}
            title={metric.meaning}
            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
              metric.key === definition.key
                ? 'bg-composite-900 text-paper-50 border-composite-900 font-semibold'
                : 'bg-paper-100 border-paper-400 hover:bg-paper-200'
            }`}
          >
            {metric.label}
            {metric.unit !== '–' && <span className="opacity-60"> ({metric.unit})</span>}
          </button>
        ))}
      </div>

      <div className="w-full h-72 mt-3">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-xs font-mono text-kraft-700">
              No measured value for {definition.label} yet.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 16, right: 16, bottom: 8, left: -12 }}
              onClick={(state) => {
                const clicked = state?.activePayload?.[0]?.payload as TrendPoint | undefined;
                if (clicked) onSelectScan(clicked.raw);
              }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.line} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={palette.line} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />

              <XAxis
                dataKey="months"
                unit=" mo"
                stroke={palette.axis}
                fontSize={11}
                fontFamily="JetBrains Mono"
                tickLine={false}
              />

              <YAxis
                domain={['auto', 'auto']}
                unit={definition.unit === '–' ? '' : ` ${definition.unit}`}
                stroke={palette.axis}
                fontSize={11}
                fontFamily="JetBrains Mono"
                tickLine={false}
                width={80}
              />

              <Tooltip content={<TrendTooltip definition={definition} />} />

              <Area
                type="monotone"
                dataKey="value"
                name={definition.label}
                stroke={palette.line}
                strokeWidth={2}
                fill="url(#trendGradient)"
                connectNulls={false}
                activeDot={{ r: 5, stroke: palette.line, strokeWidth: 2, fill: palette.marker }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={definition.label}
                stroke={palette.line}
                strokeWidth={2}
                dot={{ r: 3.5, stroke: palette.line, fill: palette.marker }}
                activeDot={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-paper-400">
        <div className="text-xs font-mono text-kraft-700 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            EXAMINATIONS
          </span>
          <span className="text-[11px]">{sortedScans.length}</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {sortedScans.map((scan) => {
            const isSelected = scan.id === selectedScanId;
            const value = scan.metrics[definition.key];
            return (
              <button
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className={`p-2 rounded-lg text-left transition-all border text-xs cursor-pointer font-mono ${
                  isSelected
                    ? 'bg-kraft-400 text-composite-950 border-kraft-600 font-semibold'
                    : 'bg-paper-100 border-paper-400 hover:bg-paper-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold">{scan.months_post_op} mo</span>
                  {scan.status !== 'ready' ? (
                    <span className="flex items-center gap-1 text-[10px] text-hazard-600 font-bold">
                      {scan.status === 'pending' ? (
                        <>
                          <AlarmClock className="w-3 h-3" /> RUNNING
                        </>
                      ) : (
                        'FAILED'
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px]">{formatMetric(value, definition)}</span>
                  )}
                </div>
                <div className="text-[10px] text-kraft-700 mt-1">{scan.scan_date}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
