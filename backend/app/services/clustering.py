"""Anomaly spatial density clustering along the pipeline."""
from __future__ import annotations

from typing import Optional

import numpy as np


def compute_anomaly_clusters(
    matched_table: list[dict],
    bin_size_ft: float = 200.0,
) -> dict:
    """Segment-based density analysis for anomaly clustering.

    Divides the pipeline into bins and identifies contiguous 'hot' bins
    (above 2x mean density) as clusters.

    Returns:
        dict with bin_centers_ft, anomaly_counts, mean_density, threshold,
        and a list of cluster zones.
    """
    # Collect all anomaly positions (prefer corrected, fallback to raw)
    positions = []
    depths = []
    severities = []

    for entry in matched_table:
        # Use the latest available run
        run = entry.get("run_2022") or entry.get("run_2015") or entry.get("run_2007")
        if run is None:
            continue
        odo = run.get("corrected_odometer_ft") or run.get("odometer_ft")
        if odo is None:
            continue
        positions.append(float(odo))
        depths.append(float(run.get("depth_pct") or 0))
        severities.append(entry.get("severity", "unknown"))

    if not positions:
        return {
            "bin_centers_ft": [],
            "anomaly_counts": [],
            "mean_density": 0,
            "threshold": 0,
            "clusters": [],
        }

    positions = np.array(positions)
    depths = np.array(depths)

    # Create bins along the pipeline
    min_pos = float(np.floor(positions.min() / bin_size_ft) * bin_size_ft)
    max_pos = float(np.ceil(positions.max() / bin_size_ft) * bin_size_ft)
    bin_edges = np.arange(min_pos, max_pos + bin_size_ft, bin_size_ft)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    # Count anomalies per bin
    counts, _ = np.histogram(positions, bins=bin_edges)
    counts = counts.astype(int)

    mean_density = float(np.mean(counts)) if len(counts) > 0 else 0
    threshold = 2.0 * mean_density

    # Find contiguous hot zones (bins above threshold)
    hot_mask = counts >= threshold
    clusters = []
    cluster_id = 0
    i = 0
    n_bins = len(counts)

    while i < n_bins:
        if hot_mask[i]:
            start_idx = i
            while i < n_bins and hot_mask[i]:
                i += 1
            end_idx = i - 1

            # Cluster spans from start of first hot bin to end of last hot bin
            cluster_start = float(bin_edges[start_idx])
            cluster_end = float(bin_edges[end_idx + 1])
            cluster_count = int(np.sum(counts[start_idx:end_idx + 1]))

            # Find anomalies in this cluster range
            mask = (positions >= cluster_start) & (positions < cluster_end)
            cluster_depths = depths[mask]
            cluster_sevs = [severities[j] for j in range(len(severities)) if mask[j]]

            # Dominant severity
            sev_counts = {}
            for s in cluster_sevs:
                sev_counts[s] = sev_counts.get(s, 0) + 1
            dominant_sev = max(sev_counts, key=sev_counts.get) if sev_counts else "unknown"

            avg_depth = float(np.mean(cluster_depths)) if len(cluster_depths) > 0 else 0

            clusters.append({
                "id": cluster_id,
                "start_ft": round(cluster_start, 1),
                "end_ft": round(cluster_end, 1),
                "anomaly_count": cluster_count,
                "dominant_severity": dominant_sev,
                "avg_depth_pct": round(avg_depth, 1),
            })
            cluster_id += 1
        else:
            i += 1

    return {
        "bin_centers_ft": [round(float(x), 1) for x in bin_centers],
        "anomaly_counts": [int(x) for x in counts],
        "mean_density": round(mean_density, 2),
        "threshold": round(threshold, 2),
        "clusters": clusters,
    }
