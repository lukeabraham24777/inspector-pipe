import { useState } from 'react';
import Plot from 'react-plotly.js';

const HORIZONS = [
  { key: 'critical_count_5yr', label: '5 yr', years: 5 },
  { key: 'critical_count_10yr', label: '10 yr', years: 10 },
  { key: 'critical_count_15yr', label: '15 yr', years: 15 },
  { key: 'critical_count_20yr', label: '20 yr', years: 20 },
];

const DARK_LAYOUT = {
  margin: { l: 56, r: 56, t: 8, b: 48 },
  plot_bgcolor: '#151b23',
  paper_bgcolor: '#151b23',
  font: { family: '"DM Sans", system-ui, sans-serif', size: 11, color: '#8b98a9' },
  legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center', font: { size: 11, color: '#8b98a9' } },
};

const GRID = '#1e2736';

export default function CorrosionPredictionChart({ predictionData }) {
  const [horizon, setHorizon] = useState('critical_count_20yr');
  const [showDensity, setShowDensity] = useState(false);
  const [showGrowth, setShowGrowth] = useState(false);

  if (!predictionData || !predictionData.positions_ft || predictionData.positions_ft.length === 0) {
    return null;
  }

  const { positions_ft, composite_risk_score, new_anomaly_density,
          avg_growth_rate_norm, high_risk_zones } = predictionData;

  const criticalCounts = predictionData[horizon] || [];

  const traces = [];

  traces.push({
    x: positions_ft,
    y: composite_risk_score,
    type: 'scatter',
    mode: 'lines',
    fill: 'tozeroy',
    name: 'Composite Risk',
    line: { color: '#EF4444', width: 1.5 },
    fillcolor: 'rgba(239, 68, 68, 0.08)',
    hovertemplate: 'Position: %{x:.0f} ft<br>Risk: %{y:.2f}<extra></extra>',
  });

  if (showDensity) {
    traces.push({
      x: positions_ft,
      y: new_anomaly_density,
      type: 'scatter',
      mode: 'lines',
      name: 'New Anomaly Density',
      line: { color: '#8B5CF6', dash: 'dash', width: 1.5 },
      hovertemplate: 'Position: %{x:.0f} ft<br>Density: %{y:.3f}<extra></extra>',
    });
  }

  if (showGrowth) {
    traces.push({
      x: positions_ft,
      y: avg_growth_rate_norm,
      type: 'scatter',
      mode: 'lines',
      name: 'Avg Growth Rate (norm)',
      line: { color: '#F59E0B', dash: 'dot', width: 1.5 },
      hovertemplate: 'Position: %{x:.0f} ft<br>Growth: %{y:.3f}<extra></extra>',
    });
  }

  if (criticalCounts.length > 0) {
    traces.push({
      x: positions_ft,
      y: criticalCounts,
      type: 'bar',
      name: `Critical in ${HORIZONS.find(h => h.key === horizon)?.label || ''}`,
      marker: { color: 'rgba(220, 38, 38, 0.12)' },
      yaxis: 'y2',
      hovertemplate: 'Position: %{x:.0f} ft<br>Critical: %{y}<extra></extra>',
    });
  }

  const shapes = high_risk_zones.map(zone => ({
    type: 'rect',
    x0: zone.start_ft,
    x1: zone.end_ft,
    y0: 0,
    y1: 1.05,
    fillcolor: 'rgba(239, 68, 68, 0.04)',
    line: { color: 'rgba(239, 68, 68, 0.2)', width: 1, dash: 'dot' },
    layer: 'below',
  }));

  const annotations = high_risk_zones.map(zone => ({
    x: (zone.start_ft + zone.end_ft) / 2,
    y: 1.02,
    text: `${(zone.risk_score * 100).toFixed(0)}%`,
    showarrow: false,
    font: { size: 9, color: '#ef4444' },
    bgcolor: 'rgba(239, 68, 68, 0.1)',
    borderpad: 2,
  }));

  const maxCritical = Math.max(...criticalCounts, 1);

  return (
    <div className="card p-4 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div>
          <h3 className="section-label">Corrosion Risk Forecast</h3>
          <p className="text-[11px] text-lo mt-0.5">KDE-based emergence density + growth extrapolation</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Horizon selector */}
          <div className="flex items-center gap-0.5 bg-elevated rounded-md p-0.5">
            {HORIZONS.map(h => (
              <button
                key={h.key}
                onClick={() => setHorizon(h.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  horizon === h.key
                    ? 'bg-raised text-hi shadow-sm'
                    : 'text-lo hover:text-mid'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          {/* Overlay toggles */}
          <label className="flex items-center gap-1.5 text-[11px] text-mid cursor-pointer select-none">
            <input type="checkbox" checked={showDensity} onChange={() => setShowDensity(!showDensity)} className="rounded accent-accent" />
            Density
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-mid cursor-pointer select-none">
            <input type="checkbox" checked={showGrowth} onChange={() => setShowGrowth(!showGrowth)} className="rounded accent-accent" />
            Growth
          </label>
        </div>
      </div>

      <Plot
        data={traces}
        layout={{
          ...DARK_LAYOUT,
          height: 340,
          xaxis: { title: { text: 'Pipeline Position (ft)', font: { size: 11, color: '#566073' } }, showgrid: true, gridcolor: GRID },
          yaxis: { title: { text: 'Risk Score (0\u20131)', font: { size: 11, color: '#566073' } }, range: [0, 1.1], showgrid: true, gridcolor: GRID },
          yaxis2: {
            title: { text: 'Projected Critical Count', font: { size: 11, color: '#566073' } },
            overlaying: 'y',
            side: 'right',
            range: [0, maxCritical * 2],
            showgrid: false,
          },
          shapes,
          annotations,
          bargap: 0.3,
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />

      {high_risk_zones.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-lo">High-risk zones:</span>
          {high_risk_zones.map((zone, i) => (
            <span key={i} className="text-[11px] bg-critical-dim text-critical px-2 py-0.5 rounded border border-critical/20">
              {zone.start_ft.toLocaleString()} – {zone.end_ft.toLocaleString()} ft ({(zone.risk_score * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
