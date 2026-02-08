"""Schema normalization for heterogeneous ILI data across 2007, 2015, 2022 runs."""
from __future__ import annotations

import datetime
import re
from typing import Optional

import numpy as np
import pandas as pd

# Header mapping: source column names -> canonical names
HEADER_MAP_2007 = {
    "J. no.": "joint_number",
    "J. len [ft]": "joint_length_ft",
    "t [in]": "wall_thickness_in",
    "to u/s w. [ft]": "dist_to_us_weld_ft",
    "log dist. [ft]": "odometer_ft",
    "event": "feature_description",
    "depth [%]": "depth_pct",
    "length [in]": "length_in",
    "width [in]": "width_in",
    "o'clock": "clock_raw",
    "comment": "comments",
    "P2 Burst / MOP": "burst_mop_ratio",
    "internal": "id_od_raw",
    "ID Reduction [%]": "id_reduction_pct",
    "Height [ft]": "height_ft",
}

HEADER_MAP_2015 = {
    "J. no.": "joint_number",
    "J. len [ft]": "joint_length_ft",
    "Wt [in]": "wall_thickness_in",
    "to u/s w. [ft]": "dist_to_us_weld_ft",
    "to d/s w. [ft]": "dist_to_ds_weld_ft",
    "Log Dist. [ft]": "odometer_ft",
    "Event Description": "feature_description",
    "ID/OD": "id_od",
    "Depth [%]": "depth_pct",
    "Depth [in]": "depth_in",
    "Length [in]": "length_in",
    "Width [in]": "width_in",
    "O'clock": "clock_raw",
    "Comments": "comments",
    "ERF": "erf",
    "RPR": "rpr",
    "B31G Psafe [PSI]": "b31g_psafe",
    "B31G Pburst [PSI]": "b31g_pburst",
    "Mod B31G Psafe [PSI]": "mod_b31g_psafe",
    "Mod B31G Pburst [PSI]": "mod_b31g_pburst",
    "Effective Area Psafe [PSI]": "eff_area_psafe",
    "Effective Area Pburst [PSI]": "eff_area_pburst",
    "OD Reduction [%]": "od_reduction_pct",
    "OD Reduction [in]": "od_reduction_in",
    "Tool Velocity [ft/s]": "tool_velocity",
    "Elevation [ft]": "elevation_ft",
    "MOP [PSI]": "mop_psi",
    "SMYS [PSI]": "smys_psi",
    "Anomalies per Joint": "anomalies_per_joint",
}

HEADER_MAP_2022 = {
    "Joint Number": "joint_number",
    "Joint Length [ft]": "joint_length_ft",
    "WT [in]": "wall_thickness_in",
    "Distance to U/S GW [ft]": "dist_to_us_weld_ft",
    "Distance to D/S GW [ft]": "dist_to_ds_weld_ft",
    "ILI Wheel Count [ft.]": "odometer_ft",
    "Event Description": "feature_description",
    "ID/OD": "id_od",
    "Metal Loss Depth [%]": "depth_pct",
    "Metal Loss Depth [in]": "depth_in",
    "Length [in]": "length_in",
    "Width [in]": "width_in",
    "O'clock [hh:mm]": "clock_raw",
    "Comments": "comments",
    "ERF": "erf",
    "RPR": "rpr",
    "Mod B31G Psafe [PSI]": "mod_b31g_psafe",
    "Mod B31G Pburst [PSI]": "mod_b31g_pburst",
    "Effective Area Psafe [PSI]": "eff_area_psafe",
    "Effective Area Pburst [PSI]": "eff_area_pburst",
    "Dent Depth [%]": "dent_depth_pct",
    "Dent Depth [in]": "dent_depth_in",
    "Elevation [ft]": "elevation_ft",
    "SMYS [PSI]": "smys_psi",
    "Evaluation Pressure [PSI]": "eval_pressure_psi",
    "Pipe Diameter (O.D.) [in.]": "pipe_od_in",
    "Anomalies per Joint": "anomalies_per_joint",
    "Metal Loss Depth + Tolerance [%]": "depth_plus_tolerance_pct",
    "Metal Loss Depth Tolerance [%]": "depth_tolerance_pct",
    "Dimension Classification": "dimension_class",
}

GIRTH_WELD_PATTERNS = re.compile(
    r"^(girth\s*weld|girthweld|gw)$", re.IGNORECASE
)

ANOMALY_PATTERNS = re.compile(
    r"(metal\s*loss|corrosion|cluster|dent|crack|seam\s*weld\s*anomaly)",
    re.IGNORECASE,
)


def clock_to_decimal(value) -> Optional[float]:
    """Convert clock position to 0.0-12.0 decimal float.

    Handles: datetime.time, strings like '3:30', '09:04:00', numeric values.
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None

    if isinstance(value, datetime.time):
        h = value.hour
        m = value.minute
        decimal = h + m / 60.0
        if decimal > 12.0:
            decimal = decimal % 12.0
        return round(decimal, 2) if decimal > 0 else 12.0

    if isinstance(value, (int, float)):
        v = float(value)
        if 0 < v <= 12:
            return round(v, 2)
        if v > 12:
            return round(v % 12.0 or 12.0, 2)
        return None

    if isinstance(value, str):
        value = value.strip()
        parts = re.split(r"[:.]", value)
        try:
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            decimal = h + m / 60.0
            if decimal > 12.0:
                decimal = decimal % 12.0
            return round(decimal, 2) if decimal > 0 else 12.0
        except (ValueError, IndexError):
            return None

    return None


def clock_distance(a: float, b: float) -> float:
    """Circular distance between two clock positions (0-12 scale)."""
    diff = abs(a - b)
    return min(diff, 12.0 - diff)


def is_girth_weld(description: Optional[str]) -> bool:
    """Check if a feature description indicates a girth weld."""
    if not description or not isinstance(description, str):
        return False
    return bool(GIRTH_WELD_PATTERNS.match(description.strip()))


def is_anomaly(description: Optional[str]) -> bool:
    """Check if a feature is an anomaly (metal loss, dent, etc.)."""
    if not description or not isinstance(description, str):
        return False
    return bool(ANOMALY_PATTERNS.search(description.strip()))


def normalize_sheet(df: pd.DataFrame, year: int) -> pd.DataFrame:
    """Normalize a single year's sheet to canonical schema."""
    # Collapse whitespace/newlines in column names for consistent matching
    df.columns = [re.sub(r"\s+", " ", col).strip() for col in df.columns]

    header_map = {2007: HEADER_MAP_2007, 2015: HEADER_MAP_2015, 2022: HEADER_MAP_2022}[year]

    # Rename columns that exist
    rename = {k: v for k, v in header_map.items() if k in df.columns}
    df = df.rename(columns=rename)

    # Add year
    df["run_year"] = year

    # Normalize clock positions
    if "clock_raw" in df.columns:
        df["clock_position"] = df["clock_raw"].apply(clock_to_decimal)
    else:
        df["clock_position"] = None

    # Classify features
    df["is_girth_weld"] = df["feature_description"].apply(is_girth_weld)
    df["is_anomaly"] = df["feature_description"].apply(is_anomaly)

    # Compute depth_in for 2007 where it's missing
    if "depth_in" not in df.columns and "depth_pct" in df.columns and "wall_thickness_in" in df.columns:
        df["depth_in"] = df.apply(
            lambda r: round(r["depth_pct"] / 100.0 * r["wall_thickness_in"], 4)
            if pd.notna(r.get("depth_pct")) and pd.notna(r.get("wall_thickness_in"))
            else None,
            axis=1,
        )

    # Map 2007 internal column to id_od
    if "id_od_raw" in df.columns and "id_od" not in df.columns:
        df["id_od"] = df["id_od_raw"].apply(
            lambda x: "ID" if x and str(x).strip().upper() in ("I", "ID", "INTERNAL", "YES", "TRUE")
            else "OD" if x and str(x).strip().upper() in ("O", "OD", "EXTERNAL", "NO", "FALSE")
            else None
        )

    # Store original index
    df["original_index"] = df.index

    # Initialize corrected odometer
    df["corrected_odometer_ft"] = df.get("odometer_ft", pd.Series(dtype=float))

    # Ensure all canonical columns exist
    for col in [
        "joint_number", "joint_length_ft", "wall_thickness_in",
        "dist_to_us_weld_ft", "dist_to_ds_weld_ft", "odometer_ft",
        "feature_description", "id_od", "depth_pct", "depth_in",
        "length_in", "width_in", "clock_position", "comments",
        "erf", "rpr", "mod_b31g_psafe", "mod_b31g_pburst",
        "eff_area_psafe", "eff_area_pburst", "is_girth_weld",
        "is_anomaly", "run_year", "original_index", "corrected_odometer_ft",
    ]:
        if col not in df.columns:
            df[col] = None

    return df


def ingest_excel(file_path: str) -> dict[int, pd.DataFrame]:
    """Read Pipeline_Data.xlsx and normalize all run sheets."""
    sheets = {}
    xls = pd.ExcelFile(file_path, engine="openpyxl")
    try:
        for sheet_name in xls.sheet_names:
            if sheet_name in ("2007", "2015", "2022"):
                year = int(sheet_name)
                df = pd.read_excel(xls, sheet_name=sheet_name)
                sheets[year] = normalize_sheet(df, year)
    finally:
        xls.close()
    return sheets
