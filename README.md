# ILI Pipeline Inspection Data Alignment System

Automated multi-year inline inspection (ILI) data alignment system that processes pipeline inspection runs from 2007, 2015, and 2022 to produce a unified "Golden Thread" of pipeline health. The system overcomes odometer drift, heterogeneous schemas, and clock inconsistencies to track corrosion growth, predict future risk, and flag anomalies requiring immediate attention.

---

## Table of Contents

- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Usage](#usage)
- [Data Processing Pipeline](#data-processing-pipeline)
  - [Phase 1: Schema Normalization](#phase-1-schema-normalization)
  - [Phase 2: Odometer Drift Correction](#phase-2-odometer-drift-correction)
  - [Phase 3: Hungarian Algorithm Matching](#phase-3-hungarian-algorithm-matching)
  - [Phase 4: Growth Rate Calculation](#phase-4-growth-rate-calculation)
  - [Phase 5: Anomaly Lineage Tracking](#phase-5-anomaly-lineage-tracking)
  - [Phase 6: Spatial Clustering](#phase-6-spatial-clustering)
  - [Phase 7: Corrosion Risk Prediction](#phase-7-corrosion-risk-prediction)
- [API Reference](#api-reference)
- [Frontend Features](#frontend-features)
- [Key Calculations Reference](#key-calculations-reference)
- [Excel Export Format](#excel-export-format)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  FileUpload → SummaryCards → Charts → AnomalyTable → Profile   │
│              PipelineMap    ClusterChart   PredictionChart       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Axios (/api proxy)
┌──────────────────────────────▼──────────────────────────────────┐
│                     Backend (FastAPI)                            │
│                                                                 │
│  POST /api/upload ─┬─ ingest_excel()                            │
│                    ├─ align_runs()                               │
│                    │   ├─ piecewise_linear_correction()          │
│                    │   └─ hungarian_match() (windowed)           │
│                    ├─ build_matched_anomaly_table()              │
│                    │   ├─ compute_depth_growth()                 │
│                    │   └─ classify_growth_rate()                 │
│                    ├─ compute_anomaly_clusters()                 │
│                    └─ compute_corrosion_prediction()             │
│                                                                 │
│  GET /api/results ── return cached results                      │
│  GET /api/export ─── export_results_xlsx()                      │
└─────────────────────────────────────────────────────────────────┘
```

**Input**: A single `Pipeline_Data.xlsx` file containing three sheets (`2007`, `2015`, `2022`) with inspection data from each ILI run.

**Output**: Interactive dashboard with matched anomaly lineage, growth analysis, risk predictions, and downloadable multi-tab Excel report.

---

## Installation & Setup

### Prerequisites

- Python 3.10+ (tested on 3.13)
- Node.js 18+
- npm

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Environment Variables (Optional)

Create `frontend/.env` for the pipeline map feature:

```
VITE_MAPBOX_TOKEN=your_mapbox_access_token
```

The map will show a severity summary fallback if no token is provided.

---

## Running the Application

### Start the Backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api` requests to the backend on port 8000.

### Production Build

```bash
cd frontend
npm run build
```

Static assets are output to `frontend/dist/`.

---

## Usage

1. Open `http://localhost:5173` in a browser.
2. Drag and drop `Pipeline_Data.xlsx` onto the upload zone (or click to browse).
3. Wait for processing to complete (all 6 pipeline phases shown in the checklist).
4. Explore the dashboard: summary metrics, charts, map, anomaly table.
5. Click any anomaly row to open the detailed profile panel on the right.
6. Click **Export Report** in the header to download `ILI_Alignment_Results.xlsx`.

---

## Data Processing Pipeline

### Phase 1: Schema Normalization

Each inspection year uses different column names. The normalizer maps all three schemas to a canonical set of fields.

#### Header Mappings

| Canonical Field | 2007 Column | 2015 Column | 2022 Column |
|---|---|---|---|
| `odometer_ft` | `log dist. [ft]` | `Log Dist. [ft]` | `ILI Wheel Count [ft.]` |
| `wall_thickness_in` | `t [in]` | `Wt [in]` | `WT [in]` |
| `feature_description` | `event` | `Event Description` | `Feature Description` |
| `clock_raw` | `o'clock` | `O'clock` | `O'clock [hh:mm]` |
| `depth_pct` | `depth [%]` | `Depth [%]` | `Metal Loss Depth [%]` |
| `length_in` | `length [in]` | `Length [in]` | `Length [in.]` |
| `width_in` | `width [in]` | `Width [in]` | `Width [in.]` |
| `joint_number` | `jt #` | `Jt #` | `Joint Number` |
| `joint_length_ft` | `jt lgth [ft]` | `Jt Lgth [ft]` | `Joint Length [ft.]` |
| `id_od` | `id/od` | `Anomaly ID/OD` | `ID/OD` |
| `erf` | `erf` | `ERF` | `ERF` |
| `rpr` | *(not present)* | `RPR` | `Repair Pressure Ratio` |
| `mod_b31g_psafe` | *(not present)* | `Mod B31G Psafe [PSI]` | *(not present)* |
| `mod_b31g_pburst` | *(not present)* | `Mod B31G Pburst [PSI]` | *(not present)* |
| `eff_area_psafe` | *(not present)* | `Effective Area Psafe [PSI]` | *(not present)* |
| `eff_area_pburst` | *(not present)* | `Effective Area Pburst [PSI]` | *(not present)* |
| `dist_to_us_weld_ft` | `us weld dist [ft]` | `US Weld Dist [ft]` | `Distance Marker Upstream [ft.]` |
| `dist_to_ds_weld_ft` | `ds weld dist [ft]` | `DS Weld Dist [ft]` | `Distance Marker Downstream [ft.]` |
| `comments` | `comments` | `Comments` | `Comments` |

#### Column Name Cleanup

The 2022 sheet contains column names with embedded newline characters (e.g., `O'clock\n[hh:mm]`). All column names are normalized with:

```python
re.sub(r"\s+", " ", col).strip()
```

#### Clock Position Conversion

Clock positions (representing angular position on the pipe circumference) are converted to decimal 0.0–12.0:

- `datetime.time` objects: `hour + minute / 60.0`
- String formats (`"3:30"`, `"09:04:00"`): parsed by splitting on `:` or `.`
- Numeric values: taken directly if 0–12, wrapped via modulo if >12

#### Feature Classification

Each row is classified using regex patterns:

- **Girth Weld**: matches `^(girth\s*weld|girthweld|gw)$` (case-insensitive)
- **Anomaly**: matches `(metal\s*loss|corrosion|cluster|dent|crack|seam\s*weld\s*anomaly)`

#### Depth Calculation (2007)

The 2007 data provides depth as percentage only. Absolute depth in inches is computed:

```
depth_in = (depth_pct / 100.0) * wall_thickness_in
```

**Source**: `backend/app/core/normalizer.py`

---

### Phase 2: Odometer Drift Correction

ILI tools measure distance with wheel odometers that drift between runs. Girth welds (fixed physical features) serve as ground-truth reference points to correct this drift.

#### Algorithm: Piecewise Linear Interpolation

1. Extract girth weld positions from each year's data.
2. Pair girth welds sequentially between the baseline (2007) and each target year (2015, 2022).
3. Build an interpolation function mapping target-year positions to baseline positions:

```
f(target_position) = interp1d(target_gw_positions, baseline_gw_positions, kind="linear", fill_value="extrapolate")
```

4. Apply `f()` to every odometer value in the target year to produce `corrected_odometer_ft`.

Each correction record contains:
- `gw_index`: Which girth weld pair
- `baseline_ft`: Position in 2007
- `target_ft`: Original position in target year
- `shift_ft`: `baseline_ft - target_ft` (the drift amount)

Requires a minimum of 2 girth weld pairs. If fewer are available, odometer values are passed through uncorrected.

**Source**: `backend/app/core/alignment.py` — `piecewise_linear_correction()`

---

### Phase 3: Hungarian Algorithm Matching

After odometer correction, anomalies from different runs are matched using the Hungarian Algorithm (optimal bipartite assignment) with a weighted cost matrix.

#### Cost Matrix

For each pair of anomalies (one from run A, one from run B), the cost is:

```
cost = 0.5 * distance_cost + 0.3 * clock_cost + 0.2 * feature_cost
```

| Component | Weight | Calculation | Normalization |
|---|---|---|---|
| Distance | 0.50 | `abs(corrected_odo_A - corrected_odo_B)` | `clip(distance / max_distance_ft, 0, 1)` |
| Clock Position | 0.30 | `min(abs(a - b), 12.0 - abs(a - b))` | `circular_distance / 6.0` |
| Feature Type | 0.20 | Category comparison | 0.0 = same, 0.3 = compatible, 1.0 = different |

**Clock Distance** uses circular arithmetic: the distance between clock positions 11.5 and 0.5 is 1.0, not 11.0.

**Feature Categories**:
- Category 0: Metal loss, corrosion, cluster, metal loss manufacturing
- Category 1: Dent, seam weld dent
- Category 2: Other

Pairs with distance > `max_distance_ft` (default 50 ft) receive a penalty cost of 1,000,000 to prevent distant matches.

#### Windowed Segmentation

For pipelines with >1000 anomalies, a full N×M cost matrix is infeasible. The pipeline is divided into overlapping windows:

- **Window size**: 500 ft
- **Step size**: 400 ft (100 ft overlap)
- Already-matched indices are excluded from subsequent windows to prevent duplicate matches.

#### Match Output

Each match produces:
- `match_score`: `max(0, 1.0 - cost)` — 1.0 is perfect, 0.0 is worst
- `accepted`: `True` if `cost <= cost_threshold` (default 0.8)
- `match_detail`: Component-level breakdown (distance confidence, clock confidence, feature confidence)

Three pairwise matching passes are run:
1. 2007 ↔ 2015
2. 2015 ↔ 2022
3. 2007 ↔ 2022 (direct cross-check)

**Source**: `backend/app/core/alignment.py` — `hungarian_match()`, `_local_hungarian_match()`

---

### Phase 4: Growth Rate Calculation

For each matched anomaly pair, growth metrics are computed across the time intervals.

#### Depth Growth

```
depth_growth_pct = depth_B_pct - depth_A_pct
annual_growth_rate_pct = depth_growth_pct / (year_B - year_A)

wt = wall_thickness_B (or wall_thickness_A if B unavailable)
depth_A_in = (depth_A_pct / 100.0) * wt
depth_B_in = (depth_B_pct / 100.0) * wt
depth_growth_in = depth_B_in - depth_A_in
annual_growth_rate_in = depth_growth_in / (year_B - year_A)
```

#### Dimension Growth

```
length_growth_in = length_B - length_A
annual_length_growth = length_growth_in / (year_B - year_A)

width_growth_in = width_B - width_A
annual_width_growth = width_growth_in / (year_B - year_A)
```

#### Time-to-Critical

Years until the anomaly reaches 80% wall loss at the current growth rate:

```
time_to_critical = (80.0 - current_depth_pct) / annual_growth_rate_pct
```

Only computed when `annual_growth_rate_pct > 0` and `current_depth_pct < 80.0`.

#### Severity Classification

Based on the latest annual depth growth rate:

| Severity | Annual Growth Rate |
|---|---|
| Critical | > 10.0 %/year |
| Moderate | 5.0 – 10.0 %/year |
| Low | < 5.0 %/year |
| Unknown | No growth data available |

**Source**: `backend/app/services/growth.py`

---

### Phase 5: Anomaly Lineage Tracking

The system builds a unified table that traces each defect across all three inspection runs.

#### Lineage Chain Construction

1. **Build match indices** from all three pairwise matching results:
   - `map_07_to_15`: 2007 index → 2015 match
   - `map_15_to_22`: 2015 index → 2022 match
   - `map_07_to_22`: 2007 index → 2022 match (direct fallback)

2. **For each 2007 anomaly**:
   - Primary path: 2007 → 2015 → 2022 (chained through sequential matches)
   - Fallback: 2007 → 2022 (direct match if no 2015 link exists)
   - Status: `"matched"`
   - Growth computed for each available pair (07-15, 15-22, 07-22)

3. **Unmatched 2015 anomalies** (not linked to any 2007 record):
   - Status: `"new_2015"`
   - Checked for forward link to 2022 via `map_15_to_22`

4. **Unmatched 2022 anomalies** (not linked to any prior record):
   - Status: `"new_2022"`

5. **Missing anomalies**: Historical records with no forward match are flagged.

Each entry in the matched table includes:
- Full record data from each available run (2007, 2015, 2022)
- Match scores and component breakdowns for each pair
- Growth calculations for each interval
- Overall severity classification

**Source**: `backend/app/services/growth.py` — `build_matched_anomaly_table()`

---

### Phase 6: Spatial Clustering

Identifies high-density anomaly zones along the pipeline using segment-based density analysis.

#### Algorithm

1. Collect positions and depths from the latest available run (preferring 2022 → 2015 → 2007).
2. Divide the pipeline into fixed-width bins (default **200 ft**).
3. Count anomalies per bin using histogram binning.
4. Compute detection threshold: **2.0 × mean density** (mean anomalies per bin).
5. Identify contiguous bins above the threshold as "hot zones."
6. Group adjacent hot bins into clusters.

#### Cluster Attributes

Each cluster reports:
- `start_ft` / `end_ft`: Spatial extent
- `anomaly_count`: Total anomalies within the zone
- `dominant_severity`: Most common severity level in the cluster
- `avg_depth_pct`: Mean anomaly depth in the zone

**Source**: `backend/app/services/clustering.py`

---

### Phase 7: Corrosion Risk Prediction

A multi-component risk framework combining statistical density estimation, growth extrapolation, and temporal projections.

#### Component 1: New Anomaly Emergence Density (Weight: 40%)

Uses Kernel Density Estimation (KDE) with Silverman bandwidth on positions of anomalies classified as `new_2015` or `new_2022`. If fewer than 3 new anomalies exist, a proximity-based Gaussian is used:

```
density(pos) = exp(-0.5 * ((pos - center) / 500.0)^2)
```

Normalized to 0–1.

#### Component 2: Local Growth Rate Profile (Weight: 30%)

For each evaluation point along the pipeline (spaced every 100 ft by default):
- Window: ±500 ft from the evaluation point
- Compute the average annual growth rate of all matched anomalies within the window
- Normalize to 0–1

#### Component 3: Critical Count Projections (Weight: 30%)

Extrapolates current depths forward at the observed annual growth rate for 4 horizons:

```
projected_depth = current_depth_pct + annual_growth_rate * horizon_years
```

Horizons: **5, 10, 15, and 20 years**

For each evaluation point, counts the number of nearby anomalies (±500 ft) projected to reach ≥80% wall loss within each horizon.

#### Composite Risk Score

```
composite = 0.4 * emergence_density + 0.3 * growth_rate_norm + 0.3 * critical_count_20yr_norm
```

#### High-Risk Zone Detection

Contiguous evaluation points with composite score ≥ **0.6** are grouped into high-risk zones, each reporting:
- `start_ft` / `end_ft`: Spatial extent
- `risk_score`: Maximum composite score in the zone

**Source**: `backend/app/services/prediction.py`

---

## API Reference

### `POST /api/upload`

Upload and process a Pipeline_Data.xlsx file.

**Request**: `multipart/form-data` with field `file` (`.xlsx` or `.xls`)

**Response** (JSON):

```json
{
  "status": "complete",
  "summary": {
    "run_count": 3,
    "total_anomalies_2007": 1234,
    "total_anomalies_2015": 1456,
    "total_anomalies_2022": 1589,
    "total_girth_welds_2007": 500,
    "total_girth_welds_2015": 502,
    "total_girth_welds_2022": 498,
    "matched_count": 980,
    "new_anomalies_2015_count": 120,
    "new_anomalies_2022_count": 200,
    "missing_anomalies_count": 45,
    "avg_match_score": 0.72,
    "avg_growth_rate_pct": 1.85,
    "max_odometer_shift_ft": 12.4
  },
  "matched_table": [
    {
      "status": "matched|new_2015|new_2022|missing",
      "run_2007": { "odometer_ft": ..., "depth_pct": ..., ... },
      "run_2015": { ... },
      "run_2022": { ... },
      "match_score_07_15": 0.85,
      "match_score_15_22": 0.78,
      "match_score_07_22": 0.71,
      "match_detail_07_15": { "distance_confidence": ..., "clock_confidence": ..., "feature_confidence": ... },
      "growth_07_15": { "depth_growth_pct": ..., "annual_growth_rate_pct": ..., "time_to_critical_years": ... },
      "growth_15_22": { ... },
      "growth_07_22": { ... },
      "severity": "critical|moderate|low|unknown"
    }
  ],
  "girth_weld_alignment": [...],
  "odometer_corrections_2015": [{ "gw_index": 0, "baseline_ft": 100.5, "target_ft": 101.2, "shift_ft": -0.7 }],
  "odometer_corrections_2022": [...],
  "cluster_data": {
    "bin_centers_ft": [...],
    "anomaly_counts": [...],
    "mean_density": 2.5,
    "threshold": 5.0,
    "clusters": [{ "id": 1, "start_ft": ..., "end_ft": ..., "anomaly_count": ..., "dominant_severity": ..., "avg_depth_pct": ... }]
  },
  "prediction_data": {
    "positions_ft": [...],
    "new_anomaly_density": [...],
    "avg_growth_rate": [...],
    "avg_growth_rate_norm": [...],
    "composite_risk_score": [...],
    "critical_count_5yr": [...],
    "critical_count_10yr": [...],
    "critical_count_15yr": [...],
    "critical_count_20yr": [...],
    "high_risk_zones": [{ "start_ft": ..., "end_ft": ..., "risk_score": ... }]
  }
}
```

### `GET /api/results`

Retrieve the most recent processing results (same response shape as upload).

Returns `404` if no file has been uploaded yet.

### `GET /api/export`

Download results as a multi-tab Excel file.

**Response**: Binary `.xlsx` file attachment (`ILI_Alignment_Results.xlsx`).

---

## Frontend Features

### File Upload

Drag-and-drop upload zone accepting `.xlsx` and `.xls` files. Validates file type before submission. Shows a processing spinner during backend analysis and displays the loaded filename with an option to replace.

**Component**: `frontend/src/components/FileUpload.jsx`

### Data Processing Checklist

A 6-step progress indicator showing completion of each pipeline phase:
1. Schema normalization across 2007/2015/2022 headers
2. Clock position conversion to 0.0–12.0 decimal
3. Girth weld alignment via piecewise linear interpolation
4. Odometer drift correction (displays count and max shift)
5. Hungarian Algorithm matching with weighted cost factors
6. Growth rate calculation with time-to-critical analysis

**Component**: `frontend/src/components/DataProcessingChecklist.jsx`

### Summary Dashboard

Eight metric cards in a responsive grid:

| Card | Description |
|---|---|
| Runs | Number of inspection runs (3) |
| Matched | Anomalies matched across runs |
| New 2015 | Anomalies first appearing in 2015 |
| New 2022 | Anomalies first appearing in 2022 |
| Missing | Unmatched historical anomalies |
| Avg Growth | Average annual depth growth rate (%) |
| Confidence | Average match confidence score (%) |
| Max Drift | Maximum odometer shift detected (ft) |

Below the summary cards, three run-specific stat cards show anomaly and girth weld counts for each year.

**Component**: `frontend/src/components/SummaryCards.jsx`

### Pipeline Map

Interactive Mapbox GL map visualization with:

- **Synthetic pipeline route**: Generated from a Midland, TX origin with sinusoidal curves
- **Distance-to-GPS interpolation**: Maps odometer positions to lat/lng coordinates
- **Clustered markers**: At zoom <14, anomalies cluster into aggregate markers sized by count
- **Color-coded severity**: Critical (red), Moderate (orange), Low (green), Unknown (gray)
- **Click interaction**: Clicking an anomaly marker opens its profile panel
- **Legend**: Bottom-left showing severity breakdown with counts
- **Graceful fallback**: If no Mapbox token is set, shows a severity summary instead

**Component**: `frontend/src/components/PipelineMap.jsx`

### Odometer Drift Chart

Line-and-marker Plotly chart showing girth weld alignment shifts:
- **2015 Shift**: Orange trace showing drift relative to 2007 baseline
- **2022 Shift**: Blue trace showing drift relative to 2007 baseline
- **Baseline**: Dashed gray line at y=0

X-axis: Baseline distance (ft). Y-axis: Shift (ft).

**Component**: `frontend/src/components/AlignmentChart.jsx`

### Growth Scatter Chart

Scatter plot showing anomaly depth (% wall thickness) vs. corrected pipeline distance (ft) for the 2022 run. Points are color-coded by severity (Critical/Moderate/Low/Unknown). Hover tooltips show feature description, depth percentage, and annual growth rate.

**Component**: `frontend/src/components/GrowthScatterChart.jsx`

### Anomaly Clustering Chart

Density histogram with cluster analysis:
- **Bars**: Anomaly count per 200 ft bin, color-coded (blue = normal, orange = above threshold, red = 1.5x+ threshold)
- **Threshold line**: Red dashed horizontal line at 2× mean density
- **Mean line**: Gray dotted horizontal line at mean density
- **Cluster zones**: Semi-transparent red rectangles highlighting detected hot zones

Below the chart, a detail table lists each cluster with: ID, spatial range, anomaly count, dominant severity (color-coded badge), and average depth percentage.

**Component**: `frontend/src/components/ClusterChart.jsx`

### Corrosion Prediction Chart

Multi-layer risk forecast with interactive controls:

- **Base layer**: Composite risk score as a red filled area (0–1 scale)
- **Horizon selector**: Toggle between 5yr, 10yr, 15yr, 20yr critical count projections (bar overlay on secondary y-axis)
- **Overlay toggles**: Enable/disable new anomaly density (purple dashed) and growth rate (orange dotted) overlays
- **High-risk zone annotations**: Labeled rectangles marking zones with composite score ≥ 0.6

Dual y-axes: left = risk score (0–1), right = projected critical count.

**Component**: `frontend/src/components/CorrosionPredictionChart.jsx`

### Anomaly Lineage Table

Full-featured data table with:

- **Search**: Real-time filtering across feature description, distance, joint number, feature ID, status, and severity
- **Sorting**: Click any column header to sort ascending/descending
- **Pagination**: 50 rows per page with Previous/Next navigation
- **Expandable rows**: Click the chevron to reveal per-run detail cards and match component breakdown

**Visible Columns**:

| Column | Description | Conditional Formatting |
|---|---|---|
| Status | Matched / New 2015 / New 2022 / Missing | Color-coded badge |
| Feature ID | Identifier from latest run | Monospace |
| Severity | Critical / Moderate / Low / Unknown | Color-coded badge |
| Distance (ft) | Latest corrected odometer position | — |
| Depth (%) | Wall thickness percentage | Red ≥60%, orange ≥40% |
| Length (in) | Defect length | — |
| Width (in) | Defect width | — |
| Depth Growth (%/yr) | Annual depth growth rate | Red >3, orange >1 |
| Length Growth (in/yr) | Annual length growth rate | — |
| Width Growth (in/yr) | Annual width growth rate | — |
| Time to Critical | Years until 80% wall loss | Red <5 years |
| Confidence | Match score as percentage + progress bar | Red <40%, orange 40-70%, green ≥70% |

**Expanded Detail** shows:
- Three cards (one per year) with: distance, corrected distance, depth, wall thickness, length, width
- Match confidence breakdown for each pair (07-15, 15-22, 07-22) with component weights

**Component**: `frontend/src/components/AnomalyTable.jsx`

### Anomaly Profile Panel

A right-side slide-out panel (384px wide) with comprehensive anomaly detail:

1. **Header**: Feature ID and severity badge
2. **Regulatory Info**: Color-coded alert box with repair deadline and CFR citation
   - Critical: Immediate Repair (49 CFR 192.485)
   - Moderate: 60-Day Repair (ASME B31.8S Table 4)
   - Low: Scheduled Maintenance
   - Unknown: Routine Monitoring
3. **Key Metrics**: 2×2 grid showing depth growth (%/yr), time-to-critical, distance (ft), clock position
4. **Inspection History**: Expandable cards per year showing depth, length, width, distance, corrected distance, wall thickness
5. **Growth Rate Bars**: Horizontal progress bars for depth, length, and width growth with color coding
6. **Match Confidence**: Stacked breakdown bars for each pair showing distance/clock/feature component contributions
7. **Pipe Cross-Section**: SVG diagram showing the defect's clock position on a 12-hour pipe circumference

**Component**: `frontend/src/components/AnomalyProfile.jsx`

### Excel Export

Click **Export Report** in the header to download a multi-tab Excel workbook. See [Excel Export Format](#excel-export-format) below for details.

---

## Key Calculations Reference

| Calculation | Formula |
|---|---|
| Clock to Decimal | `hour + minute / 60.0` |
| Circular Clock Distance | `min(abs(a - b), 12.0 - abs(a - b))` |
| Match Cost | `0.5 * dist_norm + 0.3 * clock_norm + 0.2 * feature_cost` |
| Distance Normalization | `clip(abs(odo_A - odo_B) / max_distance_ft, 0, 1)` |
| Clock Normalization | `circular_distance / 6.0` |
| Match Score | `max(0, 1.0 - cost)` |
| Depth Growth (%) | `depth_B_pct - depth_A_pct` |
| Annual Growth (%/yr) | `depth_growth_pct / (year_B - year_A)` |
| Depth Growth (in) | `(depth_B_pct - depth_A_pct) / 100.0 * wall_thickness` |
| Time-to-Critical | `(80.0 - current_depth_pct) / annual_growth_rate_pct` |
| Cluster Threshold | `2.0 * mean_anomalies_per_bin` |
| Composite Risk Score | `0.4 * emergence_density + 0.3 * growth_norm + 0.3 * critical_20yr_norm` |
| High-Risk Zone Threshold | `composite_risk_score >= 0.6` |

---

## Excel Export Format

The exported `ILI_Alignment_Results.xlsx` contains three sheets:

### Sheet 1: Summary

Lists aggregate metrics: total matched, new, and missing anomaly counts, and severity distribution (critical/moderate/low).

### Sheet 2: Defect History

39 columns per anomaly with full lineage:

- **Status** and **Severity** (color-coded cells: red = critical, orange = moderate, green = low)
- **Per-Year Data** (2007, 2015, 2022): odometer, feature description, depth %, depth in, clock position, length, width
- **Match Scores**: 07-15, 15-22, 07-22
- **Growth Metrics**: absolute depth growth %, annual depth growth %/yr, annual length growth in/yr, annual width growth in/yr for each interval
- **Time-to-Critical**: years until 80% wall loss

Includes autofilter on the header row for in-Excel sorting/filtering. All numeric values formatted to 2 decimal places with 1px cell borders.

### Sheet 3: Girth Weld Alignment

Shows the odometer correction data: GW index, baseline 2007 position, target year position, and shift amount for both 2015 and 2022 corrections.

---

## Project Structure

```
RCP/
├── Pipeline_Data.xlsx              # Input: 3-tab Excel (2007, 2015, 2022)
├── README.md                       # This file
├── CLAUDE.md                       # Project specification
│
├── backend/
│   ├── requirements.txt            # Python dependencies
│   └── app/
│       ├── main.py                 # FastAPI app, CORS config, health check
│       ├── api/
│       │   └── routes.py           # API endpoints (upload, results, export)
│       ├── core/
│       │   ├── normalizer.py       # Schema mapping, clock conversion, feature classification
│       │   └── alignment.py        # Piecewise linear correction, Hungarian matching
│       ├── models/
│       │   └── schemas.py          # Pydantic models (AnomalyRecord, MatchedAnomaly, etc.)
│       └── services/
│           ├── growth.py           # Growth calculation, lineage table construction
│           ├── export.py           # Multi-tab XLSX generation with xlsxwriter
│           ├── clustering.py       # Segment-based density analysis
│           └── prediction.py       # KDE risk forecasting, composite scoring
│
└── frontend/
    ├── package.json                # Node dependencies
    ├── vite.config.js              # Vite + Tailwind v4 + API proxy config
    └── src/
        ├── main.jsx                # React entry point
        ├── App.jsx                 # Root component, state management, layout
        ├── App.css                 # Minimal (Tailwind handles styling)
        ├── index.css               # Design system: theme variables, typography, custom classes
        ├── services/
        │   └── api.js              # Axios client (upload, results, export endpoints)
        └── components/
            ├── FileUpload.jsx              # Drag-and-drop file upload
            ├── DataProcessingChecklist.jsx  # 6-step pipeline progress indicator
            ├── SummaryCards.jsx             # 8-card metrics dashboard
            ├── PipelineMap.jsx             # Mapbox GL interactive pipeline map
            ├── AlignmentChart.jsx          # Odometer drift Plotly chart
            ├── GrowthScatterChart.jsx      # Depth vs. distance scatter plot
            ├── ClusterChart.jsx            # Density histogram + cluster table
            ├── CorrosionPredictionChart.jsx # Multi-layer risk forecast chart
            ├── AnomalyTable.jsx            # Sortable/searchable anomaly lineage table
            └── AnomalyProfile.jsx          # Right panel: detailed anomaly profile
```

---

## Tech Stack

### Backend

| Package | Purpose |
|---|---|
| FastAPI | REST API framework |
| Uvicorn | ASGI server |
| Pandas | DataFrame processing and schema normalization |
| NumPy | Numerical arrays, vectorized cost matrices |
| SciPy | `linear_sum_assignment` (Hungarian), `interp1d`, `gaussian_kde` |
| openpyxl | Reading Excel (.xlsx) input files |
| xlsxwriter | Writing formatted multi-tab Excel exports |
| Pydantic | Request/response validation and data models |
| python-multipart | File upload handling |

### Frontend

| Package | Purpose |
|---|---|
| React 19 | UI framework |
| Vite 7 | Build tool and dev server |
| Tailwind CSS v4 | Utility-first styling with custom design system |
| Plotly.js / react-plotly.js | Interactive charts (scatter, bar, area) |
| Mapbox GL / react-map-gl | Interactive pipeline map |
| Lucide React | Icon library |
| Axios | HTTP client for API calls |

### Design System

- **Theme**: Industrial dark UI (no light mode)
- **Typography**: DM Sans (display), JetBrains Mono (data/monospace)
- **Color palette**: Surface grays (#0c1117 → #232b3a), industrial amber accent (#e5a525), semantic status colors (red/orange/green/blue)
