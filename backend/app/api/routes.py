"""FastAPI routes for ILI pipeline data processing."""
from __future__ import annotations

import json
import os
import tempfile
import traceback

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

from ..core.normalizer import ingest_excel
from ..core.alignment import align_runs
from ..services.growth import build_matched_anomaly_table
from ..services.export import export_results_xlsx
from ..services.clustering import compute_anomaly_clusters
from ..services.prediction import compute_corrosion_prediction

router = APIRouter(prefix="/api", tags=["pipeline"])

# In-memory store for the latest processing result
_latest_result: dict | None = None


@router.post("/upload")
async def upload_and_process(file: UploadFile = File(...)):
    """Upload Pipeline_Data.xlsx and run the full alignment pipeline."""
    global _latest_result

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx) are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        sheets = ingest_excel(tmp_path)

        if not sheets:
            raise HTTPException(status_code=400, detail="No valid run sheets found.")

        alignment_result = align_runs(sheets, max_distance_ft=50.0, cost_threshold=0.8)
        matched_table = build_matched_anomaly_table(alignment_result)

        anomalies = alignment_result["anomalies"]
        gw_counts = {
            year: int(sheets[year]["is_girth_weld"].sum())
            for year in sheets
        }

        matched_count = sum(1 for r in matched_table if r["status"] == "matched")
        new_2015_count = sum(1 for r in matched_table if r["status"] == "new_2015")
        new_2022_count = sum(1 for r in matched_table if r["status"] == "new_2022")
        missing_count = sum(1 for r in matched_table if r["status"] == "missing")

        scores = [
            r.get("match_score_07_15") or r.get("match_score_15_22") or r.get("match_score_07_22")
            for r in matched_table
            if r["status"] == "matched"
        ]
        avg_score = sum(s for s in scores if s) / max(len([s for s in scores if s]), 1)

        gw_alignment = alignment_result.get("girth_weld_alignment", [])
        max_shift = max((abs(g.get("shift_ft", 0)) for g in gw_alignment), default=0)

        corrections_2015 = alignment_result["odometer_corrections"].get(2015, [])
        corrections_2022 = alignment_result["odometer_corrections"].get(2022, [])

        # Compute average growth rate (positive depth growth only)
        growth_rates = [
            (r.get("growth_15_22") or r.get("growth_07_22") or r.get("growth_07_15") or {}).get("annual_growth_rate_pct")
            for r in matched_table if r["status"] == "matched"
        ]
        positive_rates = [g for g in growth_rates if g is not None and g > 0]
        avg_growth = round(sum(positive_rates) / len(positive_rates), 4) if positive_rates else 0

        summary = {
            "run_count": len(sheets),
            "total_anomalies_2007": len(anomalies.get(2007, [])),
            "total_anomalies_2015": len(anomalies.get(2015, [])),
            "total_anomalies_2022": len(anomalies.get(2022, [])),
            "total_girth_welds_2007": gw_counts.get(2007, 0),
            "total_girth_welds_2015": gw_counts.get(2015, 0),
            "total_girth_welds_2022": gw_counts.get(2022, 0),
            "matched_count": matched_count,
            "new_anomalies_2015_count": new_2015_count,
            "new_anomalies_2022_count": new_2022_count,
            "missing_anomalies_count": missing_count,
            "avg_match_score": round(avg_score, 4),
            "avg_growth_rate_pct": avg_growth,
            "max_odometer_shift_ft": round(max_shift, 2),
        }

        # Compute clustering and prediction
        cluster_data = compute_anomaly_clusters(matched_table)
        prediction_data = compute_corrosion_prediction(matched_table)

        _latest_result = {
            "summary": summary,
            "matched_table": matched_table,
            "alignment_result": alignment_result,
            "girth_weld_alignment": gw_alignment,
            "odometer_corrections_2015": corrections_2015,
            "odometer_corrections_2022": corrections_2022,
            "cluster_data": cluster_data,
            "prediction_data": prediction_data,
        }

        response_data = {
            "status": "complete",
            "summary": summary,
            "matched_table": matched_table,
            "girth_weld_alignment": gw_alignment,
            "odometer_corrections_2015": corrections_2015,
            "odometer_corrections_2022": corrections_2022,
            "cluster_data": cluster_data,
            "prediction_data": prediction_data,
        }

        # Use json.dumps directly to handle the large response efficiently
        return JSONResponse(content=response_data)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.get("/results")
async def get_results():
    """Return the latest processing results."""
    if _latest_result is None:
        raise HTTPException(status_code=404, detail="No results available. Upload a file first.")
    return JSONResponse(content={
        "status": "complete",
        "summary": _latest_result["summary"],
        "matched_table": _latest_result["matched_table"],
        "girth_weld_alignment": _latest_result["girth_weld_alignment"],
        "odometer_corrections_2015": _latest_result["odometer_corrections_2015"],
        "odometer_corrections_2022": _latest_result["odometer_corrections_2022"],
        "cluster_data": _latest_result["cluster_data"],
        "prediction_data": _latest_result["prediction_data"],
    })


@router.get("/export")
async def export_xlsx():
    """Export results as a multi-tab Excel file."""
    if _latest_result is None:
        raise HTTPException(status_code=404, detail="No results available. Upload a file first.")

    xlsx_bytes = export_results_xlsx(
        _latest_result["matched_table"],
        _latest_result["alignment_result"],
    )

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ILI_Alignment_Results.xlsx"},
    )
