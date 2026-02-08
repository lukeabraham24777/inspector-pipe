"""Growth rate calculations and time-to-critical analysis."""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


def compute_depth_growth(
    depth_a_pct: Optional[float],
    depth_b_pct: Optional[float],
    wt_a: Optional[float],
    wt_b: Optional[float],
    year_a: int,
    year_b: int,
) -> dict:
    """Compute depth growth between two matched anomalies.

    Returns dict with absolute growth (inches & %), annual growth rate,
    and time-to-critical estimate.
    """
    result = {
        "depth_growth_pct": None,
        "depth_growth_in": None,
        "annual_growth_rate_pct": None,
        "annual_growth_rate_in": None,
        "time_to_critical_years": None,
    }

    if depth_a_pct is None or depth_b_pct is None:
        return result
    if year_a >= year_b:
        return result

    years = year_b - year_a

    # Absolute depth growth in %WT
    growth_pct = depth_b_pct - depth_a_pct
    result["depth_growth_pct"] = round(float(growth_pct), 2)

    # Annual growth rate in %WT/year
    annual_pct = growth_pct / years
    result["annual_growth_rate_pct"] = round(float(annual_pct), 4)

    # Depth growth in inches (use wall thickness from the later run if available)
    wt = wt_b if wt_b is not None else wt_a
    if wt is not None and wt > 0:
        depth_a_in = depth_a_pct / 100.0 * wt
        depth_b_in = depth_b_pct / 100.0 * wt
        growth_in = depth_b_in - depth_a_in
        result["depth_growth_in"] = round(float(growth_in), 4)
        result["annual_growth_rate_in"] = round(float(growth_in / years), 4)

        # Time-to-critical: years until 80% wall loss at current growth rate
        if annual_pct > 0 and depth_b_pct < 80.0:
            remaining_pct = 80.0 - depth_b_pct
            ttc = remaining_pct / annual_pct
            result["time_to_critical_years"] = round(float(ttc), 1)

    return result


def compute_dimension_growth(
    length_a: Optional[float],
    length_b: Optional[float],
    width_a: Optional[float],
    width_b: Optional[float],
    year_a: int,
    year_b: int,
) -> dict:
    """Compute length and width growth between two matched anomalies.

    Returns dict with absolute growth (inches) and annual growth rates.
    """
    result = {
        "length_growth_in": None,
        "width_growth_in": None,
        "annual_length_growth_in": None,
        "annual_width_growth_in": None,
    }

    if year_a >= year_b:
        return result

    years = year_b - year_a

    if length_a is not None and length_b is not None:
        lg = length_b - length_a
        result["length_growth_in"] = round(float(lg), 4)
        result["annual_length_growth_in"] = round(float(lg / years), 4)

    if width_a is not None and width_b is not None:
        wg = width_b - width_a
        result["width_growth_in"] = round(float(wg), 4)
        result["annual_width_growth_in"] = round(float(wg / years), 4)

    return result


def classify_growth_rate(annual_growth_pct: Optional[float]) -> str:
    """Classify annual growth rate into severity category.

    Returns: 'critical' (>10%), 'moderate' (5-10%), 'low' (<5%), 'unknown'.
    """
    if annual_growth_pct is None:
        return "unknown"
    if annual_growth_pct > 10.0:
        return "critical"
    if annual_growth_pct > 5.0:
        return "moderate"
    return "low"


def build_matched_anomaly_table(alignment_result: dict) -> list[dict]:
    """Build the final matched anomaly table with growth calculations.

    Consolidates matches from all run pairs into a unified lineage table.
    """
    anomalies = alignment_result["anomalies"]
    matches_07_15 = alignment_result["matches_07_15"]
    matches_15_22 = alignment_result["matches_15_22"]
    matches_07_22 = alignment_result["matches_07_22"]

    # Track which anomalies have been matched
    matched_07 = set()
    matched_15 = set()
    matched_22 = set()

    # Build 07->15 match index
    map_07_to_15 = {}
    for m in matches_07_15:
        if m["accepted"]:
            map_07_to_15[m["idx_a"]] = m
            matched_07.add(m["idx_a"])
            matched_15.add(m["idx_b"])

    # Build 15->22 match index
    map_15_to_22 = {}
    for m in matches_15_22:
        if m["accepted"]:
            map_15_to_22[m["idx_a"]] = m
            matched_15.add(m["idx_a"])
            matched_22.add(m["idx_b"])

    # Build 07->22 match index (for direct linking)
    map_07_to_22 = {}
    for m in matches_07_22:
        if m["accepted"]:
            map_07_to_22[m["idx_a"]] = m

    results = []

    def _row_to_dict(df: pd.DataFrame, idx: int, year: int) -> dict:
        row = df.iloc[idx]
        return {
            "feature_id": f"{year}-{idx:04d}",
            "odometer_ft": _safe_float(row.get("odometer_ft")),
            "corrected_odometer_ft": _safe_float(row.get("corrected_odometer_ft")),
            "feature_description": str(row.get("feature_description", "")),
            "depth_pct": _safe_float(row.get("depth_pct")),
            "depth_in": _safe_float(row.get("depth_in")),
            "wall_thickness_in": _safe_float(row.get("wall_thickness_in")),
            "length_in": _safe_float(row.get("length_in")),
            "width_in": _safe_float(row.get("width_in")),
            "clock_position": _safe_float(row.get("clock_position")),
            "joint_number": _safe_float(row.get("joint_number")),
            "erf": _safe_float(row.get("erf")),
            "rpr": _safe_float(row.get("rpr")),
            "comments": str(row.get("comments", "")) if pd.notna(row.get("comments")) else "",
        }

    # Trace lineage: start from 2007 anomalies
    if 2007 in anomalies:
        df07 = anomalies[2007]
        df15 = anomalies.get(2015)
        df22 = anomalies.get(2022)

        for i07 in range(len(df07)):
            entry = {
                "status": "matched",
                "run_2007": _row_to_dict(df07, i07, 2007),
                "run_2015": None,
                "run_2022": None,
                "match_score_07_15": None,
                "match_score_15_22": None,
                "match_score_07_22": None,
                "growth_07_15": None,
                "growth_15_22": None,
                "growth_07_22": None,
                "severity": "unknown",
            }

            # Link to 2015
            if i07 in map_07_to_15 and df15 is not None:
                m15 = map_07_to_15[i07]
                i15 = m15["idx_b"]
                entry["run_2015"] = _row_to_dict(df15, i15, 2015)
                entry["match_score_07_15"] = _safe_float(m15["match_score"])

                # Growth 07->15
                entry["growth_07_15"] = compute_depth_growth(
                    entry["run_2007"]["depth_pct"],
                    entry["run_2015"]["depth_pct"],
                    entry["run_2007"]["wall_thickness_in"],
                    entry["run_2015"]["wall_thickness_in"],
                    2007, 2015,
                )
                entry["growth_07_15"].update(compute_dimension_growth(
                    entry["run_2007"]["length_in"],
                    entry["run_2015"]["length_in"],
                    entry["run_2007"]["width_in"],
                    entry["run_2015"]["width_in"],
                    2007, 2015,
                ))

                # Link to 2022 through 2015
                if i15 in map_15_to_22 and df22 is not None:
                    m22 = map_15_to_22[i15]
                    i22 = m22["idx_b"]
                    entry["run_2022"] = _row_to_dict(df22, i22, 2022)
                    entry["match_score_15_22"] = _safe_float(m22["match_score"])
                    matched_22.add(i22)

                    # Growth 15->22
                    entry["growth_15_22"] = compute_depth_growth(
                        entry["run_2015"]["depth_pct"],
                        entry["run_2022"]["depth_pct"],
                        entry["run_2015"]["wall_thickness_in"],
                        entry["run_2022"]["wall_thickness_in"],
                        2015, 2022,
                    )
                    entry["growth_15_22"].update(compute_dimension_growth(
                        entry["run_2015"]["length_in"],
                        entry["run_2022"]["length_in"],
                        entry["run_2015"]["width_in"],
                        entry["run_2022"]["width_in"],
                        2015, 2022,
                    ))

                    # Growth 07->22
                    entry["growth_07_22"] = compute_depth_growth(
                        entry["run_2007"]["depth_pct"],
                        entry["run_2022"]["depth_pct"],
                        entry["run_2007"]["wall_thickness_in"],
                        entry["run_2022"]["wall_thickness_in"],
                        2007, 2022,
                    )
                    entry["growth_07_22"].update(compute_dimension_growth(
                        entry["run_2007"]["length_in"],
                        entry["run_2022"]["length_in"],
                        entry["run_2007"]["width_in"],
                        entry["run_2022"]["width_in"],
                        2007, 2022,
                    ))

            elif i07 in map_07_to_22 and df22 is not None:
                # Direct 07->22 link (no 2015 match)
                m22 = map_07_to_22[i07]
                i22 = m22["idx_b"]
                entry["run_2022"] = _row_to_dict(df22, i22, 2022)
                entry["match_score_07_22"] = _safe_float(m22["match_score"])
                matched_22.add(i22)

                entry["growth_07_22"] = compute_depth_growth(
                    entry["run_2007"]["depth_pct"],
                    entry["run_2022"]["depth_pct"],
                    entry["run_2007"]["wall_thickness_in"],
                    entry["run_2022"]["wall_thickness_in"],
                    2007, 2022,
                )
                entry["growth_07_22"].update(compute_dimension_growth(
                    entry["run_2007"]["length_in"],
                    entry["run_2022"]["length_in"],
                    entry["run_2007"]["width_in"],
                    entry["run_2022"]["width_in"],
                    2007, 2022,
                ))

            # Determine severity from latest growth rate
            latest_growth = (
                entry.get("growth_15_22") or
                entry.get("growth_07_22") or
                entry.get("growth_07_15")
            )
            if latest_growth and latest_growth.get("annual_growth_rate_pct") is not None:
                entry["severity"] = classify_growth_rate(latest_growth["annual_growth_rate_pct"])

            if entry["run_2015"] is None and entry["run_2022"] is None:
                entry["status"] = "missing"

            results.append(entry)
            matched_07.add(i07)

    # Add unmatched 2015 anomalies
    if 2015 in anomalies:
        df15 = anomalies[2015]
        df22 = anomalies.get(2022)
        for i15 in range(len(df15)):
            if i15 in matched_15:
                continue
            entry = {
                "status": "new_2015",
                "run_2007": None,
                "run_2015": _row_to_dict(df15, i15, 2015),
                "run_2022": None,
                "match_score_07_15": None,
                "match_score_15_22": None,
                "match_score_07_22": None,
                "growth_07_15": None,
                "growth_15_22": None,
                "growth_07_22": None,
                "severity": "unknown",
            }
            # Check if it links to 2022
            if i15 in map_15_to_22 and df22 is not None:
                m22 = map_15_to_22[i15]
                i22 = m22["idx_b"]
                entry["run_2022"] = _row_to_dict(df22, i22, 2022)
                entry["match_score_15_22"] = _safe_float(m22["match_score"])
                matched_22.add(i22)
                entry["growth_15_22"] = compute_depth_growth(
                    entry["run_2015"]["depth_pct"],
                    entry["run_2022"]["depth_pct"],
                    entry["run_2015"]["wall_thickness_in"],
                    entry["run_2022"]["wall_thickness_in"],
                    2015, 2022,
                )
                entry["growth_15_22"].update(compute_dimension_growth(
                    entry["run_2015"]["length_in"],
                    entry["run_2022"]["length_in"],
                    entry["run_2015"]["width_in"],
                    entry["run_2022"]["width_in"],
                    2015, 2022,
                ))
                if entry["growth_15_22"] and entry["growth_15_22"].get("annual_growth_rate_pct") is not None:
                    entry["severity"] = classify_growth_rate(entry["growth_15_22"]["annual_growth_rate_pct"])
            results.append(entry)
            matched_15.add(i15)

    # Add unmatched 2022 anomalies (truly new)
    if 2022 in anomalies:
        df22 = anomalies[2022]
        for i22 in range(len(df22)):
            if i22 in matched_22:
                continue
            entry = {
                "status": "new_2022",
                "run_2007": None,
                "run_2015": None,
                "run_2022": _row_to_dict(df22, i22, 2022),
                "match_score_07_15": None,
                "match_score_15_22": None,
                "match_score_07_22": None,
                "growth_07_15": None,
                "growth_15_22": None,
                "growth_07_22": None,
                "severity": "unknown",
            }
            results.append(entry)

    return results


def _safe_float(val) -> Optional[float]:
    """Safely convert to float, handling NaN and None."""
    if val is None:
        return None
    try:
        f = float(val)
        if np.isnan(f):
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None
