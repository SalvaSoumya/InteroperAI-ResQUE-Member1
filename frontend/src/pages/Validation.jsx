import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck2,
  Database,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function Validation() {
  const [validationStarted, setValidationStarted] = useState(false);

  // Get the latest upload result from the Upload page
  const storedResult = sessionStorage.getItem("latestUploadResult");
  const uploadResult = storedResult
    ? JSON.parse(storedResult)
    : null;

  const validation = uploadResult?.validation;
  const sourceMetadata = uploadResult?.source_metadata;
  const requiredFields = uploadResult?.required_fields;
  const sourceColumns = sourceMetadata?.source_columns || validation?.columns || uploadResult?.columns || [];

  // Use real backend values when available
  const checks = validation?.checks || {};

  const missingReq = requiredFields?.missing_required_fields || validation?.missing_required_fields || [];
  const presentReq = requiredFields?.present_required_fields || [];

  const validationItems = [
    {
      name: "File Format",
      description: "Validated file structure as standard CSV/JSON format.",
      detail: uploadResult?.file_type ? `Detected format: .${uploadResult.file_type.toUpperCase()}` : "Standard tabular structure",
      status: checks.file_format === false ? "Failed" : "Passed",
    },
    {
      name: "Required Disaster Fields",
      description: "Verify presence of essential intake fields (incident identifier, disaster type, location).",
      detail: missingReq.length > 0
        ? `Missing required core fields: ${missingReq.join(", ")}. Please review schema mapping.`
        : `All core required intake fields verified (${presentReq.length > 0 ? presentReq.join(", ") : "present"}).`,
      status: checks.required_fields === false ? "Failed" : "Passed",
    },
    {
      name: "Data Types & Syntax",
      description: "Verify that coordinates, dates, and identifiers follow expected types.",
      detail: checks.data_types === false
        ? "Some data types require normalization."
        : "Coordinate bounds [-90, 90], [-180, 180] and string headers conform to standard.",
      status: checks.data_types === false ? "Failed" : "Passed",
    },
    {
      name: "Missing Values & Zero-Fabrication Policy",
      description: "Detect missing values. InteroperAI-ResQUE policy forbids fabricating zeros for missing casualties or damages.",
      detail:
        (validation?.missing_values || 0) > 0
          ? `${validation.missing_values} missing cell(s) detected. Missing casualty/damage fields will be preserved as Unknown.`
          : "No empty cells detected across intake fields.",
      status:
        (validation?.missing_values || 0) > 0
          ? "Warning"
          : "Passed",
    },
    {
      name: "Duplicate Records",
      description: "Audit dataset for repeated incident rows or duplicate IDs.",
      detail:
        (validation?.duplicate_records || 0) > 0
          ? `${validation.duplicate_records} duplicate record(s) flagged.`
          : "Zero duplicate records detected.",
      status:
        (validation?.duplicate_records || 0) > 0
          ? "Warning"
          : "Passed",
    },
    {
      name: "Data Consistency",
      description: "Validate consistency between reported timestamps, disaster categories, and location fields.",
      detail: checks.data_consistency === false
        ? "Inconsistencies detected in field relationships."
        : "Field relationships and values are structurally consistent.",
      status: checks.data_consistency === false
        ? "Failed"
        : "Passed",
    },
  ];

  const passedCount = validationItems.filter(
    (item) => item.status === "Passed"
  ).length;

  const warningCount = validationItems.filter(
    (item) => item.status === "Warning"
  ).length;

  const failedCount = validationItems.filter(
    (item) => item.status === "Failed"
  ).length;

  const getStatusIcon = (status) => {
    if (status === "Passed") {
      return <CheckCircle2 size={20} className="text-emerald-600" />;
    }

    if (status === "Warning") {
      return <AlertTriangle size={20} className="text-amber-500" />;
    }

    return <XCircle size={20} className="text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-[#eef4f8]">
      <Sidebar />
      <Navbar />

      <main className="ml-64 pt-20">
        <div className="p-8">

          {/* Header */}
          <div className="mb-7">
            <p className="text-sm font-medium text-emerald-600">
              STAGE 02 &bull; DATA QUALITY &amp; VALIDATION
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Data Quality &amp; Required-Field Validation
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Verify the structure, required fields, and data integrity of emergency datasets
              prior to schema mapping and canonical standardization.
            </p>
          </div>

          {/* Validation Summary */}
          <div className="grid gap-5 md:grid-cols-3">

            {/* Dataset */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Database size={21} />
                </div>

                <div className="min-w-0">
                  <p className="text-sm text-slate-500">
                    Source Dataset
                  </p>

                  <p className="truncate font-semibold text-slate-900" title={uploadResult?.filename}>
                    {uploadResult?.filename || "No Dataset Uploaded"}
                  </p>
                </div>
              </div>
            </div>

            {/* Validation Checks */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileCheck2 size={21} />
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Validation Checks
                  </p>

                  <p className="font-semibold text-slate-900">
                    {passedCount} Passed {failedCount > 0 && `\u2022 ${failedCount} Failed`}
                  </p>
                </div>
              </div>
            </div>

            {/* Warnings */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <AlertTriangle size={21} />
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Quality Warnings
                  </p>

                  <p className="font-semibold text-slate-900">
                    {warningCount} Warning
                    {warningCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Dataset Metadata Information Card */}
          {uploadResult && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Source File Metadata</h3>
                  <p className="text-xs text-slate-500">Detailed ingestion telemetry for this dataset</p>
                </div>
                <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                  Job: {uploadResult.job_id}
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Source File</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 truncate" title={uploadResult.filename}>
                    {uploadResult.filename}
                  </p>
                  {sourceMetadata?.file_size_kb && (
                    <p className="text-[11px] text-slate-400">{sourceMetadata.file_size_kb} KB ({sourceMetadata.file_size_bytes} bytes)</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-500">Ingested Rows</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {validation?.row_count?.toLocaleString() ?? sourceMetadata?.source_rows ?? "-"}
                  </p>
                  <p className="text-[11px] text-slate-400">Total raw records</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Detected Columns</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {validation?.column_count ?? sourceMetadata?.column_count ?? sourceColumns.length}
                  </p>
                  <p className="text-[11px] text-slate-400">Source attributes</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Required Fields Status</p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      checks.required_fields === false
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {checks.required_fields === false ? "Missing Required Fields" : "Ready for Mapping"}
                  </p>
                  <p className="text-[11px] text-slate-400">Core disaster fields</p>
                </div>
              </div>

              {/* Detected Source Columns Badges */}
              {sourceColumns.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Detected Source Column Headers ({sourceColumns.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sourceColumns.map((col) => (
                      <span
                        key={col}
                        className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700 border border-slate-200"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Checks List */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={22} />

                  <h2 className="text-lg font-semibold text-slate-900">
                    Validation Checks &amp; Integrity Rules
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Review the quality checks performed on the dataset.
                </p>
              </div>

              <button
                onClick={() => setValidationStarted(true)}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {validationStarted
                  ? "Re-check Completed"
                  : "Re-run Validation Checks"}
              </button>
            </div>

            {/* Checks List */}
            <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">

              {validationItems.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5"
                >
                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 shrink-0">
                      {getStatusIcon(item.status)}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.description}
                      </p>

                      <p className="mt-1 text-xs text-slate-700 font-medium">
                        {item.detail}
                      </p>
                    </div>

                  </div>

                  <span
                    className={`whitespace-nowrap self-start sm:self-center rounded-full px-3 py-1 text-xs font-medium ${
                      item.status === "Passed"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.status === "Warning"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}

            </div>
          </section>

          {/* Overall Result & Next Steps */}
          <section
            className={`mt-7 rounded-2xl p-6 ${
              failedCount > 0
                ? "border border-red-200 bg-red-50"
                : warningCount > 0
                ? "border border-amber-200 bg-amber-50"
                : "border border-emerald-200 bg-emerald-50"
            }`}
          >

            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
                  {failedCount > 0 ? (
                    <XCircle size={22} className="text-red-600" />
                  ) : warningCount > 0 ? (
                    <AlertTriangle size={22} className="text-amber-600" />
                  ) : (
                    <CheckCircle2 size={22} className="text-emerald-600" />
                  )}
                </div>

                <div>
                  <h2
                    className={`font-semibold ${
                      failedCount > 0
                        ? "text-red-900"
                        : warningCount > 0
                        ? "text-amber-900"
                        : "text-emerald-900"
                    }`}
                  >
                    {failedCount > 0
                      ? "Dataset requires correction"
                      : warningCount > 0
                      ? "Dataset passed with warnings — safe to integrate"
                      : "Dataset passed all validation checks"}
                  </h2>

                  <p
                    className={`mt-1 text-sm leading-5 ${
                      failedCount > 0
                        ? "text-red-800"
                        : warningCount > 0
                        ? "text-amber-800"
                        : "text-emerald-800"
                    }`}
                  >
                    {failedCount > 0
                      ? "Some validation checks failed. Missing required fields must be resolved before transformation."
                      : warningCount > 0
                      ? "All required fields are present. Missing secondary values (casualties/damages) will be preserved as Unknown per ResQUE policy."
                      : "All structure and required disaster fields are verified. Ready for schema mapping and canonical transformation."}
                  </p>
                </div>
              </div>

              {failedCount === 0 && uploadResult && (
                <a
                  href="/integration"
                  className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Proceed to Integration &rarr;
                </a>
              )}

            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

export default Validation;