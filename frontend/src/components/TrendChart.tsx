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
      <div className="bg-[#FAF6EE] p-3 rounded-lg border border-[#D5C5A8] text-xs font-mono text-[#1A1D20] space-y-1.5 shadow-lg">
        <div className="font-semibold text-[#1A1D20] flex items-center justify-between gap-4 border-b border-[#E4D8C2] pb-1">
          <span>{label} MĚSÍCŮ</span>
          <span className="text-[#78716C] text-[11px]">{data.scan_date}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1A1D20] inline-block" />
            Integrita štěpu:
          </span>
          <span className="font-bold text-[#1A1D20]">{data.integrity}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] inline-block" />
            Objem vazu:
          </span>
          <span className="font-bold text-[#0284C7]">{data.volume} mm³</span>
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
      <div className="bg-[#F4EBD9] border border-[#E0D3BD] rounded-2xl p-6 text-center text-[#78716C]">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-[#A8A29E]" />
        <p className="text-sm font-mono">Žádné dlouhodobé záznamy pro tento subjekt.</p>
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
    <div className="bg-[#F4EBD9] border border-[#E0D3BD] rounded-2xl p-5 mb-6 text-[#1A1D20] shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E0D3BD]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[#1A1D20] text-[#F4EBD9]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display uppercase tracking-wider text-[#1A1D20]">
              Trajektorie Remodelace Štěpu
            </h2>
            <p className="text-xs text-[#78716C] font-mono">
              Vývoj integrity vazu (%) a objemu (mm³) v čase od plastiky
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-[#1A1D20] font-semibold">
            <span className="w-3 h-1.5 rounded-sm bg-[#1A1D20]" />
            INTEGRITA (%)
          </span>
          <span className="flex items-center gap-1.5 text-[#0284C7] font-semibold">
            <span className="w-3 h-1.5 rounded-sm bg-[#0284C7]" />
            OBJEM (mm³)
          </span>
        </div>
      </div>

      {/* Main Chart (Off-white canvas with Slate Black curve) */}
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

            {/* Left Axis: Integrity (30 - 100%) - Břidlicová černá */}
            <YAxis
              yAxisId="left"
              domain={[30, 100]}
              unit="%"
              stroke="#1A1D20"
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
            />

            {/* Right Axis: Volume (mm3) - Technická cyan */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={['dataMin - 300', 'dataMax + 300']}
              unit=" mm³"
              stroke="#0284C7"
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Křivka integrity: Břidlicová černá (#1A1D20) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="integrity"
              name="Integrita"
              stroke="#1A1D20"
              strokeWidth={3}
              fill="url(#integrityGradient)"
              activeDot={{ r: 5, stroke: '#1A1D20', strokeWidth: 2, fill: '#FAF6EE' }}
            />

            {/* Křivka objemu: Technická cyan (#0284C7) */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="volume"
              name="Objem"
              stroke="#0284C7"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3.5, stroke: '#0284C7', fill: '#FAF6EE' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chronological Checkpoints Timeline */}
      <div className="mt-4 pt-3 border-t border-[#E0D3BD]">
        <div className="text-xs font-mono text-[#78716C] mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-[#1A1D20]">
            <Clock className="w-3.5 h-3.5 text-[#1A1D20]" />
            ČASOVÁ OSA VYŠETŘENÍ:
          </span>
          <span className="text-[11px]">{sortedScans.length} ZÁZNAMŮ</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sortedScans.map((s) => {
            const isSelected = s.id === selectedScanId;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScan(s)}
                className={`p-2.5 rounded-lg text-left transition-all border text-xs cursor-pointer font-mono ${
                  isSelected
                    ? 'bg-[#C4A482] text-[#121416] border-[#9E7B56] shadow-sm font-semibold'
                    : 'bg-[#FAF6EE] border-[#E0D3BD] text-[#1A1D20] hover:bg-[#EFE6D5]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{s.months_post_op} měs.</span>
                  <span className="text-[11px] opacity-80">{s.integrity_score.toFixed(0)}%</span>
                </div>
                <div className="text-[11px] opacity-75 mt-1 flex items-center justify-between">
                  <span>{s.volume_mm3.toFixed(0)} mm³</span>
                  <span className="text-[10px]">{s.scan_date}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
