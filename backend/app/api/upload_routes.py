import math
import os
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd

from app.services.file_service import save_uploaded_file, read_dataset
from app.services.validation_service import validate_dataset
from app.services.schema_mapping_service import (
    detect_schema,
    check_required_fields,
)
from app.services.job_service import create_job, update_job


def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively sanitize objects for standard JSON compliance.
    Converts NaN, Infinity, -Infinity, and Pandas/NumPy missing values to None (JSON null).
    Preserves legitimate numbers (including 0 and 0.0), booleans (True/False), and strings.
    """
    if obj is None:
        return None
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    return obj


router = APIRouter(
    prefix="/jobs",
    tags=["File Upload"]
)


@router.post("/{job_id}/upload")
async def upload_dataset(
    job_id: str,
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )

    extension = file.filename.lower().split(".")[-1]

    if extension not in ["csv", "json"]:
        raise HTTPException(
            status_code=400,
            detail="Only CSV and JSON files are supported."
        )

    try:
        # --------------------------------------------------
        # 1. READ UPLOADED FILE
        # --------------------------------------------------

        content = await file.read()

        file_path = save_uploaded_file(
            file.filename,
            content
        )

        df = read_dataset(file_path)

        # --------------------------------------------------
        # 2. SEMANTIC SCHEMA DETECTION & REQUIRED FIELDS CHECK
        # --------------------------------------------------

        schema_result = detect_schema(
            df.columns.tolist()
        )

        required_result = check_required_fields(
            schema_result
        )

        # --------------------------------------------------
        # 3. DATA VALIDATION (SYNCHRONIZED WITH REQUIRED FIELDS)
        # --------------------------------------------------

        validation_result = validate_dataset(
            df,
            required_fields_present=required_result["all_required_fields_present"]
        )

        # --------------------------------------------------
        # 4. CREATE JOB & SANITIZE PREVIEW
        # --------------------------------------------------

        source_metadata = {
            "filename": file.filename,
            "file_size_bytes": os.path.getsize(file_path),
            "file_size_kb": round(os.path.getsize(file_path) / 1024, 2),
            "file_type": extension,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "source_columns": df.columns.tolist(),
            "source_rows": len(df),
            "column_count": len(df.columns),
        }

        raw_preview = df.head(10).to_dict(orient="records")
        sanitized_preview = sanitize_for_json(raw_preview)

        create_job(job_id)

        update_job(
            job_id,
            status="validated",
            filename=file.filename,
            file_path=str(file_path),
            source_metadata=source_metadata,
            validation=validation_result,
            schema_mapping=schema_result,
            required_fields=required_result,
            source_preview=sanitized_preview,
        )

        # --------------------------------------------------
        # 5. RETURN COMPLETE UPLOAD RESULT
        # --------------------------------------------------

        response_payload = {
            "success": True,
            "job_id": job_id,
            "filename": file.filename,
            "file_type": extension,
            "message": "Dataset uploaded and schema analyzed successfully.",
            "source_metadata": source_metadata,
            "validation": validation_result,
            "schema_mapping": schema_result,
            "required_fields": required_result,
            "source_preview": sanitized_preview,
        }

        return sanitize_for_json(response_payload)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset processing failed: {str(e)}"
        )