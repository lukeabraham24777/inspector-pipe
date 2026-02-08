"""Pydantic schemas for ILI pipeline inspection data."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AnomalyRecord(BaseModel):
    run_year: int
    joint_number: Optional[float] = None
    joint_length_ft: Optional[float] = None
    wall_thickness_in: Optional[float] = None
    dist_to_us_weld_ft: Optional[float] = None
    dist_to_ds_weld_ft: Optional[float] = None
    odometer_ft: Optional[float] = None
    feature_description: Optional[str] = None
    id_od: Optional[str] = None
    depth_pct: Optional[float] = None
    depth_in: Optional[float] = None
    length_in: Optional[float] = None
    width_in: Optional[float] = None
    clock_position: Optional[float] = None  # 0.0-12.0 decimal
    comments: Optional[str] = None
    erf: Optional[float] = None
    rpr: Optional[float] = None
    mod_b31g_psafe: Optional[float] = None
    mod_b31g_pburst: Optional[float] = None
    eff_area_psafe: Optional[float] = None
    eff_area_pburst: Optional[float] = None
    is_girth_weld: bool = False
    is_anomaly: bool = False
    original_index: Optional[int] = None
    corrected_odometer_ft: Optional[float] = None


class MatchedAnomaly(BaseModel):
    anomaly_2007: Optional[AnomalyRecord] = None
    anomaly_2015: Optional[AnomalyRecord] = None
    anomaly_2022: Optional[AnomalyRecord] = None
    match_score_07_15: Optional[float] = None
    match_score_15_22: Optional[float] = None
    match_score_07_22: Optional[float] = None
    depth_growth_pct_07_15: Optional[float] = None
    depth_growth_pct_15_22: Optional[float] = None
    depth_growth_pct_07_22: Optional[float] = None
    annual_growth_rate_07_15: Optional[float] = None
    annual_growth_rate_15_22: Optional[float] = None
    annual_growth_rate_07_22: Optional[float] = None
    time_to_critical_years: Optional[float] = None
    status: str = "matched"  # matched, new, missing


class AlignmentResult(BaseModel):
    total_anomalies_2007: int = 0
    total_anomalies_2015: int = 0
    total_anomalies_2022: int = 0
    total_girth_welds_2007: int = 0
    total_girth_welds_2015: int = 0
    total_girth_welds_2022: int = 0
    matched_count: int = 0
    new_anomalies_count: int = 0
    missing_anomalies_count: int = 0
    avg_match_score: float = 0.0
    max_odometer_shift_ft: float = 0.0
    matched_anomalies: list[MatchedAnomaly] = []
    girth_weld_alignment: list[dict] = []
    odometer_corrections_2015: list[dict] = []
    odometer_corrections_2022: list[dict] = []


class ProcessingStatus(BaseModel):
    status: str = "idle"  # idle, processing, complete, error
    progress: float = 0.0
    message: str = ""
    result: Optional[AlignmentResult] = None
