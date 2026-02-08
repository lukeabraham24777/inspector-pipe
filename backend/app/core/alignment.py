"""Global alignment via piecewise linear on girth welds + local anomaly matching via Hungarian Algorithm."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from scipy.interpolate import interp1d

from .normalizer import clock_distance


def extract_girth_weld_positions(df: pd.DataFrame) -> np.ndarray:
    """Extract sorted odometer positions of girth welds."""
    gw = df[df["is_girth_weld"] == True].copy()  # noqa: E712
    positions = pd.to_numeric(gw["odometer_ft"], errors="coerce").dropna().sort_values().values
    return positions.astype(np.float64)


def piecewise_linear_correction(
    baseline_gw: np.ndarray,
    target_gw: np.ndarray,
    target_df: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict]]:
    """Align target run to baseline using piecewise linear interpolation on girth welds."""
    n = min(len(baseline_gw), len(target_gw))
    if n < 2:
        target_df["corrected_odometer_ft"] = target_df["odometer_ft"]
        return target_df, []

    base_pts = baseline_gw[:n]
    tgt_pts = target_gw[:n]

    correction_fn = interp1d(
        tgt_pts, base_pts,
        kind="linear",
        fill_value="extrapolate",
    )

    odo_vals = pd.to_numeric(target_df["odometer_ft"], errors="coerce").fillna(0).values.astype(np.float64)
    target_df["corrected_odometer_ft"] = correction_fn(odo_vals)

    corrections = [
        {
            "gw_index": int(i),
            "baseline_ft": float(base_pts[i]),
            "target_ft": float(tgt_pts[i]),
            "shift_ft": float(base_pts[i] - tgt_pts[i]),
        }
        for i in range(n)
    ]
    return target_df, corrections


# Feature type classification for vectorized matching
ML_KEYWORDS = {"metal loss", "corrosion", "cluster", "metal loss manufacturing",
               "metal loss manufacturing anomaly"}
DENT_KEYWORDS = {"dent", "seam weld dent"}


def _classify_feature(desc: str) -> int:
    """Classify feature into category: 0=metal_loss, 1=dent, 2=other."""
    if not desc:
        return 2
    d = desc.lower().strip()
    if any(kw in d for kw in ML_KEYWORDS):
        return 0
    if any(kw in d for kw in DENT_KEYWORDS):
        return 1
    return 2


def _feature_cost_vectorized(cats_a: np.ndarray, cats_b: np.ndarray) -> np.ndarray:
    """Build feature similarity matrix from category arrays.

    Same category = 0.0, same group = 0.3, different = 1.0.
    """
    n_a, n_b = len(cats_a), len(cats_b)
    # Broadcast: cats_a[:, None] vs cats_b[None, :]
    a = cats_a[:, None]  # shape (n_a, 1)
    b = cats_b[None, :]  # shape (1, n_b)
    same = (a == b).astype(np.float64)
    # Both metal_loss (cat 0) or both dent (cat 1) but not exact same
    compatible = ((a < 2) & (b < 2) & (a == b)).astype(np.float64)
    # exact match = 0, compatible = 0.3, different = 1.0
    result = np.where(same > 0, 0.0, np.where(compatible > 0, 0.3, 1.0))
    return result


def _local_hungarian_match(
    odo_a: np.ndarray, clk_a: np.ndarray, cat_a: np.ndarray, idx_a: np.ndarray,
    odo_b: np.ndarray, clk_b: np.ndarray, cat_b: np.ndarray, idx_b: np.ndarray,
    max_distance_ft: float, cost_threshold: float,
    w_dist: float = 0.5, w_clock: float = 0.3, w_feat: float = 0.2,
) -> list[dict]:
    """Run Hungarian matching on a local segment of anomalies."""
    n_a = len(odo_a)
    n_b = len(odo_b)
    if n_a == 0 or n_b == 0:
        return []

    # Distance matrix
    dist_matrix = np.abs(odo_a[:, None] - odo_b[None, :])

    # Clock distance matrix (circular)
    clk_diff = np.abs(clk_a[:, None] - clk_b[None, :])
    clock_matrix = np.minimum(clk_diff, 12.0 - clk_diff)

    # Feature cost matrix
    feat_matrix = _feature_cost_vectorized(cat_a, cat_b)

    # Normalize
    max_dist = max(max_distance_ft, 1.0)
    dist_norm = np.clip(dist_matrix / max_dist, 0, 1)
    clock_norm = clock_matrix / 6.0

    cost = w_dist * dist_norm + w_clock * clock_norm + w_feat * feat_matrix
    cost[dist_matrix > max_distance_ft] = 1e6

    row_ind, col_ind = linear_sum_assignment(cost)

    matches = []
    for r, c in zip(row_ind, col_ind):
        score = cost[r, c]
        if score < 1e5:
            match_quality = max(0.0, 1.0 - score)
            matches.append({
                "idx_a": int(idx_a[r]),
                "idx_b": int(idx_b[c]),
                "cost": float(score),
                "match_score": round(float(match_quality), 4),
                "accepted": score <= cost_threshold,
            })

    return matches


def hungarian_match(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    max_distance_ft: float = 50.0,
    cost_threshold: float = 0.8,
) -> list[dict]:
    """Match anomalies using windowed Hungarian Algorithm.

    Splits the pipeline into overlapping windows to keep each sub-problem small.
    """
    if len(df_a) == 0 or len(df_b) == 0:
        return []

    # Prepare arrays
    odo_a = pd.to_numeric(df_a["corrected_odometer_ft"], errors="coerce").fillna(0).values.astype(np.float64)
    odo_b = pd.to_numeric(df_b["corrected_odometer_ft"], errors="coerce").fillna(0).values.astype(np.float64)
    clk_a = pd.to_numeric(df_a["clock_position"], errors="coerce").fillna(6.0).values.astype(np.float64)
    clk_b = pd.to_numeric(df_b["clock_position"], errors="coerce").fillna(6.0).values.astype(np.float64)
    cat_a = np.array([_classify_feature(str(f)) for f in df_a["feature_description"].fillna("").values])
    cat_b = np.array([_classify_feature(str(f)) for f in df_b["feature_description"].fillna("").values])

    # Determine pipeline extent
    min_pos = min(odo_a.min(), odo_b.min()) - 1
    max_pos = max(odo_a.max(), odo_b.max()) + 1

    # Use windows of ~500 ft with 100 ft overlap for continuity
    window_size = 500.0
    step = 400.0
    all_matches = []
    matched_a = set()
    matched_b = set()

    pos = min_pos
    while pos < max_pos:
        win_start = pos
        win_end = pos + window_size

        # Select anomalies in this window
        mask_a = (odo_a >= win_start) & (odo_a < win_end)
        mask_b = (odo_b >= win_start) & (odo_b < win_end)

        local_idx_a = np.where(mask_a)[0]
        local_idx_b = np.where(mask_b)[0]

        # Remove already-matched indices
        local_idx_a = np.array([i for i in local_idx_a if i not in matched_a])
        local_idx_b = np.array([i for i in local_idx_b if i not in matched_b])

        if len(local_idx_a) > 0 and len(local_idx_b) > 0:
            segment_matches = _local_hungarian_match(
                odo_a[local_idx_a], clk_a[local_idx_a], cat_a[local_idx_a], local_idx_a,
                odo_b[local_idx_b], clk_b[local_idx_b], cat_b[local_idx_b], local_idx_b,
                max_distance_ft=max_distance_ft,
                cost_threshold=cost_threshold,
            )
            for m in segment_matches:
                if m["idx_a"] not in matched_a and m["idx_b"] not in matched_b:
                    all_matches.append(m)
                    if m["accepted"]:
                        matched_a.add(m["idx_a"])
                        matched_b.add(m["idx_b"])

        pos += step

    return all_matches


def align_runs(
    sheets: dict[int, pd.DataFrame],
    max_distance_ft: float = 50.0,
    cost_threshold: float = 0.8,
) -> dict:
    """Full alignment pipeline: girth weld correction + anomaly matching."""
    baseline_year = 2007
    baseline_df = sheets[baseline_year]
    baseline_gw = extract_girth_weld_positions(baseline_df)

    girth_weld_alignment = []
    odometer_corrections = {}

    # Step 1: Correct odometer for 2015 and 2022 to 2007 baseline
    for year in (2015, 2022):
        if year not in sheets:
            continue
        target_df = sheets[year]
        target_gw = extract_girth_weld_positions(target_df)
        sheets[year], corrections = piecewise_linear_correction(
            baseline_gw, target_gw, target_df
        )
        odometer_corrections[year] = corrections

        n = min(len(baseline_gw), len(target_gw))
        for i in range(n):
            girth_weld_alignment.append({
                "gw_index": i,
                "baseline_ft": float(baseline_gw[i]),
                f"run_{year}_ft": float(target_gw[i]),
                "shift_ft": round(float(baseline_gw[i] - target_gw[i]), 2),
            })

    # Step 2: Extract anomalies from each run
    anomalies = {}
    for year in (2007, 2015, 2022):
        if year in sheets:
            anomalies[year] = sheets[year][sheets[year]["is_anomaly"] == True].reset_index(drop=True)  # noqa: E712

    # Step 3: Windowed Hungarian matching between consecutive runs
    matches_07_15 = []
    matches_15_22 = []
    matches_07_22 = []

    if 2007 in anomalies and 2015 in anomalies:
        matches_07_15 = hungarian_match(
            anomalies[2007], anomalies[2015],
            max_distance_ft=max_distance_ft,
            cost_threshold=cost_threshold,
        )

    if 2015 in anomalies and 2022 in anomalies:
        matches_15_22 = hungarian_match(
            anomalies[2015], anomalies[2022],
            max_distance_ft=max_distance_ft,
            cost_threshold=cost_threshold,
        )

    if 2007 in anomalies and 2022 in anomalies:
        matches_07_22 = hungarian_match(
            anomalies[2007], anomalies[2022],
            max_distance_ft=max_distance_ft,
            cost_threshold=cost_threshold,
        )

    return {
        "sheets": sheets,
        "anomalies": anomalies,
        "girth_weld_alignment": girth_weld_alignment,
        "odometer_corrections": odometer_corrections,
        "matches_07_15": matches_07_15,
        "matches_15_22": matches_15_22,
        "matches_07_22": matches_07_22,
    }
