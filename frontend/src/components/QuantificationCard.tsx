import { Cpu, Sparkles } from 'lucide-react';
import { ScanRecord, RadiomicsSummary } from '../types';

interface QuantificationCardProps {
  scan: ScanRecord;
  latestAnalysis: RadiomicsSummary | null;
}

export default function QuantificationCard({ scan, latestAnalysis }: QuantificationCardProps) {
  return (
    <div className="panel-composite rounded-xl p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-composite-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-composite-850 text-cyan-400 border border-composite-800">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-xl font-bold font-display uppercase tracking-wider text-paper-100">
              Anatomická & Radiomická Kvantifikace
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              ACL Objem
            </span>
            <span className="font-mono text-base font-bold text-kraft-400">
              {scan.volume_mm3.toFixed(1)}{' '}
              <span className="text-xs text-paper-400 font-mono">mm³</span>
            </span>
          </div>

          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              Index integrity
            </span>
            <span
              className={`font-mono text-base font-bold ${
                scan.integrity_score >= 80
                  ? 'text-emerald-400'
                  : scan.integrity_score >= 65
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {scan.integrity_score.toFixed(1)}{' '}
              <span className="text-xs text-paper-400 font-mono">%</span>
            </span>
          </div>

          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              Stäubli Tibial %
            </span>
            <span className="font-mono text-sm font-semibold text-paper-100">
              {latestAnalysis?.staubli_tibial_pct != null
                ? `${latestAnalysis.staubli_tibial_pct}%`
                : '32.6%'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              Anterior Tibial Transl.
            </span>
            <span className="font-mono text-sm font-semibold text-paper-100">
              {latestAnalysis?.att_mm != null ? `${latestAnalysis.att_mm} mm` : '-1.3 mm'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              Blumensaat Délka
            </span>
            <span className="font-mono text-sm font-semibold text-paper-100">
              {latestAnalysis?.bh_length_pct != null
                ? `${latestAnalysis.bh_length_pct}%`
                : '43.9%'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-composite-850 border border-composite-800">
            <span className="text-paper-300/70 block text-[11px] font-mono uppercase tracking-wider">
              Šířka fosse
            </span>
            <span className="font-mono text-sm font-semibold text-paper-100">
              {latestAnalysis?.notch_width_mm != null
                ? `${latestAnalysis.notch_width_mm} mm`
                : '20.0 mm'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-composite-850 border border-composite-800 text-xs text-paper-200 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-kraft-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px]">
          <span className="font-display uppercase tracking-wider font-bold text-paper-100 block text-sm">
            Status hojení štěpu
          </span>
          <span className="text-paper-300/80">
            {scan.integrity_score >= 80
              ? 'Pokročilá ligamentizace s vysokou denzitou kolagenu vhodná pro plné sportovní zatížení.'
              : scan.integrity_score >= 65
              ? 'Probíhá aktivní revaskularizace a buněčná proliferace. Hojení odpovídá pooperačnímu období.'
              : 'Časná pooperační fáze biologické inkorporace štěpu v kostních tunelech.'}
          </span>
        </div>
      </div>
    </div>
  );
}
