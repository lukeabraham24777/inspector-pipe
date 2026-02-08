import { useMemo } from 'react';
import Plot from 'react-plotly.js';

const DARK_LAYOUT = {
  margin: { l: 56, r: 24, t: 8, b: 48 },
  plot_bgcolor: '#151b23',
  paper_bgcolor: '#151b23',
  font: { family: '"DM Sans", system-ui, sans-serif', size: 11, color: '#8b98a9' },
  legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center', font: { size: 11, color: '#8b98a9' } },
};

const GRID = '#1e2736';

export default function ClusterChart({ clusterData }) {
  if (!clusterData || !clusterData.bin_centers_ft || clusterData.bin_centers_ft.length === 0) {
    return null;
  }

  const { bin_centers_ft, anomaly_counts, threshold, mean_density, clusters } = clusterData;

  const barColors = useMemo(() => {
    return anomaly_counts.map(count => {
      if (count >= threshold * 1.5) return '#EF4444';
      if (count >= threshold) return '#F97316';
      return '#3B82F6';
    });
  }, [anomaly_counts, threshold]);

  const traces = [
    {
      x: bin_centers_ft,
      y: anomaly_counts,
      type: 'bar',
      name: 'Anomaly Count',
      marker: { color: barColors },
      hovertemplate: 'Position: %{x:.0f} ft<br>Count: %{y}<extra></extra>',
    },
    {
      x: [bin_centers_ft[0], bin_centers_ft[bin_centers_ft.length - 1]],
      y: [threshold, threshold],
      type: 'scatter',
      mode: 'lines',
      name: `Threshold (${threshold.toFixed(1)})`,
      line: { color: '#DC2626', dash: 'dash', width: 1.5 },
      hoverinfo: 'skip',
    },
    {
      x: [bin_centers_ft[0], bin_centers_ft[bin_centers_ft.length - 1]],
      y: [mean_density, mean_density],
      type: 'scatter',
      mode: 'lines',
      name: `Mean (${mean_density.toFixed(1)})`,
      line: { color: '#566073', dash: 'dot', width: 1 },
      hoverinfo: 'skip',
    },
  ];

  const shapes = clusters.map(c => ({
    type: 'rect',
    x0: c.start_ft,
    x1: c.end_ft,
    y0: 0,
    y1: Math.max(...anomaly_counts) * 1.1,
    fillcolor: 'rgba(239, 68, 68, 0.06)',
    line: { color: 'rgba(239, 68, 68, 0.2)', width: 1 },
    layer: 'below',
  }));

  const annotations = clusters.map(c => ({
    x: (c.start_ft + c.end_ft) / 2,
    y: Math.max(...anomaly_counts) * 1.05,
    text: `C${c.id} (${c.anomaly_count})`,
    showarrow: false,
    font: { size: 10, color: '#ef4444' },
  }));

  return (
    <div className="card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-label">Anomaly Density &amp; Clustering</h3>
        <span className="text-[11px] text-lo">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''} detected</span>
      </div>
      <Plot
        data={traces}
        layout={{
          ...DARK_LAYOUT,
          height: 320,
          xaxis: { title: { text: 'Pipeline Position (ft)', font: { size: 11, color: '#566073' } }, gridcolor: GRID },
          yaxis: { title: { text: 'Count per 200 ft Bin', font: { size: 11, color: '#566073' } }, gridcolor: GRID },
          shapes,
          annotations,
          bargap: 0.05,
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />
      {clusters.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-edge text-lo">
                <th className="px-2 py-1.5 text-left font-medium">Cluster</th>
                <th className="px-2 py-1.5 text-left font-medium">Range (ft)</th>
                <th className="px-2 py-1.5 text-right font-medium">Count</th>
                <th className="px-2 py-1.5 text-left font-medium">Severity</th>
                <th className="px-2 py-1.5 text-right font-medium">Avg Depth</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map(c => (
                <tr key={c.id} className="border-b border-edge-subtle">
                  <td className="px-2 py-1.5 font-medium text-hi">C{c.id}</td>
                  <td className="px-2 py-1.5 mono text-mid">{c.start_ft.toLocaleString()} – {c.end_ft.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right mono text-mid">{c.anomaly_count}</td>
                  <td className="px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      c.dominant_severity === 'critical' ? 'bg-critical-dim text-critical' :
                      c.dominant_severity === 'moderate' ? 'bg-warn-dim text-warn' :
                      'bg-ok-dim text-ok'
                    }`}>{c.dominant_severity}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right mono text-mid">{c.avg_depth_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
