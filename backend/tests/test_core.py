"""Unit tests for core normalization, alignment, and growth algorithms."""
import datetime

import numpy as np
import pandas as pd
import pytest

from app.core.normalizer import (
    clock_to_decimal,
    clock_distance,
    is_girth_weld,
    is_anomaly,
    normalize_sheet,
)
from app.core.alignment import (
    extract_girth_weld_positions,
    piecewise_linear_correction,
    hungarian_match,
)
from app.services.growth import (
    compute_depth_growth,
    compute_dimension_growth,
    classify_growth_rate,
)


# --- Clock Normalization Tests ---

class TestClockToDecimal:
    def test_datetime_time(self):
        assert clock_to_decimal(datetime.time(3, 0)) == 3.0
        assert clock_to_decimal(datetime.time(9, 30)) == 9.5
        assert clock_to_decimal(datetime.time(12, 0)) == 12.0

    def test_datetime_time_minutes(self):
        assert clock_to_decimal(datetime.time(5, 15)) == 5.25
        assert clock_to_decimal(datetime.time(10, 45)) == 10.75
        assert clock_to_decimal(datetime.time(1, 20)) == pytest.approx(1.33, abs=0.01)

    def test_string_format(self):
        assert clock_to_decimal("3:00") == 3.0
        assert clock_to_decimal("9:30") == 9.5
        assert clock_to_decimal("12:00") == 12.0
        assert clock_to_decimal("6:15") == 6.25

    def test_string_with_seconds(self):
        assert clock_to_decimal("3:00:00") == 3.0
        assert clock_to_decimal("09:04:00") == pytest.approx(9.07, abs=0.01)

    def test_numeric(self):
        assert clock_to_decimal(6) == 6.0
        assert clock_to_decimal(3.5) == 3.5
        assert clock_to_decimal(12.0) == 12.0

    def test_none_and_nan(self):
        assert clock_to_decimal(None) is None
        assert clock_to_decimal(float("nan")) is None

    def test_zero_wraps_to_twelve(self):
        # 0:00 should map to 12:00
        assert clock_to_decimal(datetime.time(0, 0)) == 12.0


class TestClockDistance:
    def test_same_position(self):
        assert clock_distance(3.0, 3.0) == 0.0

    def test_simple_distance(self):
        assert clock_distance(3.0, 5.0) == 2.0

    def test_wraparound(self):
        # 1 o'clock and 11 o'clock are 2 apart, not 10
        assert clock_distance(1.0, 11.0) == 2.0
        assert clock_distance(11.0, 1.0) == 2.0

    def test_opposite(self):
        assert clock_distance(12.0, 6.0) == 6.0
        assert clock_distance(3.0, 9.0) == 6.0

    def test_near_12(self):
        assert clock_distance(11.5, 0.5) == 1.0


# --- Feature Classification Tests ---

class TestFeatureClassification:
    def test_girth_weld_variants(self):
        assert is_girth_weld("Girth Weld") is True
        assert is_girth_weld("GirthWeld") is True
        assert is_girth_weld("girth weld") is True
        assert is_girth_weld("GW") is True
        assert is_girth_weld("gw") is True

    def test_not_girth_weld(self):
        assert is_girth_weld("metal loss") is False
        assert is_girth_weld("Bend") is False
        assert is_girth_weld("Girth Weld Anomaly") is False
        assert is_girth_weld(None) is False
        assert is_girth_weld("") is False

    def test_anomaly_types(self):
        assert is_anomaly("metal loss") is True
        assert is_anomaly("Metal Loss") is True
        assert is_anomaly("metal loss manufacturing anomaly") is True
        assert is_anomaly("Cluster") is True
        assert is_anomaly("Dent") is True

    def test_not_anomaly(self):
        assert is_anomaly("Girth Weld") is False
        assert is_anomaly("Bend") is False
        assert is_anomaly("Valve") is False
        assert is_anomaly(None) is False


# --- Distance Correction Tests ---

class TestOdometerCorrection:
    def test_piecewise_linear(self):
        baseline_gw = np.array([100.0, 200.0, 300.0, 400.0, 500.0])
        target_gw = np.array([102.0, 204.0, 303.0, 406.0, 510.0])

        df = pd.DataFrame({
            "odometer_ft": [150.0, 250.0, 350.0],
            "feature_description": ["metal loss"] * 3,
            "is_girth_weld": [False] * 3,
            "is_anomaly": [True] * 3,
        })

        corrected_df, corrections = piecewise_linear_correction(
            baseline_gw, target_gw, df
        )

        # Corrected values should be closer to baseline coordinate space
        assert len(corrections) == 5
        assert corrections[0]["shift_ft"] == pytest.approx(-2.0, abs=0.1)

        # Point at 150 in target space should map ~149 in baseline space
        corrected = corrected_df["corrected_odometer_ft"].values
        assert corrected[0] < 150.0  # shifted back toward baseline

    def test_girth_weld_extraction(self):
        df = pd.DataFrame({
            "is_girth_weld": [True, False, True, False, True],
            "odometer_ft": [100, 150, 200, 250, 300],
        })
        gw = extract_girth_weld_positions(df)
        assert len(gw) == 3
        np.testing.assert_array_equal(gw, [100, 200, 300])


# --- Matching Tests ---

class TestHungarianMatch:
    def test_perfect_match(self):
        df_a = pd.DataFrame({
            "corrected_odometer_ft": [100.0, 200.0, 300.0],
            "clock_position": [3.0, 6.0, 9.0],
            "feature_description": ["metal loss", "metal loss", "metal loss"],
        })
        df_b = pd.DataFrame({
            "corrected_odometer_ft": [100.5, 200.2, 300.1],
            "clock_position": [3.1, 5.9, 9.05],
            "feature_description": ["metal loss", "metal loss", "metal loss"],
        })

        matches = hungarian_match(df_a, df_b, max_distance_ft=50.0)
        assert len(matches) == 3
        # Each A should match to corresponding B
        for m in matches:
            assert m["idx_a"] == m["idx_b"]
            assert m["match_score"] > 0.9

    def test_no_match_far_apart(self):
        df_a = pd.DataFrame({
            "corrected_odometer_ft": [100.0],
            "clock_position": [3.0],
            "feature_description": ["metal loss"],
        })
        df_b = pd.DataFrame({
            "corrected_odometer_ft": [5000.0],
            "clock_position": [9.0],
            "feature_description": ["metal loss"],
        })

        matches = hungarian_match(df_a, df_b, max_distance_ft=50.0)
        # Should have no accepted matches due to distance penalty
        accepted = [m for m in matches if m["accepted"]]
        assert len(accepted) == 0

    def test_empty_inputs(self):
        df_a = pd.DataFrame(columns=["corrected_odometer_ft", "clock_position", "feature_description"])
        df_b = pd.DataFrame(columns=["corrected_odometer_ft", "clock_position", "feature_description"])
        matches = hungarian_match(df_a, df_b)
        assert len(matches) == 0


# --- Growth Calculation Tests ---

class TestGrowthCalculation:
    def test_basic_growth(self):
        result = compute_depth_growth(
            depth_a_pct=20.0, depth_b_pct=30.0,
            wt_a=0.375, wt_b=0.375,
            year_a=2007, year_b=2015,
        )
        assert result["depth_growth_pct"] == 10.0
        assert result["annual_growth_rate_pct"] == pytest.approx(1.25, abs=0.01)
        assert result["depth_growth_in"] == pytest.approx(0.0375, abs=0.001)

    def test_time_to_critical(self):
        result = compute_depth_growth(
            depth_a_pct=60.0, depth_b_pct=70.0,
            wt_a=0.375, wt_b=0.375,
            year_a=2015, year_b=2022,
        )
        # 80% - 70% = 10% remaining, rate = 10/7 = 1.43%/yr
        # TTC = 10 / 1.43 ≈ 7 years
        assert result["time_to_critical_years"] == pytest.approx(7.0, abs=0.1)

    def test_no_growth(self):
        result = compute_depth_growth(
            depth_a_pct=20.0, depth_b_pct=20.0,
            wt_a=0.375, wt_b=0.375,
            year_a=2007, year_b=2015,
        )
        assert result["depth_growth_pct"] == 0.0
        assert result["time_to_critical_years"] is None  # no growth -> no TTC

    def test_none_inputs(self):
        result = compute_depth_growth(None, 30.0, 0.375, 0.375, 2007, 2015)
        assert result["depth_growth_pct"] is None

    def test_classify_growth(self):
        assert classify_growth_rate(15.0) == "critical"
        assert classify_growth_rate(7.5) == "moderate"
        assert classify_growth_rate(2.0) == "low"
        assert classify_growth_rate(None) == "unknown"


class TestDimensionGrowth:
    def test_basic_dimension_growth(self):
        result = compute_dimension_growth(
            length_a=2.0, length_b=3.5,
            width_a=1.0, width_b=1.5,
            year_a=2007, year_b=2015,
        )
        assert result["length_growth_in"] == pytest.approx(1.5, abs=0.01)
        assert result["annual_length_growth_in"] == pytest.approx(0.1875, abs=0.001)
        assert result["width_growth_in"] == pytest.approx(0.5, abs=0.01)
        assert result["annual_width_growth_in"] == pytest.approx(0.0625, abs=0.001)

    def test_none_inputs(self):
        result = compute_dimension_growth(None, 3.0, 1.0, 1.5, 2007, 2015)
        assert result["length_growth_in"] is None
        assert result["annual_length_growth_in"] is None
        assert result["width_growth_in"] == pytest.approx(0.5, abs=0.01)

    def test_same_year(self):
        result = compute_dimension_growth(2.0, 3.0, 1.0, 1.5, 2015, 2015)
        assert result["length_growth_in"] is None
        assert result["width_growth_in"] is None

    def test_negative_growth(self):
        # Shrinkage (e.g., measurement variance)
        result = compute_dimension_growth(3.0, 2.5, 1.5, 1.2, 2015, 2022)
        assert result["length_growth_in"] == pytest.approx(-0.5, abs=0.01)
        assert result["width_growth_in"] == pytest.approx(-0.3, abs=0.01)
