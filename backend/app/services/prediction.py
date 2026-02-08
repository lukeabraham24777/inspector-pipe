"""KDE-based corrosion prediction and risk forecasting."""
from __future__ import annotations

from typing import Optional

import numpy as np
from scipy.stats import gaussian_kde


def compute_corrosion_prediction(
    matched_table: list[dict],
    pipeline_length_ft: Optional[float] = None,
    eval_spacing_ft: float = 100.0,
) -> dict:
    """Compute corrosion risk forecast using KDE on new anomaly emergence
    locations and growth rate extrapolation.

    Approach:
    1. KDE on positions of new_2015 and new_2022 anomalies → emergence density
    2. Growth-rate extrapolation → project depth forward to 5/10/15/20 years
    3. Composite risk = 0.4*emergence + 0.3*avg_growth + 0.3*critical_projection

    Returns dict with positions, density curves, critical counts, composite risk,
    and high-risk zone annotations.
    """
    # Collect positions and data for different categories
    new_positions = []  # positions of new_2015 and new_2022 anomalies
    growth_data = []    # (position, annual_rate_pct, current_depth_pct) for matched

    all_positions = []

    for entry in matched_table:
        run = entry.get("run_2022") or entry.get("run_2015") or entry.get("run_2007")
        if run is None:
            continue
        odo = run.get("corrected_odometer_ft") or run.get("odometer_ft")
        if odo is None:
            continue

        all_positions.append(float(odo))

        # Collect new anomaly positions
        if entry["status"] in ("new_2015", "new_2022"):
            new_positions.append(float(odo))

        # Collect growth data from matched anomalies
        if entry["status"] == "matched":
            latest_growth = (
                entry.get("growth_15_22") or
                entry.get("growth_07_22") or
                entry.get("growth_07_15")
            )
            if latest_growth and latest_growth.get("annual_growth_rate_pct") is not None:
                depth = run.get("depth_pct") or 0
                growth_data.append((
                    float(odo),
                    float(latest_growth["annual_growth_rate_pct"]),
                    float(depth),
                ))

    if not all_positions:
        return _empty_result()

    # Determine evaluation grid
    min_pos = min(all_positions)
    max_pos = max(all_positions)
    if pipeline_length_ft is not None:
        max_pos = max(max_pos, pipeline_length_ft)

    eval_points = np.arange(min_pos, max_pos + eval_spacing_ft, eval_spacing_ft)
    n_eval = len(eval_points)

    # --- Component 1: New anomaly emergence density (KDE) ---
    if len(new_positions) >= 3:
        kde = gaussian_kde(new_positions, bw_method="silverman")
        density = kde(eval_points)
        # Normalize to 0-1
        d_max = density.max()
        if d_max > 0:
            density = density / d_max
        else:
            density = np.zeros(n_eval)
    elif len(new_positions) > 0:
        # Too few points for KDE, use simple proximity
        new_arr = np.array(new_positions)
        density = np.zeros(n_eval)
        for np_pos in new_arr:
            density += np.exp(-0.5 * ((eval_points - np_pos) / 500.0) ** 2)
        d_max = density.max()
        if d_max > 0:
            density = density / d_max
    else:
        density = np.zeros(n_eval)

    # --- Component 2: Average local growth rate ---
    avg_growth = np.zeros(n_eval)
    if growth_data:
        gd = np.array(growth_data)  # (N, 3): pos, rate, depth
        gd_pos = gd[:, 0]
        gd_rate = gd[:, 1]

        # Rolling window average: for each eval point, average rates within ±500ft
        window = 500.0
        for i, ep in enumerate(eval_points):
            mask = np.abs(gd_pos - ep) <= window
            if mask.any():
                avg_growth[i] = np.mean(gd_rate[mask])

        # Normalize to 0-1
        ag_max = avg_growth.max()
        if ag_max > 0:
            avg_growth_norm = avg_growth / ag_max
        else:
            avg_growth_norm = np.zeros(n_eval)
    else:
        avg_growth_norm = np.zeros(n_eval)

    # --- Component 3: Critical count projections ---
    horizons = [5, 10, 15, 20]
    critical_counts = {h: np.zeros(n_eval, dtype=int) for h in horizons}

    if growth_data:
        gd = np.array(growth_data)
        gd_pos = gd[:, 0]
        gd_rate = gd[:, 1]
        gd_depth = gd[:, 2]

        window = 500.0
        for h in horizons:
            projected_depth = gd_depth + gd_rate * h
            will_be_critical = projected_depth >= 80.0

            for i, ep in enumerate(eval_points):
                mask = (np.abs(gd_pos - ep) <= window) & will_be_critical
                critical_counts[h][i] = int(mask.sum())

    # --- Composite risk score ---
    # Normalize critical counts for the 20-year horizon
    cc20 = critical_counts[20].astype(float)
    cc_max = cc20.max()
    cc_norm = cc20 / cc_max if cc_max > 0 else np.zeros(n_eval)

    composite = 0.4 * density + 0.3 * avg_growth_norm + 0.3 * cc_norm
    # Normalize to 0-1
    c_max = composite.max()
    if c_max > 0:
        composite = composite / c_max

    # --- Identify high-risk zones ---
    risk_threshold = 0.6
    high_risk_zones = []
    in_zone = False
    zone_start = None

    for i, score in enumerate(composite):
        if score >= risk_threshold and not in_zone:
            in_zone = True
            zone_start = i
        elif score < risk_threshold and in_zone:
            in_zone = False
            zone_risk = float(np.max(composite[zone_start:i]))
            high_risk_zones.append({
                "start_ft": round(float(eval_points[zone_start]), 1),
                "end_ft": round(float(eval_points[i - 1]), 1),
                "risk_score": round(zone_risk, 3),
            })
    # Handle zone that extends to end
    if in_zone:
        zone_risk = float(np.max(composite[zone_start:]))
        high_risk_zones.append({
            "start_ft": round(float(eval_points[zone_start]), 1),
            "end_ft": round(float(eval_points[-1]), 1),
            "risk_score": round(zone_risk, 3),
        })

    return {
        "positions_ft": [round(float(x), 1) for x in eval_points],
        "new_anomaly_density": [round(float(x), 4) for x in density],
        "avg_growth_rate": [round(float(x), 4) for x in avg_growth],
        "avg_growth_rate_norm": [round(float(x), 4) for x in avg_growth_norm],
        "critical_count_5yr": [int(x) for x in critical_counts[5]],
        "critical_count_10yr": [int(x) for x in critical_counts[10]],
        "critical_count_15yr": [int(x) for x in critical_counts[15]],
        "critical_count_20yr": [int(x) for x in critical_counts[20]],
        "composite_risk_score": [round(float(x), 4) for x in composite],
        "high_risk_zones": high_risk_zones,
    }


def _empty_result() -> dict:
    """Return an empty prediction result."""
    return {
        "positions_ft": [],
        "new_anomaly_density": [],
        "avg_growth_rate": [],
        "avg_growth_rate_norm": [],
        "critical_count_5yr": [],
        "critical_count_10yr": [],
        "critical_count_15yr": [],
        "critical_count_20yr": [],
        "composite_risk_score": [],
        "high_risk_zones": [],
    }
