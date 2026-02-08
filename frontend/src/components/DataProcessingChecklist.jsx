import { CheckCircle2 } from 'lucide-react';

export default function DataProcessingChecklist({ summary }) {
  if (!summary) return null;

  const gwCount = summary.total_girth_welds_2007 ?? 0;
  const maxShift = summary.max_odometer_shift_ft?.toFixed(1) ?? '0';

  const steps = [
    'Schema headers normalized across 2007, 2015, 2022 naming conventions',
    'Clock positions converted to 0.0\u201312.0 decimal scale',
    'Girth weld positions extracted and aligned via piecewise linear interpolation',
    `Odometer drift corrected using ${gwCount} matched girth welds (max shift: ${maxShift} ft)`,
    'Anomalies matched across runs using Hungarian Algorithm (distance 50%, clock 30%, feature type 20%)',
    'Growth rates calculated with time-to-critical projections at 80% wall loss',
  ];

  return (
    <div className="card px-4 py-3">
      <h3 className="section-label mb-2">Data Processing</h3>
      <ul className="space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-ok flex-shrink-0 mt-0.5" />
            <span className="text-mid">{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
