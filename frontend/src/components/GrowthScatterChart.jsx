import Plot from 'react-plotly.js';

const DARK_LAYOUT = {
  margin: { l: 56, r: 16, t: 8, b: 48 },
  plot_bgcolor: '#151b23',
  paper_bgcolor: '#151b23',
  font: { family: '"DM Sans", system-ui, sans-serif', size: 11, color: '#8b98a9' },
  legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center', font: { size: 11, color: '#8b98a9' } },
};

const GRID = '#1e2736';

export default function GrowthScatterChart({ matchedTable }) {
  if (!matchedTable || matchedTable.length === 0) return null;

  const points = matchedTable
    .filter(r => r.run_2022 && r.run_2022.odometer_ft != null)
    .map(r => {
      const growth = r.growth_15_22 || r.growth_07_22 || r.growth_07_15;
      const rate = growth?.annual_growth_rate_pct ?? null;
      return {
        x: r.run_2022.odometer_ft,
        depth: r.run_2022.depth_pct,
        rate,
        severity: r.severity,
        feature: r.run_2022.feature_description,
      };
    })
    .filter(p => p.depth != null);

  const critical = points.filter(p => p.severity === 'critical');
  const moderate = points.filter(p => p.severity === 'moderate');
  const low = points.filter(p => p.severity === 'low');
  const unknown = points.filter(p => p.severity === 'unknown');

  const makeTrace = (pts, name, color) => ({
    x: pts.map(p => p.x),
    y: pts.map(p => p.depth),
    text: pts.map(p =>
      `${p.feature}<br>Depth: ${p.depth?.toFixed(1)}%<br>Rate: ${p.rate != null ? p.rate.toFixed(2) + '%/yr' : 'N/A'}`
    ),
    type: 'scatter',
    mode: 'markers',
    name,
    marker: { color, size: 5, opacity: 0.8 },
    hovertemplate: '%{text}<extra></extra>',
  });

  const traces = [
    makeTrace(critical, 'Critical', '#ef4444'),
    makeTrace(moderate, 'Moderate', '#f59e0b'),
    makeTrace(low, 'Low', '#22c55e'),
    makeTrace(unknown, 'Unknown', '#566073'),
  ].filter(t => t.x.length > 0);

  return (
    <div className="card p-4 overflow-hidden">
      <h3 className="section-label mb-3">Anomaly Depth vs. Distance (2022)</h3>
      <Plot
        data={traces}
        layout={{
          ...DARK_LAYOUT,
          height: 320,
          xaxis: { title: { text: 'Odometer (ft)', font: { size: 11, color: '#566073' } }, gridcolor: GRID },
          yaxis: { title: { text: 'Depth (%WT)', font: { size: 11, color: '#566073' } }, gridcolor: GRID, rangemode: 'tozero' },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
    </div>
  );
}
