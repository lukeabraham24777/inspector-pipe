import Plot from 'react-plotly.js';

const DARK_LAYOUT = {
  margin: { l: 56, r: 16, t: 8, b: 48 },
  plot_bgcolor: '#151b23',
  paper_bgcolor: '#151b23',
  font: { family: '"DM Sans", system-ui, sans-serif', size: 11, color: '#8b98a9' },
  legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center', font: { size: 11, color: '#8b98a9' } },
  xaxis: { gridcolor: '#1e2736', zerolinecolor: '#2a3444' },
  yaxis: { gridcolor: '#1e2736', zerolinecolor: '#2a3444' },
};

export default function AlignmentChart({ corrections2015, corrections2022 }) {
  if ((!corrections2015 || corrections2015.length === 0) &&
      (!corrections2022 || corrections2022.length === 0)) {
    return null;
  }

  const traces = [];

  if (corrections2015 && corrections2015.length > 0) {
    traces.push({
      x: corrections2015.map(c => c.baseline_ft),
      y: corrections2015.map(c => c.shift_ft),
      type: 'scatter',
      mode: 'lines+markers',
      name: '2015 Shift',
      marker: { color: '#f59e0b', size: 3 },
      line: { color: '#f59e0b', width: 1.5 },
    });
  }

  if (corrections2022 && corrections2022.length > 0) {
    traces.push({
      x: corrections2022.map(c => c.baseline_ft),
      y: corrections2022.map(c => c.shift_ft),
      type: 'scatter',
      mode: 'lines+markers',
      name: '2022 Shift',
      marker: { color: '#3b82f6', size: 3 },
      line: { color: '#3b82f6', width: 1.5 },
    });
  }

  if (traces.length > 0) {
    const allX = traces.flatMap(t => t.x);
    traces.push({
      x: [Math.min(...allX), Math.max(...allX)],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: 'Baseline (2007)',
      line: { color: '#566073', width: 1, dash: 'dash' },
    });
  }

  return (
    <div className="card p-4 overflow-hidden">
      <h3 className="section-label mb-3">Odometer Drift at Girth Welds</h3>
      <Plot
        data={traces}
        layout={{
          ...DARK_LAYOUT,
          height: 320,
          xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'Baseline Distance (ft)', font: { size: 11, color: '#566073' } } },
          yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Odometer Shift (ft)', font: { size: 11, color: '#566073' } }, zeroline: true },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
    </div>
  );
}
