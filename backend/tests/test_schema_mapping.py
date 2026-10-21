import pytest
import pandas as pd
from pathlib import Path
from datetime import datetime

from app.services.schema_mapping_service import (
    COMMON_SCHEMA,
    normalize_field_name,
    detect_schema,
    check_required_fields,
    resolve_source_to_target,
    compose_noaa_datetime,
)
from app.services.transformation_service import (
    transform_dataset,
    compute_aggregated_casualties,
    compute_aggregated_injuries,
    compute_total_loss,
    compute_combined_location,
    standardize_timestamp_value,
)


# ============================================================
# 1. NOAA STORM EVENTS ALIASES & RECOGNITION
# ============================================================

def test_recognized_noaa_storm_events_aliases():
    """
    Verify automatic mapping and derivation for recognized NOAA Storm Events source columns.
    """
    noaa_columns = [
        "EVENT_ID",
        "EVENT_TYPE",
        "BEGIN_DATE_TIME",
        "BEGIN_LAT",
        "BEGIN_LON",
        "EVENT_NARRATIVE",
        "SOURCE",
        "CZ_NAME",
        "STATE",
        "BEGIN_LOCATION",
        "DEATHS_DIRECT",
        "DEATHS_INDIRECT",
        "INJURIES_DIRECT",
        "INJURIES_INDIRECT",
        "DAMAGE_PROPERTY",
        "DAMAGE_CROPS",
        "WFO",
        "DATA_SOURCE",
        "MAGNITUDE",
        "TOR_F_SCALE",
    ]

    schema_result = detect_schema(noaa_columns)
    mappings = {m["source_field"]: m for m in schema_result["mappings"]}

    # Auto Mapped 1-to-1 canonical matches
    assert mappings["EVENT_ID"]["status"] == "Auto Mapped"
    assert mappings["EVENT_ID"]["target_field"] == "incident_identifier"

    assert mappings["EVENT_TYPE"]["status"] == "Auto Mapped"
    assert mappings["EVENT_TYPE"]["target_field"] == "disaster_type"

    assert mappings["BEGIN_DATE_TIME"]["status"] == "Auto Mapped"
    assert mappings["BEGIN_DATE_TIME"]["target_field"] == "incident_timestamp"

    assert mappings["BEGIN_LAT"]["status"] == "Auto Mapped"
    assert mappings["BEGIN_LAT"]["target_field"] == "latitude"

    assert mappings["BEGIN_LON"]["status"] == "Auto Mapped"
    assert mappings["BEGIN_LON"]["target_field"] == "longitude"

    assert mappings["EVENT_NARRATIVE"]["status"] == "Auto Mapped"
    assert mappings["EVENT_NARRATIVE"]["target_field"] == "incident_description"

    assert mappings["SOURCE"]["status"] == "Auto Mapped"
    assert mappings["SOURCE"]["target_field"] == "responding_agency"

    # Derived / Transformed composite matches
    assert mappings["CZ_NAME"]["status"] == "Derived / Transformed"
    assert mappings["CZ_NAME"]["target_field"] == "incident_location"

    assert mappings["STATE"]["status"] == "Derived / Transformed"
    assert mappings["STATE"]["target_field"] == "incident_location"

    assert mappings["DEATHS_DIRECT"]["status"] == "Derived / Transformed"
    assert mappings["DEATHS_DIRECT"]["target_field"] == "reported_casualties"

    assert mappings["DEATHS_INDIRECT"]["status"] == "Derived / Transformed"
    assert mappings["DEATHS_INDIRECT"]["target_field"] == "reported_casualties"

    assert mappings["INJURIES_DIRECT"]["status"] == "Derived / Transformed"
    assert mappings["INJURIES_DIRECT"]["target_field"] == "injured_population"

    assert mappings["DAMAGE_PROPERTY"]["status"] == "Derived / Transformed"
    assert mappings["DAMAGE_PROPERTY"]["target_field"] == "estimated_loss"

    # Extra metadata / Unmapped (not labeled as errors)
    assert mappings["WFO"]["status"] == "Unmapped / Unsupported"
    assert mappings["WFO"]["is_extra_metadata"] is True

    assert mappings["DATA_SOURCE"]["status"] == "Unmapped / Unsupported"
    assert mappings["DATA_SOURCE"]["is_extra_metadata"] is True

    # Meteorological fields must NOT be assigned to priority_level
    assert mappings["MAGNITUDE"]["status"] == "Unmapped / Unsupported"
    assert mappings["MAGNITUDE"]["target_field"] is None

    assert mappings["TOR_F_SCALE"]["status"] == "Unmapped / Unsupported"
    assert mappings["TOR_F_SCALE"]["target_field"] is None


# ============================================================
# 2. DATE/TIME COMPOSITION TESTS
# ============================================================

def test_legitimate_datetime_composition_valid():
    """
    Test legitimate composition of timestamp from BEGIN_YEARMONTH, BEGIN_DAY, BEGIN_TIME.
    """
    # Standard format: YYYYMM, Day, HHMM
    assert compose_noaa_datetime(202503, 31, 1104) == "2025-03-31 11:04:00"
    assert compose_noaa_datetime("202501", "5", "1800") == "2025-01-05 18:00:00"

    # Midnight and single-digit minutes
    assert compose_noaa_datetime(202501, 1, 0) == "2025-01-01 00:00:00"
    assert compose_noaa_datetime(202501, 1, 5) == "2025-01-01 00:05:00"
    assert compose_noaa_datetime(202501, 1, 530) == "2025-01-01 05:30:00"
    assert compose_noaa_datetime(202512, 31, 2359) == "2025-12-31 23:59:00"

    # Leap year handling
    assert compose_noaa_datetime(202402, 29, 1200) == "2024-02-29 12:00:00"
    assert compose_noaa_datetime(202502, 29, 1200) is None  # 2025 is not a leap year


def test_datetime_composition_blocks_missing_or_invalid_components():
    """
    Verify that missing or invalid date/time components return None without fabricating values.
    """
    # Missing time component: DO NOT fabricate 00:00:00
    assert compose_noaa_datetime(202503, 31, None) is None
    assert compose_noaa_datetime(202503, 31, "") is None
    assert compose_noaa_datetime(202503, 31, float("nan")) is None

    # Missing day or yearmonth
    assert compose_noaa_datetime(None, 31, 1104) is None
    assert compose_noaa_datetime(202503, None, 1104) is None

    # Out of range / invalid calendar values
    assert compose_noaa_datetime(202513, 1, 1200) is None  # Month 13 invalid
    assert compose_noaa_datetime(202504, 31, 1200) is None  # April 31 invalid
    assert compose_noaa_datetime(202501, 0, 1200) is None  # Day 0 invalid
    assert compose_noaa_datetime(202501, 32, 1200) is None  # Day 32 invalid
    assert compose_noaa_datetime(202501, 1, 2400) is None  # Hour 24 invalid
    assert compose_noaa_datetime(202501, 1, 1260) is None  # Minute 60 invalid
    assert compose_noaa_datetime("not_a_date", 1, 1200) is None


def test_detect_schema_with_composite_datetime_columns():
    """
    Verify that detect_schema properly marks BEGIN_YEARMONTH, BEGIN_DAY, BEGIN_TIME as Derived
    when BEGIN_DATE_TIME is absent, and satisfies the incident_timestamp requirement.
    """
    cols_with_composition = [
        "EVENT_ID",
        "EVENT_TYPE",
        "BEGIN_YEARMONTH",
        "BEGIN_DAY",
        "BEGIN_TIME",
        "CZ_NAME",
        "BEGIN_LAT",
        "BEGIN_LON",
    ]

    schema_result = detect_schema(cols_with_composition)
    mappings = {m["source_field"]: m for m in schema_result["mappings"]}

    assert mappings["BEGIN_YEARMONTH"]["status"] == "Derived / Transformed"
    assert mappings["BEGIN_YEARMONTH"]["target_field"] == "incident_timestamp"

    assert mappings["BEGIN_DAY"]["status"] == "Derived / Transformed"
    assert mappings["BEGIN_DAY"]["target_field"] == "incident_timestamp"

    assert mappings["BEGIN_TIME"]["status"] == "Derived / Transformed"
    assert mappings["BEGIN_TIME"]["target_field"] == "incident_timestamp"

    assert "incident_timestamp" in schema_result["target_fields_detected"]

    # Required fields must be satisfied
    req = check_required_fields(schema_result)
    assert req["all_required_fields_present"] is True


def test_detect_schema_incomplete_datetime_does_not_satisfy_required():
    """
    Verify that if BEGIN_TIME is missing (only BEGIN_YEARMONTH and BEGIN_DAY present),
    incident_timestamp is NOT satisfied and required-field check fails.
    """
    cols_incomplete = [
        "EVENT_ID",
        "EVENT_TYPE",
        "BEGIN_YEARMONTH",
        "BEGIN_DAY",
        # BEGIN_TIME missing!
        "CZ_NAME",
    ]

    schema_result = detect_schema(cols_incomplete)
    mappings = {m["source_field"]: m for m in schema_result["mappings"]}

    # Incomplete components must not be derived into incident_timestamp
    assert mappings["BEGIN_YEARMONTH"]["status"] == "Unmapped / Unsupported"
    assert mappings["BEGIN_DAY"]["status"] == "Unmapped / Unsupported"

    assert "incident_timestamp" not in schema_result["target_fields_detected"]

    req = check_required_fields(schema_result)
    assert req["all_required_fields_present"] is False
    assert "incident_timestamp" in req["missing_required_fields"]


# ============================================================
# 3. AMBIGUOUS MAPPINGS & MANUAL VERIFICATION
# ============================================================

def test_ambiguous_mapping_without_hierarchy_flags_review():
    """
    Verify that genuine conflicting columns mapping to the same canonical target
    without a derivation or exact hierarchy get 'Manual Verification Required'.
    """
    # Two competing patient/shelter locations
    ambiguous_columns = [
        "disaster_type",
        "incident_timestamp",
        "first_location",
        "second_location",
    ]
    # Register test alias or test competing names
    schema_result = detect_schema([
        "event_id",
        "disaster_type",
        "incident_time",
        "district",
        "region",  # Both district and region map to incident_location without exact match
    ])

    mappings = {m["source_field"]: m for m in schema_result["mappings"]}
    # When district and region both compete for incident_location with no direct 'location' column
    district_status = mappings["district"]["status"]
    region_status = mappings["region"]["status"]
    assert district_status == "Manual Verification Required"
    assert region_status == "Manual Verification Required"


# ============================================================
# 4. STRICT REQUIRED-FIELD VALIDATION
# ============================================================

def test_strict_required_field_validation_missing_disaster_type():
    """
    Verify that missing disaster_type blocks validation and reports exact missing field.
    """
    cols = ["event_id", "location", "reported_time"]
    schema_result = detect_schema(cols)
    req = check_required_fields(schema_result)

    assert req["all_required_fields_present"] is False
    assert req["missing_required_fields"] == ["disaster_type"]


def test_strict_required_field_validation_missing_location():
    """
    Verify that missing location blocks validation and reports exact missing field.
    """
    cols = ["event_id", "disaster_type", "reported_time"]
    schema_result = detect_schema(cols)
    req = check_required_fields(schema_result)

    assert req["all_required_fields_present"] is False
    assert req["missing_required_fields"] == ["incident_location"]


# ============================================================
# 5. PRESERVATION OF MISSING VALUES & NO UNRELATED PRIORITY
# ============================================================

def test_no_unrelated_columns_assigned_to_priority_or_population():
    """
    Verify that meteorological scales (CATEGORY, MAGNITUDE, TOR_F_SCALE) and geometric sizes
    (TOR_LENGTH, TOR_WIDTH) are NEVER assigned to municipal dispatch priority or population.
    """
    cols = ["CATEGORY", "MAGNITUDE", "TOR_F_SCALE", "TOR_LENGTH", "TOR_WIDTH"]
    schema_result = detect_schema(cols)
    mappings = {m["source_field"]: m for m in schema_result["mappings"]}

    for c in cols:
        assert mappings[c]["status"] == "Unmapped / Unsupported"
        assert mappings[c]["target_field"] is None


def test_transformation_preserves_missing_casualties_and_losses():
    """
    Verify that compute_aggregated_casualties, injuries, and loss preserve nulls strictly as None.
    """
    empty_series = pd.Series({
        "DEATHS_DIRECT": None,
        "DEATHS_INDIRECT": None,
        "INJURIES_DIRECT": None,
        "INJURIES_INDIRECT": None,
        "DAMAGE_PROPERTY": None,
        "DAMAGE_CROPS": None,
    })

    assert compute_aggregated_casualties(empty_series, list(empty_series.keys()), None) is None
    assert compute_aggregated_injuries(empty_series, list(empty_series.keys()), None) is None
    assert compute_total_loss(empty_series, list(empty_series.keys()), None) is None
