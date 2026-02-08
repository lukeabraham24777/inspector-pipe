# ILI Pipeline Inspection Data Alignment System
## Claude Code Implementation Plan (Optimized for Multi-Year Data)

---

## Executive Summary
Automated ILI data alignment system to process a singular Excel file `Pipeline_Data.xlsx` with tabs: 
- `Summary`
- `2007` (Baseline, Run 1)
- `2015` (Run 2)
- `2022` (Run 3)

The system overcomes odometer drift, heterogeneous schemas, and clock inconsistencies to produce a unified "Golden Thread" of pipeline health over three runs.

---

## Core Technical Requirements
* **Alignment Strategy:** 
  - Global alignment using Dynamic Time Warping (DTW) on `Girth Weld` reference points.
  - Local refinement using Hungarian Algorithm matching for anomalies.
* **Normalization Layer:** Dynamic header mapping bridging 2007, 2015, and 2022 naming conventions.
* **Safety Logic:** Automated B31G/RSTRENG severity calculation and priority ranking per federal standards.

---

## Architecture
### Frontend (React + Tailwind + Lucide)
- **Dashboard:** Unified metrics for corrosion growth and risk.
- **Visualizer:** 2D longitudinal plot showing anomaly clusters and odometer drift.
- **Review Tool:** Manual verification of high-uncertainty matches.

### Backend (FastAPI + Pandas + SciPy)
- **Data Processor:** Standardizes heterogeneous schemas from all tabs.
- **Matching Engine:** Circular-distance similarity scores for clock positions.
- **Export Service:** Multi-tab XLSX with "Anomaly Lineage" tracking a defect across 15 years.

---

## Phase-by-Phase Roadmap

### Phase 1: Ingestion & Schema Normalization
- Map heterogeneous headers:
    - Distance: `log dist. [ft]` (2007), `Log Dist. [ft]` (2015), `ILI Wheel Count [ft.]` (2022) → `odometer_ft`
    - Wall Thickness: `t [in]` (2007), `Wt [in]` (2015), `WT [in]` (2022) → `wall_thickness_in`
    - Events: `event` / `Event Description` → `feature_description`
    - Reference Points: `Girth Weld` / `GirthWeld` / `GW` → `girth_weld`
- Normalize Clock strings (`hh:mm:ss`) to `0.0-12.0` decimal floats.

### Phase 2: Alignment & Matching
- **Global:** Align `Girth Welds` using DTW or piecewise linear correction.
- **Local:** Bipartite matching (Hungarian Algorithm) with cost matrix:
    - Corrected Distance (Weight 0.5)
    - Normalized Clock (Weight 0.3)
    - Feature Type/Dimensions (Weight 0.2)

### Phase 3: Reporting & Priority
- Compute **Growth Rates**:
    - Absolute Depth Growth (inches & %)
    - Annual Growth Rate (2007-2015, 2015-2022)
- Flag:
    - **New anomalies** (present in 2022, absent historically)
    - **Missing anomalies** (unmatched historical records)
- Time-to-Critical calculation for remaining years until 80% wall loss.

---

## File Structure
```text
project-root/
├── backend/
│   ├── app/
│   │   ├── core/           # Normalization, DTW, Hungarian logic
│   │   ├── services/       # Growth calculation, PDF/XLSX export
│   │   ├── models/         # Pydantic schemas for Runs 1, 2, 3
│   │   └── api/            # Routes for file processing
├── frontend/
│   ├── src/
│   │   ├── components/     # Charts, Maps, DataGrid
│   │   └── services/       # API integration
└── Pipeline_Data.xlsx       # Single source file with all tabs
