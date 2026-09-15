import React from 'react';
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
import { TrendingUp, Clock } from 'lucide-react';
import { ScanRecord } from '../types';

interface TrendChartProps {
  scans?: ScanRecord[];
  selectedScanId?: string;
  onSelectScan: (scan: ScanRecord) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      id: string;
      months: number;
      integrity: number;
      volume: number;
      scan_date: string;
      raw: ScanRecord;
    };
  }>;
  label?: string | number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-panel-glow bg-slate-900/95 p-3.5 rounded-xl border border-teal-500/30 text-xs space-y-1.5 shadow-xl">
        <div className="font-semibold text-teal-300 flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5">
          <span>{label} Months Post-Op</span>
          <span className="text-slate-400 font-mono text-[11px]">{data.scan_date}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            Integrity Score:
          </span>
          <span className="font-mono font-bold text-amber-300">{data.integrity}%</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block"></span>
            Volume:
          </span>
          <span className="font-mono font-bold text-teal-300">{data.volume} mm³</span>
        </div>
        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 text-center">
          Click data point to load 3D mesh
        </div>
      </div>
    );
  }
  return null;
};

export default function TrendChart({
  scans = [],
  selectedScanId,
  onSelectScan,
}: TrendChartProps) {
  if (!scans || scans.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-slate-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm">No longitudinal scans recorded yet for this subject.</p>
      </div>
    );
  }

  // Format data for Recharts, sorted by months_post_op
  const sortedScans = [...scans].sort((a, b) => a.months_post_op - b.months_post_op);
  const chartData = sortedScans.map((s) => ({
    id: s.id,
    months: s.months_post_op,
    integrity: s.integrity_score,
    volume: s.volume_mm3,
    scan_date: s.scan_date,
    raw: s,
  }));

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              Longitudinal Remodeling Trajectory
            </h2>
            <p className="text-xs text-slate-400">
              Graft integrity score (%) & volumetric remodeling over months post-reconstruction
            </p>
          </div>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-3 h-1 rounded-full bg-amber-400"></span>
            Integrity Score (%)
          </span>
          <span className="flex items-center gap-1.5 text-teal-300">
            <span className="w-3 h-1 rounded-full bg-teal-400"></span>
            Volume (mm³)
          </span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="w-full h-72 sm:h-80 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 20, left: -10 }}
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload.length) {
                const clickedScan = e.activePayload[0].payload.raw as ScanRecord;
                onSelectScan(clickedScan);
              }
            }}
          >
            <defs>
              <linearGradient id="integrityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

            <XAxis
              dataKey="months"
              unit=" mo"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />

            {/* Left Axis: Integrity (0 - 100%) */}
            <YAxis
              yAxisId="left"
              domain={[30, 100]}
              unit="%"
              stroke="#f59e0b"
              fontSize={12}
              tickLine={false}
            />

            {/* Right Axis: Volume (mm3) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={['dataMin - 300', 'dataMax + 300']}
              unit=" mm³"
              stroke="#14b8a6"
              fontSize={11}
              tickLine={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="integrity"
              name="Integrity"
              stroke="#f59e0b"
              strokeWidth={3}
              fill="url(#integrityGradient)"
              activeDot={{ r: 6, stroke: '#fbbf24', strokeWidth: 2, fill: '#0f172a' }}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="volume"
              name="Volume"
              stroke="#14b8a6"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              dot={{ r: 4, stroke: '#2dd4bf', fill: '#0f172a' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Scan Timeline Pills */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            Chronological MRI Checkpoints (Click to inspect 3D mesh):
          </span>
          <span className="text-[11px] text-slate-500">{sortedScans.length} total examinations</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sortedScans.map((s) => {
            const isSelected = s.id === selectedScanId;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScan(s)}
                className={`p-2.5 rounded-xl text-left transition-all border text-xs cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/70 text-white ring-1 ring-amber-400/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between font-mono font-semibold text-xs text-amber-300">
                  <span>{s.months_post_op} mo</span>
                  <span className="text-[11px] text-slate-400 font-sans">{s.integrity_score.toFixed(0)}%</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{s.volume_mm3.toFixed(0)} mm³</span>
                  <span className="text-[10px] text-slate-500 font-mono">{s.scan_date}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
