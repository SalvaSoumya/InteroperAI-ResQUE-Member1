import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Set, Tuple


# ============================================================
# COMMON DISASTER-RESPONSE SCHEMA (20 CANONICAL FIELDS)
# ============================================================

COMMON_SCHEMA = {
    "incident_identifier": {
        "canonical": "incident_id",
        "aliases": [
            "incident_id",
            "incident_identifier",
            "incident_number",
            "incident_no",
            "event_id",
            "event_identifier",
            "event_number",
            "case_id",
            "case_number",
            "disaster_id",
            "disaster_identifier",
        ],
    },

    "disaster_type": {
        "canonical": "incident_type",
        "aliases": [
            "incident_type",
            "incident",
            "disaster",
            "disaster_type",
            "disaster_category",
            "event_type",
            "event_category",
            "hazard_type",
            "hazard_category",
            "emergency_type",
        ],
    },

    "incident_location": {
        "canonical": "location",
        "aliases": [
            "location",
            "incident_location",
            "event_location",
            "disaster_location",
            "area",
            "place",
            "region",
            "district",
            "city",
            "town",
            "village",
            "locality",
            "affected_area",
            "cz_name",
            "begin_location",
        ],
    },

    "priority_level": {
        "canonical": "severity",
        "aliases": [
            "severity",
            "severity_level",
            "risk_level",
            "danger_level",
            "priority",
            "priority_level",
            "criticality",
            "impact_level",
            "threat_level",
        ],
    },

    "affected_population": {
        "canonical": "affected_people",
        "aliases": [
            "affected_people",
            "people_affected",
            "affected_population",
            "population_affected",
            "affected_persons",
            "people_impacted",
            "population_impacted",
            "victims",
            "victim_count",
            "affected_count",
        ],
    },

    "reported_casualties": {
        "canonical": "casualties",
        "aliases": [
            "casualties",
            "casualty_count",
            "casualties_count",
            "reported_casualties",
            "death_count",
            "deaths",
            "fatalities",
            "fatality_count",
            "deaths_direct",
            "deaths_indirect",
        ],
    },

    "incident_timestamp": {
        "canonical": "reported_time",
        "aliases": [
            "reported_time",
            "report_time",
            "reported_at",
            "event_time",
            "event_timestamp",
            "incident_time",
            "incident_timestamp",
            "timestamp",
            "date_time",
            "datetime",
            "time_reported",
            "occurrence_time",
            "occurrence_timestamp",
            "begin_date_time",
        ],
    },

    "response_status": {
        "canonical": "response_status",
        "aliases": [
            "response_status",
            "response_state",
            "status",
            "incident_status",
            "emergency_status",
            "operation_status",
            "response_stage",
            "case_status",
        ],
    },

    "latitude": {
        "canonical": "latitude",
        "aliases": [
            "latitude",
            "lat",
            "geo_latitude",
            "gps_latitude",
            "y_coordinate",
            "begin_lat",
        ],
    },

    "longitude": {
        "canonical": "longitude",
        "aliases": [
            "longitude",
            "lon",
            "lng",
            "geo_longitude",
            "gps_longitude",
            "x_coordinate",
            "begin_lon",
        ],
    },

    "incident_description": {
        "canonical": "description",
        "aliases": [
            "description",
            "incident_description",
            "event_description",
            "disaster_description",
            "details",
            "incident_details",
            "event_details",
            "remarks",
            "notes",
            "summary",
            "event_narrative",
        ],
    },

    "injured_population": {
        "canonical": "injured_people",
        "aliases": [
            "injured_people",
            "injured_persons",
            "injured_population",
            "injury_count",
            "injured_count",
            "people_injured",
            "persons_injured",
            "injuries",
            "injuries_direct",
            "injuries_indirect",
        ],
    },

    "displaced_population": {
        "canonical": "displaced_people",
        "aliases": [
            "displaced_people",
            "people_displaced",
            "displaced_population",
            "displaced_persons",
            "evacuated_people",
            "evacuated_population",
            "evacuees",
            "evacuee_count",
        ],
    },

    "required_resources": {
        "canonical": "resources_required",
        "aliases": [
            "resources_required",
            "required_resources",
            "resources_needed",
            "resource_needs",
            "resources_requested",
            "requested_resources",
            "required_aid",
            "aid_required",
        ],
    },

    "available_resources": {
        "canonical": "resources_available",
        "aliases": [
            "resources_available",
            "available_resources",
            "resources_on_hand",
            "available_aid",
            "aid_available",
            "resource_stock",
            "resource_inventory",
        ],
    },

    "available_shelter_capacity": {
        "canonical": "shelter_capacity",
        "aliases": [
            "shelter_capacity",
            "available_shelter_capacity",
            "shelter_limit",
            "shelter_max_capacity",
            "maximum_shelter_capacity",
            "total_shelter_capacity",
            "camp_capacity",
            "refuge_capacity",
        ],
    },

    "current_shelter_occupancy": {
        "canonical": "shelter_occupancy",
        "aliases": [
            "shelter_occupancy",
            "current_shelter_occupancy",
            "shelter_occupied",
            "occupied_shelter",
            "shelter_population",
            "people_in_shelter",
            "current_occupancy",
            "camp_occupancy",
        ],
    },

    "responding_agency": {
        "canonical": "responding_agency",
        "aliases": [
            "responding_agency",
            "agency",
            "agency_name",
            "response_agency",
            "response_organization",
            "responding_organization",
            "organization",
            "department",
            "authority",
            "source",
        ],
    },

    "infrastructure_damage": {
        "canonical": "infrastructure_damage",
        "aliases": [
            "infrastructure_damage",
            "infrastructure_impact",
            "property_damage",
            "structural_damage",
            "building_damage",
            "damage_level",
            "damage_assessment",
        ],
    },

    "estimated_loss": {
        "canonical": "estimated_loss",
        "aliases": [
            "estimated_loss",
            "estimated_damage",
            "economic_loss",
            "financial_loss",
            "loss_estimate",
            "damage_cost",
            "estimated_cost",
            "economic_impact",
            "damage_property",
            "damage_crops",
        ],
    },
}


# ============================================================
# NORMALIZATION
# ============================================================

def normalize_field_name(field_name: str) -> str:
    """
    Convert different column naming styles into a common
    lowercase snake_case comparison format.
    """
    value = str(field_name).strip().lower()
    value = re.sub(r"([a-z])([A-Z])", r"\1_\2", value)
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value)
    return value.strip("_")


# ============================================================
# BUILD ALIAS LOOKUP
# ============================================================

def build_alias_lookup() -> Dict[str, List[str]]:
    """
    Create a reverse lookup: normalized alias -> list of target canonical fields.
    """
    lookup = {}
    for target_field, definition in COMMON_SCHEMA.items():
        aliases = set(definition["aliases"])
        aliases.add(definition["canonical"])
        aliases.add(target_field)

        for alias in aliases:
            norm = normalize_field_name(alias)
            if norm not in lookup:
                lookup[norm] = []
            if target_field not in lookup[norm]:
                lookup[norm].append(target_field)

    return lookup


ALIAS_LOOKUP = build_alias_lookup()


# ============================================================
# NOAA COMPOSITE DATE/TIME VALIDATION HELPER
# ============================================================

def compose_noaa_datetime(yearmonth: Any, day: Any, time_val: Any) -> Optional[str]:
    """
    Safely compose timestamp from BEGIN_YEARMONTH, BEGIN_DAY, BEGIN_TIME.
    Must produce a valid ISO-8601 string 'YYYY-MM-DD HH:MM:SS'.
    Does NOT fabricate missing components; returns None if any component is invalid or missing.
    """
    if yearmonth is None or day is None or time_val is None:
        return None
    try:
        # Check for NaN / string NaN
        s_ym = str(yearmonth).strip()
        s_d = str(day).strip()
        s_t = str(time_val).strip()
        if not s_ym or not s_d or not s_t or any(x.lower() in ["nan", "none", "null", ""] for x in [s_ym, s_d, s_t]):
            return None

        ym_int = int(float(s_ym))
        day_int = int(float(s_d))
        time_int = int(float(s_t))
    except (ValueError, TypeError):
        return None

    ym_str = f"{ym_int:06d}"
    if len(ym_str) != 6:
        return None

    try:
        year = int(ym_str[:4])
        month = int(ym_str[4:6])
        if not (1 <= month <= 12):
            return None
        if not (1 <= day_int <= 31):
            return None

        # Format time as 4 digits HHMM
        if not (0 <= time_int <= 2359):
            return None
        time_str = f"{time_int:04d}"
        if len(time_str) != 4:
            return None
        hour = int(time_str[:2])
        minute = int(time_str[2:4])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return None

        dt = datetime(year, month, day_int, hour, minute, 0)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError, OverflowError):
        return None


# ============================================================
# DATASET-LEVEL SCHEMA DETECTION & CLASSIFICATION
# ============================================================

def detect_schema(source_columns: List[str]) -> Dict[str, Any]:
    """
    Analyze every source column and determine its corresponding common
    disaster-response field and mapping status.

    Returns one of four exact statuses for each column:
      - 'Auto Mapped'
      - 'Derived / Transformed'
      - 'Manual Verification Required'
      - 'Unmapped / Unsupported'
    """
    normalized_to_source = {normalize_field_name(c): c for c in source_columns}
    normalized_set = set(normalized_to_source.keys())

    # --------------------------------------------------------
    # 1. CHECK COMPOSITE DERIVATION CAPABILITIES
    # --------------------------------------------------------

    # Check Date/Time composition: BEGIN_YEARMONTH + BEGIN_DAY + BEGIN_TIME
    has_ym = any(k in normalized_set for k in ["begin_yearmonth", "yearmonth"])
    has_day = any(k in normalized_set for k in ["begin_day", "day"])
    has_time = any(k in normalized_set for k in ["begin_time", "time"])

    # Direct authoritative timestamp check
    direct_timestamp_present = any(
        k in normalized_set
        for k in ["begin_date_time", "reported_time", "incident_timestamp", "timestamp", "datetime", "date_time", "event_timestamp"]
    )

    can_derive_datetime = bool(has_ym and has_day and has_time and not direct_timestamp_present)
    incomplete_datetime_present = bool((has_ym or has_day or has_time) and not can_derive_datetime and not direct_timestamp_present)

    # Check Location combination: CZ_NAME, STATE, BEGIN_LOCATION
    has_direct_location = any(k in normalized_set for k in ["location", "incident_location", "disaster_location"])
    has_cz_name = any(k in normalized_set for k in ["cz_name"])
    has_begin_loc = any(k in normalized_set for k in ["begin_location"])
    has_state = any(k in normalized_set for k in ["state"])

    can_derive_location = bool((has_cz_name or has_begin_loc) and not has_direct_location)

    # Check Casualties aggregation: DEATHS_DIRECT + DEATHS_INDIRECT
    has_deaths_direct = "deaths_direct" in normalized_set
    has_deaths_indirect = "deaths_indirect" in normalized_set
    can_derive_casualties = bool(has_deaths_direct and has_deaths_indirect)

    # Check Injuries aggregation: INJURIES_DIRECT + INJURIES_INDIRECT
    has_injuries_direct = "injuries_direct" in normalized_set
    has_injuries_indirect = "injuries_indirect" in normalized_set
    can_derive_injuries = bool(has_injuries_direct and has_injuries_indirect)

    # Check Loss aggregation: DAMAGE_PROPERTY + DAMAGE_CROPS
    has_damage_property = "damage_property" in normalized_set
    has_damage_crops = "damage_crops" in normalized_set
    can_derive_loss = bool(has_damage_property and has_damage_crops)

    # --------------------------------------------------------
    # 2. EVALUATE EACH SOURCE COLUMN
    # --------------------------------------------------------
    mappings = []
    target_to_sources: Dict[str, List[str]] = {}

    for source_field in source_columns:
        norm = normalize_field_name(source_field)

        # ----------------------------------------------------
        # Rule A: Composite Date/Time fields
        # ----------------------------------------------------
        if norm in ["begin_yearmonth", "yearmonth", "begin_day", "day", "begin_time", "time"]:
            if can_derive_datetime:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "incident_timestamp",
                    "canonical_source_field": "reported_time",
                    "status": "Derived / Transformed",
                    "confidence": 0.95,
                    "reason": "Legitimate composite date/time transformation from YEARMONTH, DAY, and TIME components",
                    "transformation_rule": "Composed into canonical incident_timestamp (YYYY-MM-DD HH:MM:SS)",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("incident_timestamp", []).append(source_field)
                continue
            elif direct_timestamp_present:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": None,
                    "canonical_source_field": None,
                    "status": "Unmapped / Unsupported",
                    "confidence": 0.0,
                    "reason": "Superseded by authoritative BEGIN_DATE_TIME timestamp; preserved as source metadata",
                    "transformation_rule": "Preserved in source metadata",
                    "is_extra_metadata": True,
                })
                continue
            else:
                # Incomplete components: e.g. time is missing. Do NOT fabricate missing time!
                missing_parts = []
                if not has_ym: missing_parts.append("BEGIN_YEARMONTH")
                if not has_day: missing_parts.append("BEGIN_DAY")
                if not has_time: missing_parts.append("BEGIN_TIME")
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": None,
                    "canonical_source_field": None,
                    "status": "Unmapped / Unsupported",
                    "confidence": 0.0,
                    "reason": f"Incomplete date/time components (missing {', '.join(missing_parts)}). Cannot fabricate missing time.",
                    "transformation_rule": "Preserved in source metadata",
                    "is_extra_metadata": True,
                })
                continue

        # ----------------------------------------------------
        # Rule B: Composite Location fields (CZ_NAME, BEGIN_LOCATION, STATE)
        # ----------------------------------------------------
        if norm in ["cz_name", "begin_location"]:
            if can_derive_location:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "incident_location",
                    "canonical_source_field": "location",
                    "status": "Derived / Transformed",
                    "confidence": 0.95,
                    "reason": "Combined with county/state location hierarchy into canonical incident_location",
                    "transformation_rule": "Combined into incident_location (Location, County, State)",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("incident_location", []).append(source_field)
                continue
            elif has_direct_location:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": None,
                    "canonical_source_field": None,
                    "status": "Unmapped / Unsupported",
                    "confidence": 0.0,
                    "reason": "Superseded by primary incident_location column; preserved as auxiliary location metadata",
                    "transformation_rule": "Preserved in source metadata",
                    "is_extra_metadata": True,
                })
                continue

        if norm == "state":
            if can_derive_location:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "incident_location",
                    "canonical_source_field": "location",
                    "status": "Derived / Transformed",
                    "confidence": 0.90,
                    "reason": "State geographic context contributing to canonical incident_location",
                    "transformation_rule": "Combined into incident_location hierarchy",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("incident_location", []).append(source_field)
                continue

        # ----------------------------------------------------
        # Rule C: Composite Casualties (DEATHS_DIRECT, DEATHS_INDIRECT)
        # ----------------------------------------------------
        if norm in ["deaths_direct", "deaths_indirect"]:
            if can_derive_casualties:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "reported_casualties",
                    "canonical_source_field": "casualties",
                    "status": "Derived / Transformed",
                    "confidence": 0.95,
                    "reason": "Aggregated direct and indirect deaths into reported_casualties",
                    "transformation_rule": "DEATHS_DIRECT + DEATHS_INDIRECT aggregated",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("reported_casualties", []).append(source_field)
                continue

        # ----------------------------------------------------
        # Rule D: Composite Injuries (INJURIES_DIRECT, INJURIES_INDIRECT)
        # ----------------------------------------------------
        if norm in ["injuries_direct", "injuries_indirect"]:
            if can_derive_injuries:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "injured_population",
                    "canonical_source_field": "injured_people",
                    "status": "Derived / Transformed",
                    "confidence": 0.95,
                    "reason": "Aggregated direct and indirect injuries into injured_population",
                    "transformation_rule": "INJURIES_DIRECT + INJURIES_INDIRECT aggregated",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("injured_population", []).append(source_field)
                continue

        # ----------------------------------------------------
        # Rule E: Composite Economic Loss (DAMAGE_PROPERTY, DAMAGE_CROPS)
        # ----------------------------------------------------
        if norm in ["damage_property", "damage_crops"]:
            if can_derive_loss:
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "estimated_loss",
                    "canonical_source_field": "estimated_loss",
                    "status": "Derived / Transformed",
                    "confidence": 0.95,
                    "reason": "Parsed damage suffixes ('K','M','B') and aggregated property & crop damage",
                    "transformation_rule": "DAMAGE_PROPERTY + DAMAGE_CROPS parsed and summed",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("estimated_loss", []).append(source_field)
                continue
            elif norm == "damage_property":
                mappings.append({
                    "source_field": source_field,
                    "normalized_field": norm,
                    "target_field": "estimated_loss",
                    "canonical_source_field": "estimated_loss",
                    "status": "Derived / Transformed",
                    "confidence": 0.90,
                    "reason": "Parsed monetary damage suffixes ('K','M','B') into numeric USD",
                    "transformation_rule": "Parsed property damage value",
                    "is_extra_metadata": False,
                })
                target_to_sources.setdefault("estimated_loss", []).append(source_field)
                continue

        # ----------------------------------------------------
        # Rule F: Description Disambiguation (EVENT_NARRATIVE vs EPISODE_NARRATIVE)
        # ----------------------------------------------------
        if norm == "episode_narrative" and "event_narrative" in normalized_set:
            mappings.append({
                "source_field": source_field,
                "normalized_field": norm,
                "target_field": None,
                "canonical_source_field": None,
                "status": "Unmapped / Unsupported",
                "confidence": 0.0,
                "reason": "Superseded by event-level narrative (EVENT_NARRATIVE); preserved as episode context metadata",
                "transformation_rule": "Preserved in source metadata",
                "is_extra_metadata": True,
            })
            continue

        # ----------------------------------------------------
        # Rule G: Reporting Source Disambiguation (SOURCE vs DATA_SOURCE)
        # ----------------------------------------------------
        if norm == "data_source":
            mappings.append({
                "source_field": source_field,
                "normalized_field": norm,
                "target_field": None,
                "canonical_source_field": None,
                "status": "Unmapped / Unsupported",
                "confidence": 0.0,
                "reason": "Dataset format tag (e.g. CSV); preserved as source intake metadata",
                "transformation_rule": "Preserved in source metadata",
                "is_extra_metadata": True,
            })
            continue

        # ----------------------------------------------------
        # Rule H: Exclude Meteorological scales from Priority Level / Population
        # ----------------------------------------------------
        if norm in [
            "magnitude", "magnitude_type", "tor_f_scale", "category",
            "flood_cause", "tor_length", "tor_width", "cz_type", "cz_fips",
            "wfo", "cz_timezone", "state_fips", "episode_id", "year", "month_name"
        ]:
            mappings.append({
                "source_field": source_field,
                "normalized_field": norm,
                "target_field": None,
                "canonical_source_field": None,
                "status": "Unmapped / Unsupported",
                "confidence": 0.0,
                "reason": "Meteorological / administrative attribute; preserved as extra source metadata (not assigned to dispatch priority or casualties)",
                "transformation_rule": "Preserved in source metadata",
                "is_extra_metadata": True,
            })
            continue

        # ----------------------------------------------------
        # Rule I: Standard Semantic Lookup
        # ----------------------------------------------------
        possible_targets = ALIAS_LOOKUP.get(norm, [])

        if not possible_targets:
            mappings.append({
                "source_field": source_field,
                "normalized_field": norm,
                "target_field": None,
                "canonical_source_field": None,
                "status": "Unmapped / Unsupported",
                "confidence": 0.0,
                "reason": "Source attribute preserved as extra metadata; not required by 20-field canonical schema",
                "transformation_rule": "Preserved in source metadata",
                "is_extra_metadata": True,
            })
            continue

        if len(possible_targets) == 1:
            target_field = possible_targets[0]
            mappings.append({
                "source_field": source_field,
                "normalized_field": norm,
                "target_field": target_field,
                "canonical_source_field": COMMON_SCHEMA[target_field]["canonical"],
                "status": "Auto Mapped",
                "confidence": 1.0,
                "reason": f"Direct 1-to-1 semantic match to canonical {target_field}",
                "transformation_rule": f"Direct mapping to {target_field}",
                "is_extra_metadata": False,
            })
            target_to_sources.setdefault(target_field, []).append(source_field)
            continue

        # Ambiguous column with multiple possible target meanings
        mappings.append({
            "source_field": source_field,
            "normalized_field": norm,
            "target_field": None,
            "canonical_source_field": None,
            "status": "Manual Verification Required",
            "confidence": 0.0,
            "possible_targets": possible_targets,
            "reason": f"Ambiguous source field: matches multiple possible canonical fields ({', '.join(possible_targets)}). Verification required.",
            "transformation_rule": "Manual selection required",
            "is_extra_metadata": False,
        })

    # --------------------------------------------------------
    # 3. CONFLICT CHECK FOR UNRESOLVED MULTI-SOURCES TO SAME TARGET
    # --------------------------------------------------------
    target_to_auto_mappings: Dict[str, List[Dict[str, Any]]] = {}
    for mapping in mappings:
        if mapping.get("status") == "Auto Mapped" and mapping.get("target_field"):
            target_to_auto_mappings.setdefault(mapping["target_field"], []).append(mapping)

    for target, auto_maps in target_to_auto_mappings.items():
        if len(auto_maps) > 1:
            canonical_name = COMMON_SCHEMA.get(target, {}).get("canonical", "")
            exact_matches = [
                m for m in auto_maps
                if normalize_field_name(m["source_field"]) in [target, canonical_name]
            ]
            if len(exact_matches) == 1:
                exact_m = exact_matches[0]
                for m in auto_maps:
                    if m is exact_m:
                        m["status"] = "Auto Mapped"
                        m["confidence"] = 1.0
                        m["reason"] = f"Exact semantic match takes precedence for {target}"
                    else:
                        m["status"] = "Unmapped / Unsupported"
                        m["target_field"] = None
                        m["confidence"] = 0.0
                        m["reason"] = f"Superseded by primary column '{exact_m['source_field']}'; preserved as extra metadata"
                        m["is_extra_metadata"] = True
            else:
                competing_names = [m["source_field"] for m in auto_maps]
                for m in auto_maps:
                    m["status"] = "Manual Verification Required"
                    m["confidence"] = 0.0
                    m["reason"] = f"Competing source fields ({', '.join(competing_names)}) map to '{target}' without derivation hierarchy. Verification required."

    # --------------------------------------------------------
    # 4. SUMMARY STATISTICS
    # --------------------------------------------------------
    auto_mapped_fields = [m for m in mappings if m["status"] == "Auto Mapped"]
    derived_fields = [m for m in mappings if m["status"] == "Derived / Transformed"]
    review_fields = [m for m in mappings if m["status"] == "Manual Verification Required"]
    unmapped_fields = [m for m in mappings if m["status"] == "Unmapped / Unsupported"]

    # Target fields that are satisfied (either Auto Mapped or Derived / Transformed)
    satisfied_targets: Set[str] = set()
    for m in mappings:
        if m["status"] in ["Auto Mapped", "Derived / Transformed"] and m.get("target_field"):
            satisfied_targets.add(m["target_field"])

    return {
        "mappings": mappings,
        "total_source_fields": len(source_columns),
        "mapped_fields": len(auto_mapped_fields),
        "derived_fields": len(derived_fields),
        "review_fields": len(review_fields),
        "unknown_fields": len(unmapped_fields),
        "unmapped_fields": len(unmapped_fields),
        "target_fields_detected": sorted(list(satisfied_targets)),
    }


# ============================================================
# REQUIRED FIELD CHECK
# ============================================================

CORE_REQUIRED_FIELDS = [
    "disaster_type",
    "incident_location",
    "incident_timestamp",
]

REQUIRED_TARGET_FIELDS = CORE_REQUIRED_FIELDS


def check_required_fields(schema_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check whether the uploaded dataset contains all core information
    needed for disaster data intake and integration.

    Core intake fields are: disaster_type, incident_location, and incident_timestamp.
    Fields can be satisfied through 'Auto Mapped' or 'Derived / Transformed'.
    If any core field cannot be safely obtained, integration is blocked.
    """
    detected_targets = set(schema_result["target_fields_detected"])

    missing = [
        field
        for field in REQUIRED_TARGET_FIELDS
        if field not in detected_targets
    ]

    present = [
        field
        for field in REQUIRED_TARGET_FIELDS
        if field in detected_targets
    ]

    return {
        "required_fields": REQUIRED_TARGET_FIELDS,
        "missing_required_fields": missing,
        "present_required_fields": present,
        "all_required_fields_present": len(missing) == 0,
    }


# ============================================================
# RESOLVE MAPPING FOR TRANSFORMATION
# ============================================================

def resolve_source_to_target(source_columns: List[str]) -> Dict[str, str]:
    """
    Return:
        source column -> common target column

    Returns confident automatic and derived mappings.
    Ambiguous (Manual Verification Required) and Unmapped fields are excluded.
    """
    schema_result = detect_schema(source_columns)
    resolved = {}

    for mapping in schema_result["mappings"]:
        if mapping["status"] not in ["Auto Mapped", "Derived / Transformed"]:
            continue

        source_field = mapping["source_field"]
        target_field = mapping.get("target_field")
        if target_field:
            resolved[source_field] = target_field

    return resolved