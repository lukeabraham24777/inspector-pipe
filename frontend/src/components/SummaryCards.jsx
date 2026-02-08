import { Activity, AlertTriangle, CheckCircle, Clock, GitCompare, TrendingUp, Crosshair, PlusCircle } from 'lucide-react';

const cards = [
  { key: 'run_count', label: 'Runs', icon: Clock, iconBg: 'bg-info-dim', iconText: 'text-info', border: 'border-l-2 border-info/30' },
  { key: 'matched_count', label: 'Matched', icon: GitCompare, iconBg: 'bg-ok-dim', iconText: 'text-ok', border: 'border-l-2 border-ok/30' },
  { key: 'new_anomalies_2015_count', label: 'New 2015', icon: AlertTriangle, iconBg: 'bg-warn-dim', iconText: 'text-warn', border: 'border-l-2 border-warn/30' },
  { key: 'new_anomalies_2022_count', label: 'New 2022', icon: PlusCircle, iconBg: 'bg-warn-dim', iconText: 'text-warn', border: 'border-l-2 border-warn/30' },
  { key: 'missing_anomalies_count', label: 'Missing', icon: Crosshair, iconBg: 'bg-critical-dim', iconText: 'text-critical', border: 'border-l-2 border-critical/30' },
  { key: 'avg_growth_rate_pct', label: 'Avg Growth', icon: Activity, iconBg: 'bg-accent-dim', iconText: 'text-accent', border: 'border-l-2 border-accent/30', format: (v) => v.toFixed(2) + '%/yr' },
  { key: 'avg_match_score', label: 'Confidence', icon: CheckCircle, iconBg: 'bg-ok-dim', iconText: 'text-ok', border: 'border-l-2 border-ok/30', format: (v) => (v * 100).toFixed(1) + '%' },
  { key: 'max_odometer_shift_ft', label: 'Max Drift', icon: TrendingUp, iconBg: 'bg-info-dim', iconText: 'text-info', border: 'border-l-2 border-info/30', format: (v) => v.toFixed(1) + ' ft' },
];

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map(({ key, label, icon: Icon, iconBg, iconText, border, format }) => (
        <div key={key} className={`card px-3 py-3 ${border}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-md ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-3.5 h-3.5 ${iconText}`} />
            </div>
          </div>
          <div className="text-lg font-bold text-hi mono">
            {format ? format(summary[key] ?? 0) : (summary[key] ?? 0)}
          </div>
          <div className="text-[11px] text-lo mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}
