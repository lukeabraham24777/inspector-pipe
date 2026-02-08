import { useState, useMemo, Fragment } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';

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
  const [expandedRows, setExpandedRows] = useState(new Set());
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
        const latestRun = r.run_2022 || r.run_2015 || r.run_2007;
        const odo = String(latestRun?.odometer_ft ?? '');
        const jt = String(latestRun?.joint_number ?? '');
        const fid = latestRun?.feature_id || '';
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

  const toggleExpand = (index) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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
            onChange={(e) => { setSearch(e.target.value); setPage(0); setExpandedRows(new Set()); }}
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
                { key: 'latest_dist', label: 'Distance (ft)' },
                { key: 'latest_depth', label: 'Depth (%)' },
                { key: 'growth_rate', label: 'Growth (%/yr)' },
                { key: 'ttc', label: 'Time to Critical' },
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
              const globalIndex = page * pageSize + i;
              const isExpanded = expandedRows.has(globalIndex);
              const latestRun = row.run_2022 || row.run_2015 || row.run_2007;
              const latestGrowth = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
              const rate = latestGrowth?.annual_growth_rate_pct;
              const ttc = latestGrowth?.time_to_critical_years;
              const score = row.match_score_07_15 || row.match_score_15_22 || row.match_score_07_22;
              const dist = latestRun?.corrected_odometer_ft ?? latestRun?.odometer_ft;
              const depth = latestRun?.depth_pct;
              const featureId = latestRun?.feature_id || '-';

              return (
                <Fragment key={globalIndex}>
                  <tr className="hover:bg-elevated cursor-pointer transition-colors" onClick={() => onSelectAnomaly?.(row)}>
                    {/* Status with expand chevron */}
                    <td className="px-2.5 py-2 text-mid">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(globalIndex); }}
                          className="p-0.5 rounded hover:bg-raised transition-colors"
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3 h-3 text-lo" />
                            : <ChevronRight className="w-3 h-3 text-lo" />
                          }
                        </button>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColors[row.status] || 'bg-warn-dim text-warn'}`}>
                          {statusLabels[row.status] || row.status}
                        </span>
                      </div>
                    </td>
                    {/* Feature ID */}
                    <td className="px-2.5 py-2 text-mid mono text-[11px]">{featureId}</td>
                    {/* Severity */}
                    <td className="px-2.5 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${severityColors[row.severity]}`}>
                        {row.severity}
                      </span>
                    </td>
                    {/* Distance */}
                    <td className="px-2.5 py-2 text-mid mono">{dist != null ? dist.toFixed(1) : '-'}</td>
                    {/* Depth */}
                    <td className={`px-2.5 py-2 mono ${
                      depth != null && depth >= 60 ? 'text-critical font-semibold' :
                      depth != null && depth >= 40 ? 'text-warn' :
                      'text-mid'
                    }`}>
                      {depth != null ? `${depth.toFixed(1)}%` : '-'}
                    </td>
                    {/* Growth Rate */}
                    <td className={`px-2.5 py-2 mono ${
                      rate != null && rate > 3 ? 'text-critical font-semibold' :
                      rate != null && rate > 1 ? 'text-warn' :
                      rate != null ? 'text-mid' : 'text-lo'
                    }`}>
                      {rate != null ? rate.toFixed(2) : '-'}
                    </td>
                    {/* Time to Critical */}
                    <td className={`px-2.5 py-2 mono ${
                      ttc != null && ttc < 5 ? 'text-critical font-semibold' : 'text-mid'
                    }`}>
                      {ttc != null ? `${ttc.toFixed(1)} yr` : <span className="text-lo">N/A</span>}
                    </td>
                    {/* Confidence */}
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
                  {/* Expandable detail row */}
                  {isExpanded && <ExpandedRowDetail row={row} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-edge flex items-center justify-between">
          <button
            onClick={() => { setPage(p => Math.max(0, p - 1)); setExpandedRows(new Set()); }}
            disabled={page === 0}
            className="px-2.5 py-1 text-[12px] font-medium text-mid border border-edge rounded-md disabled:opacity-30 hover:bg-elevated transition-colors"
          >
            Previous
          </button>
          <span className="text-[12px] text-lo">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); setExpandedRows(new Set()); }}
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

function ExpandedRowDetail({ row }) {
  const runs = [
    { year: 2007, run: row.run_2007 },
    { year: 2015, run: row.run_2015 },
    { year: 2022, run: row.run_2022 },
  ].filter(r => r.run != null);

  const matchDetails = [
    { label: '07\u201315', score: row.match_score_07_15, detail: row.match_detail_07_15 },
    { label: '15\u201322', score: row.match_score_15_22, detail: row.match_detail_15_22 },
    { label: '07\u201322', score: row.match_score_07_22, detail: row.match_detail_07_22 },
  ].filter(m => m.score != null);

  return (
    <tr>
      <td colSpan={8} className="px-4 py-3 bg-elevated/50 border-b border-edge-subtle">
        <div className="space-y-3">
          {/* Per-run data */}
          <div>
            <span className="text-[10px] text-lo uppercase tracking-wide font-semibold">Inspection Runs</span>
            <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${runs.length}, 1fr)` }}>
              {runs.map(({ year, run }) => (
                <div key={year} className="border border-edge-subtle rounded px-2.5 py-2 text-[11px]">
                  <div className="font-medium text-lo mb-1.5">{year}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-lo">Dist:</span> <span className="mono text-hi">{run.odometer_ft?.toFixed(1) ?? '-'}</span></div>
                    <div><span className="text-lo">Corrected:</span> <span className="mono text-hi">{run.corrected_odometer_ft?.toFixed(1) ?? '-'}</span></div>
                    <div><span className="text-lo">Depth:</span> <span className="mono text-hi">{run.depth_pct != null ? `${run.depth_pct.toFixed(1)}%` : '-'}</span></div>
                    <div><span className="text-lo">Wall:</span> <span className="mono text-hi">{run.wall_thickness_in?.toFixed(3) ?? '-'}</span></div>
                    <div><span className="text-lo">Length:</span> <span className="mono text-hi">{run.length_in?.toFixed(2) ?? '-'}</span></div>
                    <div><span className="text-lo">Width:</span> <span className="mono text-hi">{run.width_in?.toFixed(2) ?? '-'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match detail breakdown */}
          {matchDetails.length > 0 && (
            <div>
              <span className="text-[10px] text-lo uppercase tracking-wide font-semibold">Match Breakdown</span>
              <div className="mt-1.5 flex gap-4">
                {matchDetails.map(({ label, score, detail }) => (
                  <div key={label} className="text-[11px]">
                    <span className="text-lo">{label}:</span>
                    <span className="mono text-hi ml-1">{(score * 100).toFixed(0)}%</span>
                    {detail && (
                      <span className="text-lo ml-2 text-[10px]">
                        (D:{(detail.distance_confidence * 100).toFixed(0)}% C:{(detail.clock_confidence * 100).toFixed(0)}% F:{(detail.feature_confidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function getSortValue(row, key) {
  const latestRun = row.run_2022 || row.run_2015 || row.run_2007;
  const latestGrowth = row.growth_15_22 || row.growth_07_22 || row.growth_07_15;
  switch (key) {
    case 'status': return row.status;
    case 'feature_id': return latestRun?.feature_id;
    case 'severity': return row.severity;
    case 'latest_dist': return latestRun?.corrected_odometer_ft ?? latestRun?.odometer_ft;
    case 'latest_depth': return latestRun?.depth_pct;
    case 'growth_rate': return latestGrowth?.annual_growth_rate_pct;
    case 'ttc': return latestGrowth?.time_to_critical_years;
    case 'match_score':
      return row.match_score_07_15 || row.match_score_15_22 || row.match_score_07_22;
    default: return null;
  }
}
