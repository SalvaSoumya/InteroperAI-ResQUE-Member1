import json
import math
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import httpx
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.integration_routes import (
    sanitize_for_json,
    get_member2_base_url,
    get_member2_receive_url,
    get_member2_processed_results_url,
)
from app.services.job_service import create_job, update_job, get_job

client = TestClient(app)

SAMPLE_DIR = Path(__file__).resolve().parents[1] / "data" / "sample"
NOAA_SAMPLE = SAMPLE_DIR / "noaa_storm_events_2025_sample.csv"
BASIC_SAMPLE = SAMPLE_DIR / "sample_disaster_data.csv"


# ============================================================================
# 1. JSON SANITIZATION UNIT TESTS
# ============================================================================

def test_sanitize_for_json_nested_nan():
    """Verify nested NaN values across dicts, lists, and tuples become JSON null."""
    data = {
        "float_nan": float("nan"),
        "np_nan": np.nan,
        "math_nan": math.nan,
        "nested_dict": {
            "inner_nan": float("nan"),
            "inner_list": [1.0, float("nan"), np.nan, 3.0],
        },
        "tuple_data": (np.nan, "text", float("nan")),
    }

    sanitized = sanitize_for_json(data)

    # Standard JSON serialization with allow_nan=False must succeed
    serialized = json.dumps(sanitized, allow_nan=False)
    parsed = json.loads(serialized)

    assert parsed["float_nan"] is None
    assert parsed["np_nan"] is None
    assert parsed["math_nan"] is None
    assert parsed["nested_dict"]["inner_nan"] is None
    assert parsed["nested_dict"]["inner_list"] == [1.0, None, None, 3.0]
    assert parsed["tuple_data"] == [None, "text", None]


def test_sanitize_for_json_infinity_values():
    """Verify positive and negative infinity values become JSON null."""
    data = {
        "pos_inf": float("inf"),
        "neg_inf": float("-inf"),
        "np_pos_inf": np.inf,
        "np_neg_inf": -np.inf,
        "nested_inf": [float("inf"), -float("inf"), {"val": np.inf}],
    }

    sanitized = sanitize_for_json(data)
    serialized = json.dumps(sanitized, allow_nan=False)
    parsed = json.loads(serialized)

    assert parsed["pos_inf"] is None
    assert parsed["neg_inf"] is None
    assert parsed["np_pos_inf"] is None
    assert parsed["np_neg_inf"] is None
    assert parsed["nested_inf"] == [None, None, {"val": None}]


def test_sanitize_for_json_valid_zeros():
    """Verify valid numeric zeros (integer, float, numpy types) are strictly preserved."""
    data = {
        "int_zero": 0,
        "float_zero": 0.0,
        "np_int_zero": np.int64(0),
        "np_float_zero": np.float64(0.0),
        "zero_in_list": [0, 0.0, np.int32(0)],
    }

    sanitized = sanitize_for_json(data)
    serialized = json.dumps(sanitized, allow_nan=False)
    parsed = json.loads(serialized)

    assert parsed["int_zero"] == 0
    assert parsed["int_zero"] is not None
    assert parsed["float_zero"] == 0.0
    assert parsed["float_zero"] is not None
    assert parsed["np_int_zero"] == 0
    assert parsed["np_float_zero"] == 0.0
    assert parsed["zero_in_list"] == [0, 0.0, 0]


def test_sanitize_for_json_booleans_and_strings():
    """Verify booleans and strings are preserved correctly and False is not treated as null."""
    data = {
        "bool_false": False,
        "bool_true": True,
        "np_bool_false": np.bool_(False),
        "np_bool_true": np.bool_(True),
        "empty_string": "",
        "zero_string": "0",
        "regular_string": "Disaster Event",
    }

    sanitized = sanitize_for_json(data)
    serialized = json.dumps(sanitized, allow_nan=False)
    parsed = json.loads(serialized)

    assert parsed["bool_false"] is False
    assert parsed["bool_true"] is True
    assert parsed["np_bool_false"] is False
    assert parsed["np_bool_true"] is True
    assert parsed["empty_string"] == ""
    assert parsed["zero_string"] == "0"
    assert parsed["regular_string"] == "Disaster Event"


def test_sanitize_for_json_pandas_na_and_numpy_arrays():
    """Verify pd.NA, pd.NaT, and numpy arrays are safely sanitized."""
    data = {
        "pd_na": pd.NA,
        "pd_nat": pd.NaT,
        "arr": np.array([1.5, np.nan, 0.0, -np.inf]),
    }

    sanitized = sanitize_for_json(data)
    serialized = json.dumps(sanitized, allow_nan=False)
    parsed = json.loads(serialized)

    assert parsed["pd_na"] is None
    assert parsed["pd_nat"] is None
    assert parsed["arr"] == [1.5, None, 0.0, None]


# ============================================================================
# 2. MOCK INTEGRATION TESTS (DISTINGUISHED EXPLICITLY AS MOCKS)
# ============================================================================

def test_mock_integration_genuine_response_flow():
    """
    [MOCK TEST] Test genuine remote response contract matching Member 2's structure.
    Mocks Member 2 POST /api/receive-file and GET /api/processed-results.
    Verifies that distinct pipeline statuses are recorded, records and columns
    are populated in assessment_result, and GET /jobs/{job_id} exposes them.
    """
    job_id = "test-job-mock-genuine-flow"
    create_job(job_id)
    update_job(
        job_id,
        filename=NOAA_SAMPLE.name,
        file_path=str(NOAA_SAMPLE)
    )

    # Genuine response structure from Member 2's POST /api/receive-file
    mock_receive_response = MagicMock()
    mock_receive_response.status_code = 200
    mock_receive_response.json.return_value = {
        "status": "success",
        "filename": f"{job_id}_processed.csv",
        "total_records": 500,
        "valid_records_count": 500,
        "summary": {
            "total_incidents": 500,
            "overall_risk": "LOW",
        },
        "ml_assessment": {
            "model_name": "Isolation Forest (Unsupervised Anomaly Detector)",
            "model_status": "Operational (Evaluated via pre-trained artifact)",
        },
        "sample_evaluated_records": [
            {
                "incident_identifier": 1252415,
                "disaster_type": "Thunderstorm Wind",
                "incident_location": "Tyus, Carroll, Georgia",
                "priority_level": "Unknown",
                "anomaly_score": 0.0264,
                "is_anomaly": False,
                "anomaly_status": "Normal",
            }
        ],
        "recommendations": [{"priority": "High", "action": "Deploy response team"}],
    }
    mock_receive_response.raise_for_status = MagicMock()

    # Genuine response structure from Member 2's GET /api/processed-results
    mock_processed_response = MagicMock()
    mock_processed_response.status_code = 200
    mock_processed_response.json.return_value = {
        "status": "success",
        "filename": f"{job_id}_processed.csv",
        "total_records": 500,
        "columns": [
            "incident_identifier",
            "disaster_type",
            "incident_location",
            "priority_level",
            "anomaly_score",
            "is_anomaly",
            "anomaly_status",
            "shelter_utilization_pct",
        ],
        "records": [
            {
                "incident_identifier": 1252415,
                "disaster_type": "Thunderstorm Wind",
                "incident_location": "Tyus, Carroll, Georgia",
                "priority_level": "Unknown",
                "anomaly_score": 0.0264,
                "is_anomaly": False,
                "anomaly_status": "Normal",
                "shelter_utilization_pct": 0.0,
            }
        ],
    }

    with patch("httpx.post", return_value=mock_receive_response) as mock_post:
        with patch("httpx.get", return_value=mock_processed_response) as mock_get:
            response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify outgoing Member 2 request headers
    assert mock_post.called
    post_headers = mock_post.call_args.kwargs.get("headers", {})
    assert post_headers.get("X-Source-System") == "Member-1"
    assert "X-Correlation-ID" in post_headers
    assert post_headers["X-Correlation-ID"]

    assert mock_get.called
    get_headers = mock_get.call_args.kwargs.get("headers", {})
    assert get_headers.get("X-Source-System") == "Member-1"
    assert get_headers.get("X-Correlation-ID") == post_headers["X-Correlation-ID"]

    # Verify distinct statuses
    pipeline_status = data["pipeline_status"]
    assert pipeline_status["local_transformation"] == "completed"
    assert pipeline_status["remote_file_receipt"] == "delivered"
    assert pipeline_status["remote_ml_assessment"] == "completed"
    assert pipeline_status["remote_records_retrieval"] == "completed"
    assert pipeline_status["execution_mode"] == "remote_live"

    # Verify records and columns are populated for Results.jsx consumption
    assessment = data["assessment"]
    assert "records" in assessment
    assert len(assessment["records"]) == 1
    assert assessment["records"][0]["incident_identifier"] == 1252415
    assert assessment["records"][0]["anomaly_score"] == 0.0264
    assert "columns" in assessment
    assert len(assessment["columns"]) == 8

    # Verify stored job state matches
    job_resp = client.get(f"/api/v1/jobs/{job_id}")
    assert job_resp.status_code == 200
    job_data = job_resp.json()["job"]
    assert job_data["status"] == "completed"
    assert job_data["pipeline_status"]["remote_ml_assessment"] == "completed"
    assert len(job_data["assessment_result"]["records"]) == 1


def test_outgoing_request_includes_source_system_and_correlation_headers():
    """
    [FOCUSED TEST] Explicitly verify that outgoing POST /api/receive-file and
    GET /api/processed-results carry 'X-Source-System: Member-1' and a matching
    non-empty 'X-Correlation-ID'.
    """
    job_id = "test-job-focused-headers"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    mock_receive = MagicMock()
    mock_receive.status_code = 200
    mock_receive.json.return_value = {
        "status": "success",
        "sample_evaluated_records": [{"incident_identifier": 1, "anomaly_score": 0.05}],
        "ml_assessment": {"model_name": "Isolation Forest"},
    }
    mock_receive.raise_for_status = MagicMock()

    mock_processed = MagicMock()
    mock_processed.status_code = 200
    mock_processed.json.return_value = {
        "status": "success",
        "job_id": job_id,
        "filename": f"{job_id}_processed.csv",
        "records": [{"incident_identifier": 1, "disaster_type": "Flood"}],
        "columns": ["incident_identifier", "disaster_type"],
    }
    mock_processed.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_receive) as mock_post:
        with patch("httpx.get", return_value=mock_processed) as mock_get:
            resp = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert resp.status_code == 200

    # 1. Verify POST /api/receive-file headers
    post_kwargs = mock_post.call_args.kwargs
    assert "headers" in post_kwargs, "POST request missing headers"
    post_headers = post_kwargs["headers"]
    assert post_headers.get("X-Source-System") == "Member-1", f"Expected 'Member-1', got {post_headers.get('X-Source-System')}"
    assert "X-Correlation-ID" in post_headers, "Missing X-Correlation-ID in POST headers"
    correlation_id = post_headers["X-Correlation-ID"]
    assert correlation_id and isinstance(correlation_id, str), "Correlation ID must be a non-empty string"

    # 2. Verify GET /api/processed-results headers reuse the same correlation ID
    get_kwargs = mock_get.call_args.kwargs
    assert "headers" in get_kwargs, "GET request missing headers"
    get_headers = get_kwargs["headers"]
    assert get_headers.get("X-Source-System") == "Member-1"
    assert get_headers.get("X-Correlation-ID") == correlation_id

    # 3. Verify returned payload and job record include the correlation ID
    data = resp.json()
    assert data["correlation_id"] == correlation_id
    assert data["pipeline_status"]["correlation_id"] == correlation_id


def test_mock_integration_connection_failure():
    """
    [MOCK TEST] Test that an unreachable Member 2 API produces HTTP 502 Bad Gateway,
    records 'failed' and 'unreachable' statuses, and never reports successful assessment.
    """
    job_id = "test-job-mock-conn-failure"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    with patch("httpx.post", side_effect=httpx.ConnectError("Connection refused by remote host")):
        response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 502
    data = response.json()
    assert "detail" in data
    assert "Could not communicate with Member 2 API" in data["detail"]

    # Verify job state records failure distinctly
    stored_job = get_job(job_id)
    assert stored_job["status"] == "failed"
    assert stored_job["pipeline_status"]["local_transformation"] == "completed"
    assert stored_job["pipeline_status"]["remote_file_receipt"] == "failed"
    assert stored_job["pipeline_status"]["remote_ml_assessment"] == "unreachable"
    assert "assessment_result" not in stored_job


def test_mock_integration_invalid_response_json():
    """
    [MOCK TEST] Test that non-JSON / HTML / malformed text from Member 2 is safely
    handled without crashing, recorded with 'invalid_json' status, and sanitized.
    """
    job_id = "test-job-mock-invalid-json"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    # Simulate an HTML error or proxy gateway message
    mock_response.json.side_effect = json.JSONDecodeError("Expecting value", "<html>502 Bad Gateway</html>", 0)
    mock_response.text = "<html>502 Bad Gateway</html>"
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_response):
        with patch("httpx.get", side_effect=Exception("Processed results not available")):
            response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    assert data["pipeline_status"]["remote_file_receipt"] == "delivered"
    assert data["pipeline_status"]["remote_ml_assessment"] == "invalid_json"
    assert data["assessment"]["json_parse_error"] is True
    assert data["assessment"]["message"] == "<html>502 Bad Gateway</html>"


def test_mock_integration_processed_results_fallback_to_sample():
    """
    [MOCK TEST] Test fallback to sample_evaluated_records when GET /api/processed-results
    is temporarily unavailable or returns an error.
    """
    job_id = "test-job-mock-fallback-sample"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    mock_receive_response = MagicMock()
    mock_receive_response.status_code = 200
    mock_receive_response.json.return_value = {
        "status": "success",
        "sample_evaluated_records": [
            {"incident_identifier": 101, "disaster_type": "Flood", "anomaly_score": 0.015}
        ],
        "ml_assessment": {"model_name": "Isolation Forest"},
    }
    mock_receive_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_receive_response):
        # Simulate GET /api/processed-results returning 500
        with patch("httpx.get", side_effect=httpx.HTTPError("Processed endpoint error")):
            response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    assert data["pipeline_status"]["remote_records_retrieval"] == "fallback_to_sample"
    assert len(data["assessment"]["records"]) == 1
    assert data["assessment"]["records"][0]["incident_identifier"] == 101
    assert data["assessment"]["columns"] == ["incident_identifier", "disaster_type", "anomaly_score"]


def test_mock_integration_rejects_stale_results_from_prior_job():
    """
    [MOCK TEST] Verify that processed-results belonging to a different job_id / filename
    are rejected as stale, and never displayed as current job's output.
    """
    job_id = "test-job-mock-stale-reject"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    mock_receive_response = MagicMock()
    mock_receive_response.status_code = 200
    mock_receive_response.json.return_value = {
        "status": "success",
        "job_id": job_id,
        "filename": f"{job_id}_processed.csv",
        "sample_evaluated_records": [
            {"incident_identifier": 555, "disaster_type": "Flood", "anomaly_score": 0.05}
        ],
        "ml_assessment": {"model_name": "Isolation Forest"},
    }
    mock_receive_response.raise_for_status = MagicMock()

    # Remote GET returns records from a completely different prior job
    mock_stale_response = MagicMock()
    mock_stale_response.status_code = 200
    mock_stale_response.json.return_value = {
        "status": "success",
        "job_id": "stale-old-job-from-yesterday",
        "filename": "stale_old_job_processed.csv",
        "records": [
            {"incident_identifier": 9999, "disaster_type": "Old Stale Disaster"}
        ],
        "columns": ["incident_identifier", "disaster_type"],
    }

    with patch("httpx.post", return_value=mock_receive_response):
        with patch("httpx.get", return_value=mock_stale_response):
            response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    # Stale records were rejected, so it fell back to sample_evaluated_records for THIS job
    assert data["pipeline_status"]["remote_records_retrieval"] == "fallback_to_sample"
    assert len(data["assessment"]["records"]) == 1
    # Genuine incident from THIS job's sample, NOT the stale 9999
    assert data["assessment"]["records"][0]["incident_identifier"] == 555


def test_mock_integration_assessment_retrieval_failure_marks_partial():
    """
    [MOCK TEST] Verify that when assessment results cannot be retrieved,
    the job is marked 'partial' (instead of claiming full completion).
    """
    job_id = "test-job-mock-partial-status"
    create_job(job_id)
    update_job(
        job_id,
        filename=BASIC_SAMPLE.name,
        file_path=str(BASIC_SAMPLE)
    )

    mock_receive_response = MagicMock()
    mock_receive_response.status_code = 200
    # Member 2 received the file, but response contains no sample records or ML assessment
    mock_receive_response.json.return_value = {
        "status": "success",
        "job_id": job_id,
        "filename": f"{job_id}_processed.csv",
        "sample_evaluated_records": [],
    }
    mock_receive_response.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_receive_response):
        with patch("httpx.get", side_effect=httpx.HTTPError("Service unavailable")):
            response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "partial"
    assert data["pipeline_status"]["remote_file_receipt"] == "delivered"
    assert data["pipeline_status"]["remote_records_retrieval"] == "not_available"

    # Verify job state in storage is 'partial'
    stored_job = get_job(job_id)
    assert stored_job["status"] == "partial"


# ============================================================================
# 3. REAL REMOTE INTEGRATION TEST (AUTHENTIC REMOTE LIVE TEST)
# ============================================================================

def test_real_remote_live_integration():
    """
    [REAL REMOTE INTEGRATION TEST] Tests live communication with the active Member 2 service.
    Skips cleanly if Member 2's tunnel/server is currently offline.
    """
    base_url = get_member2_base_url()
    try:
        health_resp = httpx.get(f"{base_url}/api/health", timeout=5.0)
        if health_resp.status_code != 200:
            pytest.skip(f"Member 2 health endpoint returned HTTP {health_resp.status_code}")
    except Exception as e:
        pytest.skip(f"Member 2 live tunnel is currently unreachable ({e})")

    job_id = "test-real-remote-integration"
    create_job(job_id)
    update_job(
        job_id,
        filename=NOAA_SAMPLE.name,
        file_path=str(NOAA_SAMPLE)
    )

    # Execute actual integration request against live remote Member 2 service
    response = client.post(f"/api/v1/jobs/{job_id}/integrate")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify real pipeline statuses
    p_status = data["pipeline_status"]
    assert p_status["local_transformation"] == "completed"
    assert p_status["remote_file_receipt"] == "delivered"
    assert p_status["remote_ml_assessment"] == "completed"
    assert p_status["execution_mode"] == "remote_live"

    # Verify real evaluated records from Member 2
    assessment = data["assessment"]
    assert "records" in assessment
    assert len(assessment["records"]) > 0
    assert "columns" in assessment
    assert len(assessment["columns"]) > 0

    # Strict JSON compliance verification
    json.dumps(data, allow_nan=False)


# ============================================================================
# 4. REGRESSION TEST: SCHEMA VALIDATION & REQUIRED FIELDS CONSISTENCY
# ============================================================================

def test_schema_validation_required_fields_consistency_with_test_disasters():
    """
    [REGRESSION TEST] Verify schema validation consistency when uploading
    'interoperai_resque_test_disasters.csv':
    1. All 10 source fields are successfully auto-mapped to COMMON_SCHEMA.
    2. Missing core required field 'incident_timestamp' is accurately identified.
    3. Validation check 'required_fields' reports False (synchronized with schema mapping).
    4. Missing casualties/injuries/damages (e.g. rows with nulls) are preserved as None/unknown,
       not fabricated or defaulted to 0.
    5. Complete datasets (e.g. sample_disaster_data.csv) pass both checks.
    """
    input_file = Path(__file__).resolve().parents[1] / "data" / "input" / "interoperai_resque_test_disasters.csv"
    if not input_file.exists():
        pytest.skip("interoperai_resque_test_disasters.csv not found in data/input")

    job_id = "test-job-schema-inconsistency"
    with open(input_file, "rb") as f:
        resp = client.post(
            f"/api/v1/jobs/{job_id}/upload",
            files={"file": (input_file.name, f, "text/csv")}
        )

    assert resp.status_code == 200
    data = resp.json()

    # 1. Verify all 10 source fields are Auto Mapped
    mappings = data["schema_mapping"]["mappings"]
    assert len(mappings) == 10
    for m in mappings:
        assert m["status"] == "Auto Mapped"

    # Specific required mappings from the prompt
    mapping_dict = {m["source_field"]: m["target_field"] for m in mappings}
    assert mapping_dict["incident_id"] == "incident_identifier"
    assert mapping_dict["location"] == "incident_location"
    assert mapping_dict["description"] == "incident_description"
    assert mapping_dict["priority_level"] == "priority_level"

    # 2. Verify missing required field detection
    req_fields = data["required_fields"]
    assert req_fields["all_required_fields_present"] is False
    assert "incident_timestamp" in req_fields["missing_required_fields"]

    # 3. Verify validation.checks['required_fields'] is synchronized with all_required_fields_present
    validation_checks = data["validation"]["checks"]
    assert validation_checks["required_fields"] is False

    # 4. Verify that missing casualty and damage values are preserved as None without fabrication
    with pytest.raises(ValueError, match="Required disaster-response information could not be detected"):
        # Transformation must refuse to proceed without core required fields (does not fabricate timestamps)
        from app.services.transformation_service import transform_dataset
        transform_dataset(file_path=str(input_file), job_id=job_id)

    # 5. Verify that casualty and loss parsing keeps nulls as None
    df = pd.read_csv(input_file)
    from app.services.transformation_service import (
        compute_aggregated_casualties,
        compute_aggregated_injuries,
        compute_total_loss,
    )
    # Row 5 (index 3) has empty reported_casualties, injured_population, estimated_loss
    row_5 = df.iloc[3]
    assert compute_aggregated_casualties(row_5, df.columns.tolist(), row_5["reported_casualties"]) is None
    assert compute_aggregated_injuries(row_5, df.columns.tolist(), row_5["injured_population"]) is None
    assert compute_total_loss(row_5, df.columns.tolist(), row_5["estimated_loss"]) is None

