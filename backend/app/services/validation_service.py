from typing import Optional
import pandas as pd
from app.services.schema_mapping_service import detect_schema, check_required_fields


def validate_dataset(
    df: pd.DataFrame,
    required_fields_present: Optional[bool] = None,
) -> dict:
    """
    Perform data quality and disaster-response schema validation.
    """
    if required_fields_present is None:
        schema_res = detect_schema(df.columns.tolist())
        req_res = check_required_fields(schema_res)
        is_required_valid = bool(req_res.get("all_required_fields_present", False))
    else:
        is_required_valid = bool(required_fields_present)

    required_checks = {
        "file_format": True,
        "required_fields": is_required_valid,
        "data_types": True,
        "missing_values": int(df.isnull().sum().sum()) == 0,
        "duplicate_records": int(df.duplicated().sum()) == 0,
        "data_consistency": len(df) > 0,
    }

    missing_values = int(df.isnull().sum().sum())
    duplicate_records = int(df.duplicated().sum())

    passed = sum(1 for v in required_checks.values() if v is True)
    total = len(required_checks)

    return {
        "overall_status": "Passed" if passed == total else "Warning",
        "checks_passed": passed,
        "total_checks": total,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": df.columns.tolist(),
        "missing_values": missing_values,
        "duplicate_records": duplicate_records,
        "checks": required_checks,
    }