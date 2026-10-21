import json
import os
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
import numpy as np
import pandas as pd

from app.services.job_service import get_job, update_job
from app.services.transformation_service import transform_dataset

router = APIRouter(
    prefix="/jobs",
    tags=["Data Integration"]
)

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively sanitize objects for strict JSON compliance (disallowing NaN/Infinity).
    Converts NaN, Infinity, -Infinity, pd.NA, pd.NaT, and non-finite numbers to None (JSON null).
    Preserves legitimate zeros (0, 0.0), booleans (False, True), strings, and finite numbers.
    Safely handles Pandas and NumPy scalar types, sequences, and mappings.
    """
    if obj is None:
        return None
    # Booleans must be checked before integers (in Python isinstance(True, int) is True)
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    # Integers (including numpy integer scalars)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    # Floating point numbers (including numpy floating scalars)
    if isinstance(obj, (float, np.floating)):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    # Dictionaries
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    # NumPy ndarrays
    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(x) for x in obj.tolist()]
    # Sequences (lists, tuples, sets)
    if isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(item) for item in obj]
    # Strings
    if isinstance(obj, str):
        return obj
    # Pandas missing values (pd.NA, pd.NaT)
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    # Scalar items from numpy/pandas
    if hasattr(obj, "item") and callable(getattr(obj, "item")):
        try:
            return sanitize_for_json(obj.item())
        except Exception:
            pass
    return obj


def get_member2_base_url() -> str:
    """
    Retrieve Member 2's base URL from configuration.
    Priority:
      1. MEMBER2_BASE_URL
      2. MEMBER2_API_URL (stripped of known endpoint suffixes)
      3. MEMBER2_RECEIVE_URL (stripped of known endpoint suffixes)
      4. Fallback default tunnel URL
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    for env_var in ["MEMBER2_BASE_URL", "MEMBER2_API_URL", "MEMBER2_RECEIVE_URL"]:
        val = os.getenv(env_var)
        if val and val.strip():
            url = val.strip().rstrip("/")
            for suffix in [
                "/api/receive-file",
                "/api/receive",
                "/api/processed-results",
                "/api/ml-results",
            ]:
                if url.endswith(suffix):
                    url = url[:-len(suffix)].rstrip("/")
            return url
    return "https://isolation-stones-football-raw.trycloudflare.com"


def get_member2_receive_url() -> str:
    """
    Retrieve Member 2's file-receiving URL (/api/receive-file).
    Priority:
      1. MEMBER2_RECEIVE_URL (direct full URL if provided)
      2. MEMBER2_BASE_URL + '/api/receive-file'
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    direct_url = os.getenv("MEMBER2_RECEIVE_URL")
    if direct_url and direct_url.strip():
        return direct_url.strip()
    return f"{get_member2_base_url()}/api/receive-file"


def get_member2_processed_results_url() -> str:
    """
    Retrieve Member 2's remote processed-results URL (/api/processed-results).
    NOTE: This is a verified remote endpoint on Member 2, NOT on Member 1.
    Priority:
      1. MEMBER2_PROCESSED_RESULTS_URL (direct full URL if provided)
      2. MEMBER2_BASE_URL + '/api/processed-results'
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    direct_url = os.getenv("MEMBER2_PROCESSED_RESULTS_URL")
    if direct_url and direct_url.strip():
        return direct_url.strip()
    return f"{get_member2_base_url()}/api/processed-results"


@router.post("/{job_id}/integrate")
def integrate_dataset(job_id: str):
    """
    Transform the uploaded dataset, deliver the processed CSV
    to Member 2 for disaster assessment, retrieve evaluated ML records,
    and update distinct integration statuses in the job state.
    """

    job = get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found. Please upload the dataset first."
        )

    if not job.get("file_path"):
        raise HTTPException(
            status_code=400,
            detail="No uploaded file is associated with this job."
        )

    member2_receive_url = get_member2_receive_url()
    member2_processed_url = get_member2_processed_results_url()

    correlation_id = str(uuid.uuid4())
    member2_headers = {
        "X-Source-System": "Member-1",
        "X-Correlation-ID": correlation_id,
    }

    # Track distinct statuses across the integration lifecycle
    pipeline_status: Dict[str, str] = {
        "local_transformation": "pending",
        "remote_file_receipt": "pending",
        "remote_ml_assessment": "pending",
        "remote_records_retrieval": "pending",
        "execution_mode": "remote_live",
        "correlation_id": correlation_id,
    }

    try:
        update_job(
            job_id,
            status="processing",
            pipeline_status=pipeline_status
        )

        # ----------------------------------------------------
        # 1. LOCAL TRANSFORMATION
        # ----------------------------------------------------
        result = transform_dataset(
            file_path=job["file_path"],
            job_id=job_id
        )

        pipeline_status["local_transformation"] = "completed"

        # Get the processed CSV path
        output_file = result.get("output_file")

        if not output_file:
            raise ValueError(
                "Transformation did not return an output_file."
            )

        if not os.path.isabs(output_file):
            output_file = os.path.abspath(output_file)

        if not os.path.isfile(output_file):
            raise FileNotFoundError(
                f"Processed CSV not found: {output_file}"
            )

        # ----------------------------------------------------
        # 2. REMOTE FILE RECEIPT (POST /api/receive-file)
        # ----------------------------------------------------
        with open(output_file, "rb") as csv_file:
            response = httpx.post(
                member2_receive_url,
                files={
                    "file": (
                        os.path.basename(output_file),
                        csv_file,
                        "text/csv"
                    )
                },
                headers=member2_headers,
                timeout=120.0
            )

        response.raise_for_status()

        # Parse Member 2's response safely
        try:
            assessment = response.json()
            if not isinstance(assessment, dict):
                assessment = {"data": assessment}
        except (ValueError, json.JSONDecodeError):
            assessment = {
                "status": "raw_response",
                "message": response.text,
                "json_parse_error": True,
            }

        request_timestamp = datetime.now(timezone.utc).isoformat()
        receiver_confirmed = bool(
            response.status_code == 200
            and isinstance(assessment, dict)
            and not assessment.get("json_parse_error")
            and (
                assessment.get("status") == "success"
                or assessment.get("total_records") is not None
                or assessment.get("valid_records_count") is not None
                or assessment.get("sample_evaluated_records")
                or assessment.get("ml_assessment")
            )
        )

        pipeline_status["remote_file_receipt"] = "delivered"
        pipeline_status["receiver_confirmation"] = "confirmed" if receiver_confirmed else "unconfirmed"

        transfer_details = {
            "destination_service": "Member 2 Disaster Response Intelligence API",
            "destination_url": member2_receive_url,
            "request_timestamp": request_timestamp,
            "correlation_id": correlation_id,
            "source_system": "Member-1",
            "http_status": response.status_code,
            "record_count": result.get("processed_rows", 0),
            "file_sent": os.path.basename(output_file),
            "receiver_confirmed": receiver_confirmed,
            "confirmation_status": "Confirmed" if receiver_confirmed else "Unconfirmed",
            "receiver_message": assessment.get("message") or (
                f"Receiver acknowledged ingestion of {assessment.get('total_records', result.get('processed_rows', 0))} records"
                if receiver_confirmed else "Receiver did not confirm successful ingestion"
            ),
        }
        pipeline_status["transfer_details"] = transfer_details

        # ----------------------------------------------------
        # 3. REMOTE ML ASSESSMENT EVALUATION & RECORDS RETRIEVAL
        # ----------------------------------------------------
        has_ml = bool(
            isinstance(assessment, dict)
            and not assessment.get("json_parse_error")
            and (
                assessment.get("ml_assessment")
                or assessment.get("summary")
                or assessment.get("sample_evaluated_records")
            )
        )

        if has_ml:
            pipeline_status["remote_ml_assessment"] = "completed"
        elif assessment.get("json_parse_error"):
            pipeline_status["remote_ml_assessment"] = "invalid_json"
        else:
            pipeline_status["remote_ml_assessment"] = "unverified"

        # Verify exact Member 2 response associated with the current job
        output_filename = os.path.basename(output_file)
        expected_job_ids = {str(job_id), str(assessment.get("job_id") or "").strip()}
        expected_filenames = {
            output_filename,
            str(assessment.get("filename") or "").strip(),
            str(assessment.get("processed_file_saved") or "").strip(),
            f"{job_id}_processed.csv",
        }

        # Retrieve full processed records from verified remote endpoint on Member 2
        try:
            proc_params = {
                "job_id": assessment.get("job_id") or job_id,
                "filename": assessment.get("filename") or output_filename,
            }
            proc_resp = httpx.get(
                member2_processed_url,
                params=proc_params,
                headers=member2_headers,
                timeout=30.0
            )
            if proc_resp.status_code == 200:
                proc_data = proc_resp.json()
                if isinstance(proc_data, dict):
                    retrieved_job_id = str(proc_data.get("job_id") or "").strip()
                    retrieved_filename = str(proc_data.get("filename") or "").strip()

                    # Verify that retrieved records genuinely match current job (prevent stale results from prior jobs)
                    is_matching = bool(
                        (retrieved_job_id and retrieved_job_id in expected_job_ids)
                        or (retrieved_job_id and (retrieved_job_id.startswith(str(job_id)) or str(job_id).startswith(retrieved_job_id)))
                        or (retrieved_filename and (retrieved_filename in expected_filenames or retrieved_filename.startswith(str(job_id))))
                    )

                    if is_matching:
                        if isinstance(proc_data.get("records"), list) and len(proc_data["records"]) > 0:
                            assessment["records"] = proc_data["records"]
                        if isinstance(proc_data.get("columns"), list) and len(proc_data["columns"]) > 0:
                            assessment["columns"] = proc_data["columns"]
                        if "total_records" in proc_data:
                            assessment["total_records"] = proc_data["total_records"]
                        pipeline_status["remote_records_retrieval"] = "completed"
                    else:
                        # Stale results from a previous job detected; reject them
                        pipeline_status["remote_records_retrieval"] = "stale_rejected"
        except Exception:
            # Remote GET /api/processed-results unavailable or error; proceed to sample fallback
            pass

        # If full records not populated from verified remote GET, fallback to sample_evaluated_records
        # returned directly in Member 2's POST /api/receive-file response for THIS dataset upload
        if "records" not in assessment or not isinstance(assessment.get("records"), list):
            sample_recs = assessment.get("sample_evaluated_records")
            if isinstance(sample_recs, list) and len(sample_recs) > 0:
                assessment["records"] = sample_recs
                if "columns" not in assessment or not assessment["columns"]:
                    assessment["columns"] = list(sample_recs[0].keys())
                pipeline_status["remote_records_retrieval"] = "fallback_to_sample"
            else:
                if pipeline_status.get("remote_records_retrieval") != "stale_rejected":
                    pipeline_status["remote_records_retrieval"] = "not_available"

        # Determine overall pipeline completion:
        # Mark complete ONLY when Member 2 has received the dataset AND assessment results have been successfully retrieved
        has_retrieved_records = isinstance(assessment.get("records"), list) and len(assessment["records"]) > 0
        is_completed = bool(
            pipeline_status.get("remote_file_receipt") == "delivered"
            and pipeline_status.get("remote_ml_assessment") == "completed"
            and pipeline_status.get("remote_records_retrieval") in ["completed", "fallback_to_sample"]
            and has_retrieved_records
        )

        final_job_status = "completed" if is_completed else "partial"

        # ----------------------------------------------------
        # 4. STORE SANITIZED DATA & DISTINCT STATUSES
        # ----------------------------------------------------
        sanitized_result = sanitize_for_json(result)
        sanitized_assessment = sanitize_for_json(assessment)
        sanitized_pipeline_status = sanitize_for_json(pipeline_status)
        sanitized_transfer_details = sanitize_for_json(transfer_details)

        update_job(
            job_id,
            status=final_job_status,
            pipeline_status=sanitized_pipeline_status,
            transfer_details=sanitized_transfer_details,
            integration_result=sanitized_result,
            assessment_result=sanitized_assessment
        )

        if is_completed:
            message = (
                "Dataset transformed locally, delivered to Member 2, "
                "and assessment results successfully retrieved."
            )
        else:
            message = (
                "Dataset transformed locally and delivered to Member 2, "
                "but assessment results could not be fully retrieved."
            )

        response_payload = {
            "success": True,
            "status": final_job_status,
            "message": message,
            "job_id": job_id,
            "correlation_id": correlation_id,
            "transfer_details": sanitized_transfer_details,
            "pipeline_status": sanitized_pipeline_status,
            "integration": sanitized_result,
            "assessment": sanitized_assessment
        }

        return sanitize_for_json(response_payload)

    except httpx.HTTPError as e:
        status_code = getattr(getattr(e, "response", None), "status_code", 502)
        pipeline_status["local_transformation"] = (
            "completed" if pipeline_status.get("local_transformation") == "completed" else "failed"
        )
        pipeline_status["remote_file_receipt"] = "failed"
        pipeline_status["remote_ml_assessment"] = "unreachable"
        pipeline_status["remote_records_retrieval"] = "unreachable"
        pipeline_status["receiver_confirmation"] = "failed"

        failed_transfer = {
            "destination_service": "Member 2 Disaster Response Intelligence API",
            "destination_url": member2_receive_url,
            "request_timestamp": datetime.now(timezone.utc).isoformat(),
            "correlation_id": correlation_id,
            "source_system": "Member-1",
            "http_status": status_code,
            "record_count": result.get("processed_rows", 0) if "result" in locals() else 0,
            "file_sent": os.path.basename(output_file) if "output_file" in locals() else "",
            "receiver_confirmed": False,
            "confirmation_status": "Failed",
            "receiver_message": f"Connection/HTTP Error: {str(e)}",
        }
        pipeline_status["transfer_details"] = failed_transfer

        update_job(
            job_id,
            status="failed",
            pipeline_status=pipeline_status,
            transfer_details=failed_transfer,
        )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not communicate with Member 2 API at '{member2_receive_url}'. "
                f"Check that its backend and Cloudflare tunnel are running. "
                f"Details: {str(e)}"
            )
        ) from e

    except Exception as e:
        update_job(
            job_id,
            status="failed",
            pipeline_status=pipeline_status
        )

        raise HTTPException(
            status_code=500,
            detail=f"Integration failed: {str(e)}"
        ) from e
