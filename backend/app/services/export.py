"""Excel export service for matched anomaly results."""
from __future__ import annotations

import io
from typing import Optional

import xlsxwriter


def export_results_xlsx(matched_table: list[dict], alignment_result: dict) -> bytes:
    """Generate a multi-tab Excel workbook with alignment results.

    Tabs:
    - Summary: Overview statistics
    - Defect History: Full matched anomaly lineage
    - New Anomalies: Features only in later runs
    - Missing Anomalies: Features lost between runs
    - Girth Weld Alignment: Odometer correction details
    """
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})

    # Formats
    header_fmt = wb.add_format({
        "bold": True, "bg_color": "#2563EB", "font_color": "white",
        "border": 1, "text_wrap": True, "valign": "vcenter",
    })
    red_fmt = wb.add_format({"bg_color": "#FEE2E2", "border": 1, "num_format": "0.00"})
    orange_fmt = wb.add_format({"bg_color": "#FEF3C7", "border": 1, "num_format": "0.00"})
    green_fmt = wb.add_format({"bg_color": "#D1FAE5", "border": 1, "num_format": "0.00"})
    default_fmt = wb.add_format({"border": 1, "num_format": "0.00"})
    int_fmt = wb.add_format({"border": 1, "num_format": "0"})
    text_fmt = wb.add_format({"border": 1, "text_wrap": True})

    severity_fmts = {
        "critical": red_fmt,
        "moderate": orange_fmt,
        "low": green_fmt,
        "unknown": default_fmt,
    }

    # --- Summary Sheet ---
    ws_sum = wb.add_worksheet("Summary")
    matched = [r for r in matched_table if r["status"] == "matched"]
    new_15 = [r for r in matched_table if r["status"] == "new_2015"]
    new_22 = [r for r in matched_table if r["status"] == "new_2022"]
    missing = [r for r in matched_table if r["status"] == "missing"]

    summary_data = [
        ("Total Matched Anomalies", len(matched)),
        ("New Anomalies (2015)", len(new_15)),
        ("New Anomalies (2022)", len(new_22)),
        ("Missing Anomalies", len(missing)),
        ("Total Records", len(matched_table)),
        ("Critical Growth (>10%/yr)", sum(1 for r in matched_table if r["severity"] == "critical")),
        ("Moderate Growth (5-10%/yr)", sum(1 for r in matched_table if r["severity"] == "moderate")),
        ("Low Growth (<5%/yr)", sum(1 for r in matched_table if r["severity"] == "low")),
    ]
    ws_sum.write(0, 0, "Metric", header_fmt)
    ws_sum.write(0, 1, "Value", header_fmt)
    for i, (metric, value) in enumerate(summary_data, 1):
        ws_sum.write(i, 0, metric, text_fmt)
        ws_sum.write(i, 1, value, int_fmt)
    ws_sum.set_column(0, 0, 30)
    ws_sum.set_column(1, 1, 15)

    # --- Defect History Sheet ---
    ws_hist = wb.add_worksheet("Defect History")
    hist_headers = [
        "Status", "Severity", "Feature ID",
        "2007 Odometer (ft)", "2007 Feature", "2007 Depth (%)", "2007 Depth (in)",
        "2007 Clock", "2007 Length (in)", "2007 Width (in)",
        "2015 Odometer (ft)", "2015 Feature", "2015 Depth (%)", "2015 Depth (in)",
        "2015 Clock", "2015 Length (in)", "2015 Width (in)",
        "2022 Odometer (ft)", "2022 Feature", "2022 Depth (%)", "2022 Depth (in)",
        "2022 Clock", "2022 Length (in)", "2022 Width (in)",
        "Match Score 07-15", "Match Score 15-22",
        "Growth %WT (07-15)", "Growth %WT (15-22)", "Growth %WT (07-22)",
        "Annual Rate %/yr (07-15)", "Annual Rate %/yr (15-22)", "Annual Rate %/yr (07-22)",
        "Length Growth in/yr (07-15)", "Length Growth in/yr (15-22)", "Length Growth in/yr (07-22)",
        "Width Growth in/yr (07-15)", "Width Growth in/yr (15-22)", "Width Growth in/yr (07-22)",
        "Time to Critical (yrs)",
    ]
    for c, h in enumerate(hist_headers):
        ws_hist.write(0, c, h, header_fmt)

    for row_idx, entry in enumerate(matched_table, 1):
        sev = entry.get("severity", "unknown")
        fmt = severity_fmts.get(sev, default_fmt)

        ws_hist.write(row_idx, 0, entry["status"], text_fmt)
        ws_hist.write(row_idx, 1, sev, fmt)

        # Feature ID from latest run
        fid = (entry.get("run_2022") or entry.get("run_2015") or entry.get("run_2007") or {}).get("feature_id", "")
        ws_hist.write(row_idx, 2, fid, text_fmt)

        # 2007 data
        r07 = entry.get("run_2007") or {}
        ws_hist.write(row_idx, 3, r07.get("odometer_ft"), default_fmt)
        ws_hist.write(row_idx, 4, r07.get("feature_description", ""), text_fmt)
        ws_hist.write(row_idx, 5, r07.get("depth_pct"), fmt)
        ws_hist.write(row_idx, 6, r07.get("depth_in"), default_fmt)
        ws_hist.write(row_idx, 7, r07.get("clock_position"), default_fmt)
        ws_hist.write(row_idx, 8, r07.get("length_in"), default_fmt)
        ws_hist.write(row_idx, 9, r07.get("width_in"), default_fmt)

        # 2015 data
        r15 = entry.get("run_2015") or {}
        ws_hist.write(row_idx, 10, r15.get("odometer_ft"), default_fmt)
        ws_hist.write(row_idx, 11, r15.get("feature_description", ""), text_fmt)
        ws_hist.write(row_idx, 12, r15.get("depth_pct"), fmt)
        ws_hist.write(row_idx, 13, r15.get("depth_in"), default_fmt)
        ws_hist.write(row_idx, 14, r15.get("clock_position"), default_fmt)
        ws_hist.write(row_idx, 15, r15.get("length_in"), default_fmt)
        ws_hist.write(row_idx, 16, r15.get("width_in"), default_fmt)

        # 2022 data
        r22 = entry.get("run_2022") or {}
        ws_hist.write(row_idx, 17, r22.get("odometer_ft"), default_fmt)
        ws_hist.write(row_idx, 18, r22.get("feature_description", ""), text_fmt)
        ws_hist.write(row_idx, 19, r22.get("depth_pct"), fmt)
        ws_hist.write(row_idx, 20, r22.get("depth_in"), default_fmt)
        ws_hist.write(row_idx, 21, r22.get("clock_position"), default_fmt)
        ws_hist.write(row_idx, 22, r22.get("length_in"), default_fmt)
        ws_hist.write(row_idx, 23, r22.get("width_in"), default_fmt)

        # Match scores
        ws_hist.write(row_idx, 24, entry.get("match_score_07_15"), default_fmt)
        ws_hist.write(row_idx, 25, entry.get("match_score_15_22"), default_fmt)

        # Growth data
        g07_15 = entry.get("growth_07_15") or {}
        g15_22 = entry.get("growth_15_22") or {}
        g07_22 = entry.get("growth_07_22") or {}

        ws_hist.write(row_idx, 26, g07_15.get("depth_growth_pct"), default_fmt)
        ws_hist.write(row_idx, 27, g15_22.get("depth_growth_pct"), default_fmt)
        ws_hist.write(row_idx, 28, g07_22.get("depth_growth_pct"), default_fmt)
        ws_hist.write(row_idx, 29, g07_15.get("annual_growth_rate_pct"), default_fmt)
        ws_hist.write(row_idx, 30, g15_22.get("annual_growth_rate_pct"), default_fmt)
        ws_hist.write(row_idx, 31, g07_22.get("annual_growth_rate_pct"), default_fmt)

        # Length growth rates
        ws_hist.write(row_idx, 32, g07_15.get("annual_length_growth_in"), default_fmt)
        ws_hist.write(row_idx, 33, g15_22.get("annual_length_growth_in"), default_fmt)
        ws_hist.write(row_idx, 34, g07_22.get("annual_length_growth_in"), default_fmt)

        # Width growth rates
        ws_hist.write(row_idx, 35, g07_15.get("annual_width_growth_in"), default_fmt)
        ws_hist.write(row_idx, 36, g15_22.get("annual_width_growth_in"), default_fmt)
        ws_hist.write(row_idx, 37, g07_22.get("annual_width_growth_in"), default_fmt)

        ttc = g15_22.get("time_to_critical_years") or g07_22.get("time_to_critical_years")
        ws_hist.write(row_idx, 38, ttc, default_fmt)

    ws_hist.set_column(0, 2, 12)
    ws_hist.set_column(3, 23, 14)
    ws_hist.set_column(24, 38, 16)
    ws_hist.autofilter(0, 0, len(matched_table), len(hist_headers) - 1)

    # --- Girth Weld Alignment Sheet ---
    ws_gw = wb.add_worksheet("Girth Weld Alignment")
    gw_data = alignment_result.get("girth_weld_alignment", [])
    gw_headers = ["GW Index", "Baseline 2007 (ft)", "Shift (ft)"]
    # Add run columns dynamically
    run_cols = set()
    for gw in gw_data:
        for k in gw:
            if k.startswith("run_"):
                run_cols.add(k)
    run_cols = sorted(run_cols)
    gw_headers_full = ["GW Index", "Baseline 2007 (ft)"] + [c.replace("_", " ").title() for c in run_cols] + ["Shift (ft)"]

    for c, h in enumerate(gw_headers_full):
        ws_gw.write(0, c, h, header_fmt)

    for row_idx, gw in enumerate(gw_data, 1):
        ws_gw.write(row_idx, 0, gw.get("gw_index", ""), int_fmt)
        ws_gw.write(row_idx, 1, gw.get("baseline_ft"), default_fmt)
        for ci, rc in enumerate(run_cols):
            ws_gw.write(row_idx, 2 + ci, gw.get(rc), default_fmt)
        ws_gw.write(row_idx, 2 + len(run_cols), gw.get("shift_ft"), default_fmt)

    ws_gw.set_column(0, 0, 10)
    ws_gw.set_column(1, 3 + len(run_cols), 18)

    wb.close()
    output.seek(0)
    return output.read()
