import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const severityColors = {
  critical: 'bg-critical-dim text-critical',
  moderate: 'bg-warn-dim text-warn',
  low: 'bg-ok-dim text-ok',
  unknown: 'bg-elevated text-lo',
};

const statusColors = {
  matched: 'bg-ok-dim text-ok',
  missing: 'bg-elevated text-lo',
  new_2015: 'bg-info-dim text-info',
  new_2022: 'bg-info-dim text-info',
};

const statusLabels = {
  matched: 'Matched',
  missing: 'Missing',
  new_2015: 'New (2015)',
  new_2022: 'New (2022)',
};

export default function AnomalyTable({ matchedTable, onSelectAnomaly }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    if (!matchedTable) return [];
    let rows = matchedTable;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => {
        const feat07 = r.run_2007?.feature_description?.toLowerCase() || '';
        const feat15 = r.run_2015?.feature_description?.toLowerCase() || '';
        const feat22 = r.run_2022?.feature_description?.toLowerCase() || '';
        const odo = String(r.run_2022?.odometer_ft ?? r.run_2015?.odometer_ft ?? r.run_2007?.odometer_ft ?? '');
        const jt = String(r.run_2022?.joint_number ?? r.run_2015?.joint_number ?? r.run_2007?.joint_number ?? '');
        const fid = r.run_2022?.feature_id || r.run_2015?.feature_id || r.run_2007?.feature_id || '';
        return feat07.includes(q) || feat15.includes(q) || feat22.includes(q) ||
               odo.includes(q) || jt.includes(q) || r.status.includes(q) || r.severity.includes(q) ||
               fid.toLowerCase().includes(q);
      });
    }

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let va = getSortValue(a, sortKey);
        let vb = getSortValue(b, sortKey);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    return rows;
  }, [matchedTable, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (!matchedTable || matchedTable.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-edge flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="section-label">Anomaly Lineage</h3>
          <span className="text-[11px] text-lo">
            {filtered.length} anomalies
          </span>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lo" />
          <input
            type="text"
            placeholder="Search anomalies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 pr-3 py-1.5 border border-edge rounded-md text-[12px] w-56 bg-elevated focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-hi placeholder:text-lo"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-edge bg-elevated">
              {[
                { key: 'status', label: 'Status' },
                { key: 'feature_id', label: 'Feature ID' },
                { key: 'severity', label: 'Severity' },
                { key: 'odo_2007', label: '2007 Dist (ft)' },
                { key: 'depth_2007', label: '2007 Depth' },
                { key: 'odo_2015', label: '2015 Dist (ft)' },
                { key: 'depth_2015', label: '2015 Depth' },
                { key: 'odo_2022', label: '2022 Dist (ft)' },
                { key: 'depth_2022', label: '2022 Depth' },
                { key: 'growth_rate', label: 'Growth (%/yr)' },
                { key: 'ttc', label: 'Time to Critical' },
                { key: 'length_rate', label: 'Len (in/yr)' },
                { key: 'width_rate', label: 'Wid (in/yr)' },
                { key: 'match_score', label: 'Confidence' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="px-2.5 py-2 text-left text-[11px] font-medium text-lo uppercase tracking-wider cursor-pointer select-none hover:bg-raised whitespace-nowrap transition-colors"
                  onClick={() => toggleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label} <SortIcon col={key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-subtle">
            {pageRows.map((row, i) => {
              const latestGrowth = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
              const rate = latestGrowth?.annual_growth_rate_pct;
              const ttc = latestGrowth?.time_to_critical_years;
              const lenRate = latestGrowth?.annual_length_growth_in;
              const widRate = latestGrowth?.annual_width_growth_in;
              const score = row.match_score_07_15 || row.match_score_15_22 || row.match_score_07_22;
              const featureId = row.run_2022?.feature_id || row.run_2015?.feature_id || row.run_2007?.feature_id || '-';

              const depth07 = row.run_2007?.depth_pct;
              const depth15 = row.run_2015?.depth_pct;
              const depth22 = row.run_2022?.depth_pct;

              return (
                <tr key={i} className="hover:bg-elevated cursor-pointer transition-colors" onClick={() => onSelectAnomaly?.(row)}>
                  <td className="px-2.5 py-2 text-mid">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColors[row.status] || 'bg-warn-dim text-warn'}`}>
                      {statusLabels[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-mid mono text-[11px]">{featureId}</td>
                  <td className="px-2.5 py-2 text-mid">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${severityColors[row.severity]}`}>
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-mid mono">{row.run_2007?.odometer_ft?.toFixed(1) ?? '-'}</td>
                  <td className={`px-2.5 py-2 mono ${
                    depth07 != null && depth07 >= 60 ? 'text-critical font-semibold' :
                    depth07 != null && depth07 >= 40 ? 'text-warn' :
                    'text-mid'
                  }`}>
                    {depth07 != null ? `${depth07.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-2.5 py-2 text-mid mono">{row.run_2015?.odometer_ft?.toFixed(1) ?? '-'}</td>
                  <td className={`px-2.5 py-2 mono ${
                    depth15 != null && depth15 >= 60 ? 'text-critical font-semibold' :
                    depth15 != null && depth15 >= 40 ? 'text-warn' :
                    'text-mid'
                  }`}>
                    {depth15 != null ? `${depth15.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-2.5 py-2 text-mid mono">{row.run_2022?.odometer_ft?.toFixed(1) ?? '-'}</td>
                  <td className={`px-2.5 py-2 mono ${
                    depth22 != null && depth22 >= 60 ? 'text-critical font-semibold' :
                    depth22 != null && depth22 >= 40 ? 'text-warn' :
                    'text-mid'
                  }`}>
                    {depth22 != null ? `${depth22.toFixed(1)}%` : '-'}
                  </td>
                  <td className={`px-2.5 py-2 mono ${
                    rate != null && rate > 3 ? 'text-critical font-semibold' :
                    rate != null && rate > 1 ? 'text-warn' :
                    rate != null ? 'text-mid' : 'text-lo'
                  }`}>
                    {rate != null ? rate.toFixed(2) : '-'}
                  </td>
                  <td className={`px-2.5 py-2 mono ${
                    ttc != null && ttc < 5 ? 'text-critical font-semibold' : 'text-mid'
                  }`}>
                    {ttc != null ? `${ttc.toFixed(1)} yr` : <span className="text-lo">N/A</span>}
                  </td>
                  <td className="px-2.5 py-2 text-mid mono">{lenRate != null ? lenRate.toFixed(4) : '-'}</td>
                  <td className="px-2.5 py-2 text-mid mono">{widRate != null ? widRate.toFixed(4) : '-'}</td>
                  <td className="px-2.5 py-2 text-mid">
                    {score != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 bg-elevated rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              score >= 0.7 ? 'bg-ok' : score >= 0.4 ? 'bg-warn' : 'bg-critical'
                            }`}
                            style={{ width: `${score * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-lo">{(score * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-lo">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-edge flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2.5 py-1 text-[12px] font-medium text-mid border border-edge rounded-md disabled:opacity-30 hover:bg-elevated transition-colors"
          >
            Previous
          </button>
          <span className="text-[12px] text-lo">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2.5 py-1 text-[12px] font-medium text-mid border border-edge rounded-md disabled:opacity-30 hover:bg-elevated transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function getSortValue(row, key) {
  switch (key) {
    case 'status': return row.status;
    case 'feature_id': return row.run_2022?.feature_id || row.run_2015?.feature_id || row.run_2007?.feature_id;
    case 'severity': return row.severity;
    case 'odo_2007': return row.run_2007?.odometer_ft;
    case 'depth_2007': return row.run_2007?.depth_pct;
    case 'odo_2015': return row.run_2015?.odometer_ft;
    case 'depth_2015': return row.run_2015?.depth_pct;
    case 'odo_2022': return row.run_2022?.odometer_ft;
    case 'depth_2022': return row.run_2022?.depth_pct;
    case 'growth_rate': {
      const g = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
      return g?.annual_growth_rate_pct;
    }
    case 'ttc': {
      const g = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
      return g?.time_to_critical_years;
    }
    case 'length_rate': {
      const g = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
      return g?.annual_length_growth_in;
    }
    case 'width_rate': {
      const g = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
      return g?.annual_width_growth_in;
    }
    case 'match_score':
      return row.match_score_07_15 || row.match_score_15_22 || row.match_score_07_22;
    default: return null;
  }
}
