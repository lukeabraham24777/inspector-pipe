import { Activity, AlertTriangle, CheckCircle, Clock, GitCompare, TrendingUp, Crosshair, PlusCircle } from 'lucide-react';

const cards = [
  { key: 'run_count', label: 'Runs', icon: Clock },
  { key: 'matched_count', label: 'Matched', icon: GitCompare },
  { key: 'new_anomalies_2015_count', label: 'New 2015', icon: AlertTriangle },
  { key: 'new_anomalies_2022_count', label: 'New 2022', icon: PlusCircle },
  { key: 'missing_anomalies_count', label: 'Missing', icon: Crosshair },
  { key: 'avg_growth_rate_pct', label: 'Avg Growth', icon: Activity, format: (v) => v.toFixed(2) + '%/yr' },
  { key: 'avg_match_score', label: 'Confidence', icon: CheckCircle, format: (v) => (v * 100).toFixed(1) + '%' },
  { key: 'max_odometer_shift_ft', label: 'Max Drift', icon: TrendingUp, format: (v) => v.toFixed(1) + ' ft' },
];

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div key={key} className="card px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-elevated flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-mid" />
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
