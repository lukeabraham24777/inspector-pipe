import { X, AlertTriangle, Clock, TrendingUp, MapPin, Ruler } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'bg-critical-dim text-critical', deadline: 'Immediate Repair Required', citation: '49 CFR 192.485' },
  moderate: { label: 'Moderate', color: '#f59e0b', bg: 'bg-warn-dim text-warn', deadline: '60-Day Repair Window', citation: 'ASME B31.8S Table 4' },
  low: { label: 'Low', color: '#22c55e', bg: 'bg-ok-dim text-ok', deadline: 'Scheduled Maintenance', citation: '49 CFR 192.485(c)' },
  unknown: { label: 'Monitor', color: '#566073', bg: 'bg-elevated text-lo', deadline: 'Routine Monitoring', citation: '49 CFR 192.485(d)' },
};

function formatClock(decimal) {
  if (decimal == null) return 'N/A';
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export default function AnomalyProfile({ row, onClose }) {
  const latestRun = row.run_2022 || row.run_2015 || row.run_2007;
  const latestGrowth = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
  const config = SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.unknown;

  const featureId = latestRun?.feature_id || '-';
  const depthGrowth = latestGrowth?.annual_growth_rate_pct;
  const ttc = latestGrowth?.time_to_critical_years;
  const distance = latestRun?.corrected_odometer_ft ?? latestRun?.odometer_ft;
  const clockPos = latestRun?.clock_position;
  const clockDegrees = clockPos != null ? clockPos * 30 : null;

  const runs = [
    { year: 2007, run: row.run_2007 },
    { year: 2015, run: row.run_2015 },
    { year: 2022, run: row.run_2022 },
  ].filter(r => r.run != null);

  const matchPairs = [
    { label: '2007\u20132015', value: row.match_score_07_15, detail: row.match_detail_07_15 },
    { label: '2015\u20132022', value: row.match_score_15_22, detail: row.match_detail_15_22 },
    { label: '2007\u20132022', value: row.match_score_07_22, detail: row.match_detail_07_22 },
  ].filter(s => s.value != null);

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-surface border-l border-edge shadow-lg z-50 overflow-y-auto panel-scroll">
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-edge px-5 py-3 flex items-center justify-between z-10">
        <div>
          <h2 className="font-semibold text-[15px] text-hi">{featureId}</h2>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${config.bg}`}>
            {config.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-elevated transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4 text-lo" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Regulatory Info */}
        <div className="rounded-md p-3 border" style={{ backgroundColor: `${config.color}08`, borderColor: `${config.color}20` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: config.color }} />
            <span className="font-medium text-[12px]" style={{ color: config.color }}>
              {config.deadline}
            </span>
          </div>
          <p className="text-[11px] text-lo">{config.citation}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricBox
            icon={<TrendingUp className="h-3.5 w-3.5 text-accent" />}
            label="Depth Growth"
            value={depthGrowth != null ? `${depthGrowth.toFixed(2)}%/yr` : 'N/A'}
            warning={depthGrowth != null && depthGrowth > 3}
          />
          <MetricBox
            icon={<Clock className="h-3.5 w-3.5 text-warn" />}
            label="Time to Critical"
            value={ttc != null ? `${ttc.toFixed(1)} yr` : 'N/A'}
            warning={ttc != null && ttc < 5}
          />
          <MetricBox
            icon={<Ruler className="h-3.5 w-3.5 text-ok" />}
            label="Distance"
            value={distance != null ? `${distance.toFixed(0)} ft` : 'N/A'}
          />
          <MetricBox
            icon={<MapPin className="h-3.5 w-3.5 text-mid" />}
            label="Clock Position"
            value={formatClock(clockPos)}
          />
        </div>

        {/* Inspection History */}
        <div>
          <h3 className="section-label mb-2.5">Inspection History</h3>
          <div className="space-y-2.5">
            {runs.map(({ year, run }, i) => (
              <div key={year} className="border border-edge rounded-md p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-lo uppercase tracking-wide">
                    Run {i + 1} — {year}
                  </span>
                  <span className="text-[11px] text-lo mono">{run.feature_id || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-lo">Depth</span>
                    <p className="font-medium text-hi">{run.depth_pct != null ? `${run.depth_pct.toFixed(1)}%` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-lo">Length</span>
                    <p className="font-medium text-hi">{run.length_in != null ? `${run.length_in.toFixed(2)} in` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-lo">Width</span>
                    <p className="font-medium text-hi">{run.width_in != null ? `${run.width_in.toFixed(2)} in` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-lo">Distance</span>
                    <p className="font-medium text-hi">{run.odometer_ft != null ? `${run.odometer_ft.toFixed(0)} ft` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-lo">Corrected</span>
                    <p className="font-medium text-hi">{run.corrected_odometer_ft != null ? `${run.corrected_odometer_ft.toFixed(0)} ft` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-lo">Wall</span>
                    <p className="font-medium text-hi">{run.wall_thickness_in != null ? `${run.wall_thickness_in.toFixed(3)} in` : '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Growth Rates */}
        {latestGrowth && (
          <div>
            <h3 className="section-label mb-2.5">Growth Rates</h3>
            <div className="space-y-2">
              <GrowthBar label="Depth" rate={depthGrowth || 0} unit="%/yr" max={10} />
              <GrowthBar label="Length" rate={latestGrowth.annual_length_growth_in || 0} unit="in/yr" max={2} />
              <GrowthBar label="Width" rate={latestGrowth.annual_width_growth_in || 0} unit="in/yr" max={2} />
            </div>
          </div>
        )}

        {/* Match Confidence */}
        {matchPairs.length > 0 && (
          <div>
            <h3 className="section-label mb-2.5">Match Confidence</h3>
            <div className="space-y-3">
              {matchPairs.map(({ label, value, detail }) => (
                <div key={label}>
                  <ConfidenceBar label={label} value={value} />
                  {detail && (
                    <div className="ml-[68px] mt-1.5 space-y-1">
                      <ComponentBar label="Distance" value={detail.distance_confidence} weight="50%" />
                      <ComponentBar label="Clock" value={detail.clock_confidence} weight="30%" />
                      <ComponentBar label="Feature" value={detail.feature_confidence} weight="20%" />
                    </div>
                  )}
                </div>
              ))}
              {matchPairs.length > 1 && (
                <div className="border-t border-edge-subtle pt-2 mt-2">
                  <ConfidenceBar
                    label="Overall"
                    value={matchPairs.reduce((s, e) => s + e.value, 0) / matchPairs.length}
                    highlight
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pipe Cross-Section */}
        {clockDegrees != null && (
          <div>
            <h3 className="section-label mb-2.5">Pipe Cross-Section</h3>
            <ClockPositionDiagram degrees={clockDegrees} />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBox({ icon, label, value, warning }) {
  return (
    <div className="border border-edge rounded-md p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-lo">{label}</span>
      </div>
      <p className={`text-[13px] font-semibold mono ${warning ? 'text-critical' : 'text-hi'}`}>
        {value}
      </p>
    </div>
  );
}

function GrowthBar({ label, rate, unit, max }) {
  const pct = Math.min(100, (Math.abs(rate) / max) * 100);
  const isNeg = rate < 0;

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] text-lo w-12">{label}</span>
      <div className="flex-1 bg-elevated rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${
            Math.abs(rate) > max * 0.6 ? 'bg-critical' : Math.abs(rate) > max * 0.3 ? 'bg-warn' : 'bg-ok'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium mono w-16 text-right ${isNeg ? 'text-info' : 'text-mid'}`}>
        {rate.toFixed(2)} {unit}
      </span>
    </div>
  );
}

function ConfidenceBar({ label, value, highlight }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`text-[11px] w-16 ${highlight ? 'font-semibold text-mid' : 'text-lo'}`}>
        {label}
      </span>
      <div className="flex-1 bg-elevated rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${
            value >= 0.7 ? 'bg-ok' : value >= 0.4 ? 'bg-warn' : 'bg-critical'
          }`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className={`text-[11px] mono w-10 text-right ${highlight ? 'font-semibold text-hi' : 'text-mid'}`}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ComponentBar({ label, value, weight }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-lo w-14">{label}</span>
      <div className="flex-1 bg-elevated rounded-full h-1">
        <div
          className={`h-1 rounded-full ${
            value >= 0.7 ? 'bg-ok/60' : value >= 0.4 ? 'bg-warn/60' : 'bg-critical/60'
          }`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-[10px] mono text-lo w-8 text-right">{(value * 100).toFixed(0)}%</span>
      <span className="text-[9px] text-lo/50 w-6">{weight}</span>
    </div>
  );
}

function ClockPositionDiagram({ degrees }) {
  const radius = 50;
  const cx = 60;
  const cy = 60;

  const rad = ((degrees - 90) * Math.PI) / 180;
  const dotX = cx + radius * Math.cos(rad);
  const dotY = cy + radius * Math.sin(rad);

  return (
    <div className="flex justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#2a3444" strokeWidth="8" />
        <circle cx={cx} cy={cy} r={radius - 4} fill="none" stroke="#1e2736" strokeWidth="1" />

        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const r = ((deg - 90) * Math.PI) / 180;
          const x1 = cx + (radius - 12) * Math.cos(r);
          const y1 = cy + (radius - 12) * Math.sin(r);
          const x2 = cx + (radius - 6) * Math.cos(r);
          const y2 = cy + (radius - 6) * Math.sin(r);
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#566073" strokeWidth="1" />
          );
        })}

        <text x={cx} y={15} textAnchor="middle" fontSize="8" fill="#566073">12</text>
        <text x={115} y={cx + 3} textAnchor="middle" fontSize="8" fill="#566073">3</text>
        <text x={cx} y={112} textAnchor="middle" fontSize="8" fill="#566073">6</text>
        <text x={5} y={cx + 3} textAnchor="middle" fontSize="8" fill="#566073">9</text>

        <circle cx={dotX} cy={dotY} r={5} fill="#ef4444" stroke="#0c1117" strokeWidth="2" />
        <line x1={cx} y1={cy} x2={dotX} y2={dotY} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" />
      </svg>
    </div>
  );
}
