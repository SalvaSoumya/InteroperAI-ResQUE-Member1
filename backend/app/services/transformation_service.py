import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

from app.services.schema_mapping_service import (
    detect_schema,
    check_required_fields,
    resolve_source_to_target,
    compose_noaa_datetime,
)


BASE_DIR = Path(__file__).resolve().parents[2]

PROCESSED_DIR = BASE_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Complete 20 canonical fields in standardized preference order
CANONICAL_COLUMNS = [
    "incident_identifier",
    "disaster_type",
    "incident_location",
    "priority_level",
    "affected_population",
    "reported_casualties",
    "incident_timestamp",
    "response_status",
    "latitude",
    "longitude",
    "incident_description",
    "injured_population",
    "displaced_population",
    "required_resources",
    "available_resources",
    "available_shelter_capacity",
    "current_shelter_occupancy",
    "responding_agency",
    "infrastructure_damage",
    "estimated_loss",
]


# ============================================================
# DATA CLEANING & STANDARDIZATION HELPERS
# ============================================================

def parse_damage_value(val: Any) -> Optional[float]:
    """
    Parse damage monetary values with suffixes (e.g. '1.00K', '25.00M', '1.5B', '0.00K', '0').
    Preserves missing values (NaN/None) strictly as None.
    Multipliers:
        K / k -> 1,000
        M / m -> 1,000,000
        B / b -> 1,000,000,000
        T / t -> 1,000,000,000,000
        H / h -> 100
    """
    if pd.isna(val):
        return None

    val_str = str(val).strip().upper()
    if not val_str or val_str in ["NAN", "NONE", "NULL", ""]:
        return None

    multiplier = 1.0
    if val_str.endswith("K"):
        multiplier = 1e3
        val_str = val_str[:-1].strip()
    elif val_str.endswith("M"):
        multiplier = 1e6
        val_str = val_str[:-1].strip()
    elif val_str.endswith("B"):
        multiplier = 1e9
        val_str = val_str[:-1].strip()
    elif val_str.endswith("T"):
        multiplier = 1e12
        val_str = val_str[:-1].strip()
    elif val_str.endswith("H"):
        multiplier = 1e2
        val_str = val_str[:-1].strip()

    try:
        return round(float(val_str) * multiplier, 2)
    except (ValueError, TypeError):
        return None


def standardize_timestamp_value(val: Any) -> Optional[str]:
    """
    Standardize datetime representations into ISO-8601 'YYYY-MM-DD HH:MM:SS'.
    Gracefully parses standard formats as well as NOAA formats (e.g. '31-MAR-25 11:04:00').
    Preserves missing values as None without inventing dates.
    """
    if pd.isna(val):
        return None

    val_str = str(val).strip()
    if not val_str or val_str.lower() in ["nan", "none", "null", ""]:
        return None

    # First attempt: direct parsing with dateutil/pandas
    try:
        dt = pd.to_datetime(val_str)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass

    # Second attempt: explicit NOAA format '%d-%b-%y %H:%M:%S'
    try:
        dt = datetime.strptime(val_str, "%d-%b-%y %H:%M:%S")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass

    # Fallback to stripped string if unparseable
    return val_str


def validate_coordinate(val: Any, min_val: float, max_val: float) -> Optional[float]:
    """
    Validate that latitude is within [-90.0, 90.0] and longitude within [-180.0, 180.0].
    Does NOT invent coordinates: if missing or out of range, preserves as None.
    """
    if pd.isna(val):
        return None
    try:
        f = float(val)
        if min_val <= f <= max_val:
            return round(f, 6)
        return None
    except (ValueError, TypeError):
        return None


def compute_combined_location(row: pd.Series, df_columns: List[str], mapped_val: Any) -> Optional[str]:
    """
    Carefully combine NOAA location fields (BEGIN_LOCATION, CZ_NAME, STATE)
    retaining state information, avoiding duplicate text or trailing commas.
    For other datasets, preserves the mapped source location column.
    """
    has_cz = any(c in df_columns for c in ["CZ_NAME", "cz_name"])
    has_state = any(c in df_columns for c in ["STATE", "state"])

    if has_cz or has_state:
        parts = []
        for col in ["BEGIN_LOCATION", "begin_location"]:
            if col in df_columns and pd.notna(row[col]):
                txt = str(row[col]).strip()
                if txt and txt.lower() not in ["nan", "none", "null"]:
                    parts.append(txt.title())
                break

        for col in ["CZ_NAME", "cz_name"]:
            if col in df_columns and pd.notna(row[col]):
                txt = str(row[col]).strip()
                if txt and txt.lower() not in ["nan", "none", "null"]:
                    t_title = txt.title()
                    if t_title not in parts:
                        parts.append(t_title)
                break

        for col in ["STATE", "state"]:
            if col in df_columns and pd.notna(row[col]):
                txt = str(row[col]).strip()
                if txt and txt.lower() not in ["nan", "none", "null"]:
                    t_title = txt.title()
                    if t_title not in parts:
                        parts.append(t_title)
                break

        if parts:
            return ", ".join(parts)

    if pd.notna(mapped_val):
        cleaned = str(mapped_val).strip()
        return cleaned if cleaned else None
    return None


def compute_aggregated_casualties(row: pd.Series, df_columns: List[str], mapped_val: Any) -> Optional[int]:
    """
    Aggregate direct and indirect deaths into reported casualties (DEATHS_DIRECT + DEATHS_INDIRECT).
    If only one or mapped value is available, preserves it cleanly.
    """
    deaths_direct = None
    deaths_indirect = None

    for col in ["DEATHS_DIRECT", "deaths_direct"]:
        if col in df_columns and pd.notna(row[col]):
            try:
                deaths_direct = int(float(row[col]))
            except (ValueError, TypeError):
                pass
            break

    for col in ["DEATHS_INDIRECT", "deaths_indirect"]:
        if col in df_columns and pd.notna(row[col]):
            try:
                deaths_indirect = int(float(row[col]))
            except (ValueError, TypeError):
                pass
            break

    if deaths_direct is not None or deaths_indirect is not None:
        return (deaths_direct or 0) + (deaths_indirect or 0)

    if pd.notna(mapped_val):
        try:
            return int(float(mapped_val))
        except (ValueError, TypeError):
            return mapped_val
    return None


def compute_aggregated_injuries(row: pd.Series, df_columns: List[str], mapped_val: Any) -> Optional[int]:
    """
    Aggregate direct and indirect injuries into injured population (INJURIES_DIRECT + INJURIES_INDIRECT).
    If only one or mapped value is available, preserves it cleanly.
    """
    injuries_direct = None
    injuries_indirect = None

    for col in ["INJURIES_DIRECT", "injuries_direct"]:
        if col in df_columns and pd.notna(row[col]):
            try:
                injuries_direct = int(float(row[col]))
            except (ValueError, TypeError):
                pass
            break

    for col in ["INJURIES_INDIRECT", "injuries_indirect"]:
        if col in df_columns and pd.notna(row[col]):
            try:
                injuries_indirect = int(float(row[col]))
            except (ValueError, TypeError):
                pass
            break

    if injuries_direct is not None or injuries_indirect is not None:
        return (injuries_direct or 0) + (injuries_indirect or 0)

    if pd.notna(mapped_val):
        try:
            return int(float(mapped_val))
        except (ValueError, TypeError):
            return mapped_val
    return None


def compute_total_loss(row: pd.Series, df_columns: List[str], mapped_val: Any) -> Optional[float]:
    """
    Compute total estimated economic loss.
    For NOAA datasets: aggregates property damage (DAMAGE_PROPERTY) and crop damage (DAMAGE_CROPS)
    after parsing suffixes ('K', 'M', 'B'). If both are missing, preserves as None.
    For other datasets: parses the mapped estimated_loss field directly.
    """
    has_prop = any(c in df_columns for c in ["DAMAGE_PROPERTY", "damage_property"])
    has_crop = any(c in df_columns for c in ["DAMAGE_CROPS", "damage_crops"])

    if has_prop or has_crop:
        prop_val = None
        crop_val = None
        for col in ["DAMAGE_PROPERTY", "damage_property"]:
            if col in df_columns:
                prop_val = parse_damage_value(row[col])
                break
        for col in ["DAMAGE_CROPS", "damage_crops"]:
            if col in df_columns:
                crop_val = parse_damage_value(row[col])
                break

        if prop_val is not None and crop_val is not None:
            return round(prop_val + crop_val, 2)
        elif prop_val is not None:
            return prop_val
        elif crop_val is not None:
            return crop_val
        return None

    return parse_damage_value(mapped_val)


# ============================================================
# MAIN TRANSFORMATION PIPELINE
# ============================================================

def transform_dataset(file_path: Path, job_id: str) -> dict:
    """
    Transform a disaster dataset into the standardized 20-field
    InteroperAI-ResQ disaster-response schema.

    - Combines location fields (e.g. NOAA CZ_NAME, STATE).
    - Aggregates direct and indirect casualties/injuries.
    - Parses damage value suffixes ('K', 'M', 'B') into numeric USD.
    - Standardizes timestamps to ISO-8601 without inventing dates.
    - Validates latitude/longitude bounds without inventing missing coords.
    - Keeps priority_level and affected_population strictly unassigned
      unless explicitly provided in the source.
    - Preserves compatibility for all other supported disaster datasets.
    """

    file_path = Path(file_path)
    extension = file_path.suffix.lower()

    # --------------------------------------------------------
    # 1. READ SOURCE DATASET
    # --------------------------------------------------------

    if extension == ".csv":
        df = pd.read_csv(file_path)
    elif extension == ".json":
        df = pd.read_json(file_path)
    else:
        raise ValueError("Only CSV and JSON files are supported.")

    if df.empty:
        raise ValueError("The uploaded dataset is empty.")

    # --------------------------------------------------------
    # 2. DETECT HETEROGENEOUS SCHEMA
    # --------------------------------------------------------

    schema_result = detect_schema(df.columns.tolist())

    # --------------------------------------------------------
    # 3. CHECK REQUIRED DISASTER FIELDS
    # --------------------------------------------------------

    required_result = check_required_fields(schema_result)

    if not required_result["all_required_fields_present"]:
        raise ValueError(
            "Required disaster-response information could not be detected. "
            f"Missing core fields: {required_result['missing_required_fields']}"
        )

    # --------------------------------------------------------
    # 4. RESOLVE AUTOMATIC MAPPINGS
    # --------------------------------------------------------

    resolved_mapping = resolve_source_to_target(df.columns.tolist())

    if not resolved_mapping:
        raise ValueError("No usable disaster-related fields could be automatically mapped.")

    source_columns = df.columns.tolist()
    target_to_source = {target: source for source, target in resolved_mapping.items()}

    # Check for direct or composite timestamp columns
    direct_ts_col = target_to_source.get("incident_timestamp")
    is_direct_ts = False
    if direct_ts_col:
        norm_ts = direct_ts_col.lower().replace("-", "_").replace(" ", "_")
        if norm_ts not in ["begin_yearmonth", "yearmonth", "begin_day", "day", "begin_time", "time"]:
            is_direct_ts = True

    ym_col = None
    day_col = None
    time_col = None
    for c in source_columns:
        norm_c = c.lower().replace("-", "_").replace(" ", "_")
        if norm_c in ["begin_yearmonth", "yearmonth"]:
            ym_col = c
        elif norm_c in ["begin_day", "day"]:
            day_col = c
        elif norm_c in ["begin_time", "time"]:
            time_col = c
    has_composite_datetime = bool(ym_col and day_col and time_col)

    # --------------------------------------------------------
    # 5. CREATE STANDARDIZED CANONICAL DATASET (20 FIELDS)
    # --------------------------------------------------------

    records = []
    for _, row in df.iterrows():
        record = {}

        # 1. incident_identifier
        id_col = target_to_source.get("incident_identifier")
        record["incident_identifier"] = str(row[id_col]).strip() if id_col and pd.notna(row[id_col]) else None

        # 2. disaster_type
        type_col = target_to_source.get("disaster_type")
        record["disaster_type"] = str(row[type_col]).strip() if type_col and pd.notna(row[type_col]) else None

        # 3. incident_location
        loc_col = target_to_source.get("incident_location")
        loc_val = row[loc_col] if loc_col else None
        record["incident_location"] = compute_combined_location(row, source_columns, loc_val)

        # 4. priority_level (kept unassigned / None until Member 2 assessment)
        prio_col = target_to_source.get("priority_level")
        record["priority_level"] = str(row[prio_col]).strip() if prio_col and pd.notna(row[prio_col]) else None

        # 5. affected_population (strictly None unless explicitly provided by source)
        aff_col = target_to_source.get("affected_population")
        if aff_col and pd.notna(row[aff_col]):
            try:
                record["affected_population"] = int(float(row[aff_col]))
            except (ValueError, TypeError):
                record["affected_population"] = row[aff_col]
        else:
            record["affected_population"] = None

        # 6. reported_casualties (direct + indirect deaths aggregated)
        cas_col = target_to_source.get("reported_casualties")
        cas_val = row[cas_col] if cas_col else None
        record["reported_casualties"] = compute_aggregated_casualties(row, source_columns, cas_val)

        # 7. incident_timestamp (ISO-8601 standardized via direct or composite NOAA)
        if is_direct_ts and direct_ts_col and pd.notna(row[direct_ts_col]):
            record["incident_timestamp"] = standardize_timestamp_value(row[direct_ts_col])
        elif has_composite_datetime:
            record["incident_timestamp"] = compose_noaa_datetime(row[ym_col], row[day_col], row[time_col])
        elif direct_ts_col and pd.notna(row[direct_ts_col]):
            record["incident_timestamp"] = standardize_timestamp_value(row[direct_ts_col])
        else:
            record["incident_timestamp"] = None

        # 8. response_status
        status_col = target_to_source.get("response_status")
        record["response_status"] = str(row[status_col]).strip() if status_col and pd.notna(row[status_col]) else None

        # 9. latitude (bounded to [-90.0, 90.0] without inventing missing)
        lat_col = target_to_source.get("latitude")
        record["latitude"] = validate_coordinate(row[lat_col], -90.0, 90.0) if lat_col else None

        # 10. longitude (bounded to [-180.0, 180.0] without inventing missing)
        lon_col = target_to_source.get("longitude")
        record["longitude"] = validate_coordinate(row[lon_col], -180.0, 180.0) if lon_col else None

        # 11. incident_description
        desc_col = target_to_source.get("incident_description")
        desc_val = None
        if desc_col and pd.notna(row[desc_col]):
            desc_val = str(row[desc_col]).strip()
        elif "EVENT_NARRATIVE" in source_columns and pd.notna(row["EVENT_NARRATIVE"]):
            desc_val = str(row["EVENT_NARRATIVE"]).strip()
        elif "EPISODE_NARRATIVE" in source_columns and pd.notna(row["EPISODE_NARRATIVE"]):
            desc_val = str(row["EPISODE_NARRATIVE"]).strip()
        record["incident_description"] = desc_val if desc_val else None

        # 12. injured_population (direct + indirect injuries aggregated)
        inj_col = target_to_source.get("injured_population")
        inj_val = row[inj_col] if inj_col else None
        record["injured_population"] = compute_aggregated_injuries(row, source_columns, inj_val)

        # 13. displaced_population
        disp_col = target_to_source.get("displaced_population")
        if disp_col and pd.notna(row[disp_col]):
            try:
                record["displaced_population"] = int(float(row[disp_col]))
            except (ValueError, TypeError):
                record["displaced_population"] = row[disp_col]
        else:
            record["displaced_population"] = None

        # 14. required_resources
        req_res_col = target_to_source.get("required_resources")
        record["required_resources"] = str(row[req_res_col]).strip() if req_res_col and pd.notna(row[req_res_col]) else None

        # 15. available_resources
        avail_res_col = target_to_source.get("available_resources")
        record["available_resources"] = str(row[avail_res_col]).strip() if avail_res_col and pd.notna(row[avail_res_col]) else None

        # 16. available_shelter_capacity
        shelter_cap_col = target_to_source.get("available_shelter_capacity")
        if shelter_cap_col and pd.notna(row[shelter_cap_col]):
            try:
                record["available_shelter_capacity"] = int(float(row[shelter_cap_col]))
            except (ValueError, TypeError):
                record["available_shelter_capacity"] = row[shelter_cap_col]
        else:
            record["available_shelter_capacity"] = None

        # 17. current_shelter_occupancy
        shelter_occ_col = target_to_source.get("current_shelter_occupancy")
        if shelter_occ_col and pd.notna(row[shelter_occ_col]):
            try:
                record["current_shelter_occupancy"] = int(float(row[shelter_occ_col]))
            except (ValueError, TypeError):
                record["current_shelter_occupancy"] = row[shelter_occ_col]
        else:
            record["current_shelter_occupancy"] = None

        # 18. responding_agency
        agency_col = target_to_source.get("responding_agency")
        agency_val = None
        if agency_col and pd.notna(row[agency_col]):
            agency_val = str(row[agency_col]).strip()
        elif "SOURCE" in source_columns and pd.notna(row["SOURCE"]):
            agency_val = str(row["SOURCE"]).strip()
        record["responding_agency"] = agency_val if agency_val else None

        # 19. infrastructure_damage
        infra_col = target_to_source.get("infrastructure_damage")
        record["infrastructure_damage"] = str(row[infra_col]).strip() if infra_col and pd.notna(row[infra_col]) else None

        # 20. estimated_loss (property + crop damage parsed and aggregated)
        loss_col = target_to_source.get("estimated_loss")
        loss_val = row[loss_col] if loss_col else None
        record["estimated_loss"] = compute_total_loss(row, source_columns, loss_val)

        records.append(record)

    transformed_df = pd.DataFrame(records, columns=CANONICAL_COLUMNS)

    # --------------------------------------------------------
    # 6. SAVE PROCESSED DATASET
    # --------------------------------------------------------

    output_file = PROCESSED_DIR / f"{job_id}_processed.csv"
    transformed_df.to_csv(output_file, index=False)

    # --------------------------------------------------------
    # 7. CREATE MAPPING SUMMARY
    # --------------------------------------------------------

    mapping_details = schema_result["mappings"]
    automatic_mappings = [m for m in mapping_details if m["status"] == "Auto Mapped"]
    derived_mappings = [m for m in mapping_details if m["status"] == "Derived / Transformed"]
    unknown_fields = [m for m in mapping_details if m["status"] in ["Unmapped / Unsupported", "Unknown"]]
    review_fields = [m for m in mapping_details if m["status"] in ["Manual Verification Required", "Needs Review"]]

    mapped_target_fields = set(resolved_mapping.values())
    unmapped_canonical_fields = [
        col for col in CANONICAL_COLUMNS if col not in mapped_target_fields
    ]
    unsupported_source_fields = [
        m["source_field"] for m in mapping_details if m["status"] in ["Unmapped / Unsupported", "Unknown"]
    ]

    # --------------------------------------------------------
    # 8. RETURN COMPLETE RESULT
    # --------------------------------------------------------

    return {
        "job_id": job_id,
        "status": "completed",
        "source_rows": len(df),
        "source_columns": len(df.columns),
        "processed_rows": len(transformed_df),
        "processed_columns": len(transformed_df.columns),
        "automatic_mappings": len(automatic_mappings),
        "derived_mappings": len(derived_mappings),
        "unknown_fields": len(unknown_fields),
        "unmapped_fields": len(unknown_fields),
        "review_fields": len(review_fields),
        "source_fields": df.columns.tolist(),
        "target_fields": transformed_df.columns.tolist(),
        "mapping_details": mapping_details,
        "unmapped_canonical_fields": unmapped_canonical_fields,
        "unsupported_source_fields": unsupported_source_fields,
        "required_fields": required_result["required_fields"],
        "missing_required_fields": required_result["missing_required_fields"],
        "output_file": str(output_file),
        "output_filename": os.path.basename(output_file),
        "preview": transformed_df.head(5).to_dict(orient="records"),
    }