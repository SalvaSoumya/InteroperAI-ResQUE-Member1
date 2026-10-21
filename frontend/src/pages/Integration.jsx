import { useState, useEffect } from "react";
import {
  GitBranch,
  CheckCircle2,
  ArrowRight,
  Database,
  RefreshCw,
  Send,
  AlertTriangle,
  Server,
  Clock,
  ShieldCheck,
  FileCheck2,
  ExternalLink,
  Info,
  XCircle,
  Layers,
  FileText,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { integrateDataset, getJobStatus } from "../services/api";

function Integration() {
  const [integrationStarted, setIntegrationStarted] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [integrationResult, setIntegrationResult] = useState(null);
  const [integrationError, setIntegrationError] = useState("");
  const [showAllMappings, setShowAllMappings] = useState(false);

  // Get the latest uploaded dataset information
  const storedResult = sessionStorage.getItem("latestUploadResult");
  const uploadResult = storedResult ? JSON.parse(storedResult) : null;

  const sourceMetadata = uploadResult?.source_metadata;
  const validation = uploadResult?.validation;
  const requiredFields = uploadResult?.required_fields;
  const sourceColumns = sourceMetadata?.source_columns || validation?.columns || uploadResult?.columns || [];

  const mappings = uploadResult?.schema_mapping?.mappings || [];
  const autoMappedCount = mappings.filter((m) => m.status === "Auto Mapped").length;
  const derivedCount = mappings.filter((m) => m.status === "Derived / Transformed").length;
  const mappedCount = autoMappedCount + derivedCount;
  const reviewCount = mappings.filter(
    (m) => m.status === "Manual Verification Required" || m.status === "Needs Review"
  ).length;
  const unmappedCount = mappings.filter(
    (m) => m.status === "Unmapped / Unsupported" || m.status === "Unknown"
  ).length;
  const visibleMappings = showAllMappings ? mappings : mappings.slice(0, 8);

  const requiredFieldsReady = requiredFields?.all_required_fields_present ?? false;
  const missingRequiredFields = requiredFields?.missing_required_fields || [];
  const presentRequiredFields = requiredFields?.present_required_fields || [];

  // Restore prior integration result if previously executed for this job
  useEffect(() => {
    const restorePriorResult = async () => {
      try {
        const storedInt = sessionStorage.getItem("latestIntegrationResult");
        if (storedInt) {
          const parsed = JSON.parse(storedInt);
          if (parsed?.job_id === uploadResult?.job_id) {
            setIntegrationResult(parsed);
            setIntegrationStarted(true);
            return;
          }
        }

        // If not in session storage, check backend job status
        if (uploadResult?.job_id) {
          const jobData = await getJobStatus(uploadResult.job_id);
          if (jobData?.job?.integration_result) {
            const restoredPayload = {
              success: true,
              job_id: uploadResult.job_id,
              status: jobData.job.status,
              integration: jobData.job.integration_result,
              transfer_details: jobData.job.transfer_details || jobData.job.pipeline_status?.transfer_details,
              pipeline_status: jobData.job.pipeline_status,
              receiver_confirmation: jobData.job.pipeline_status?.receiver_confirmation,
            };
            setIntegrationResult(restoredPayload);
            setIntegrationStarted(true);
          }
        }
      } catch {
        // quiet fallback
      }
    };

    if (uploadResult?.job_id) {
      restorePriorResult();
    }
  }, [uploadResult?.job_id]);

  const handleIntegration = async () => {
    try {
      setIsIntegrating(true);
      setIntegrationError("");

      if (!uploadResult?.job_id) {
        setIntegrationError("No uploaded dataset found. Please upload a dataset first.");
        return;
      }

      const result = await integrateDataset(uploadResult.job_id);
      setIntegrationResult(result);
      setIntegrationStarted(true);

      sessionStorage.setItem("latestIntegrationResult", JSON.stringify(result));
    } catch (error) {
      console.error(error);
      setIntegrationError(
        error.response?.data?.detail ||
          error.message ||
          "Integration failed. Please verify that the FastAPI backend and Member 2 are reachable."
      );
    } finally {
      setIsIntegrating(false);
    }
  };

  const transferDetails =
    integrationResult?.transfer_details ||
    integrationResult?.pipeline_status?.transfer_details;

  const isConfirmed =
    transferDetails?.receiver_confirmed === true ||
    integrationResult?.receiver_confirmation === "confirmed";

  const isFailed =
    integrationResult?.status === "failed" ||
    transferDetails?.confirmation_status === "Failed" ||
    Boolean(integrationError);

  return (
    <div className="min-h-screen bg-[#eef4f8]">
      <Sidebar />
      <Navbar />

      <main className="ml-64 pt-20">
        <div className="p-8">

          {/* Header */}
          <div className="mb-7">
            <p className="text-sm font-medium text-violet-600">
              STAGE 03 &amp; 04 &bull; SCHEMA MAPPING &amp; CANONICAL STANDARDIZATION
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Data Integration, Transformation &amp; API Transfer
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Map original emergency intake fields to the 20 canonical disaster fields,
              standardize records without fabricating missing casualty or loss data, and
              securely dispatch the dataset to Member 2 with audit correlation headers.
            </p>
          </div>

          {/* Pipeline Visibility & Source Dataset Intake Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Database size={24} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Active Ingestion Intake
                    </p>
                    <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Job: {uploadResult?.job_id || "None"}
                    </span>
                  </div>

                  <h2 className="mt-0.5 font-semibold text-slate-900 truncate max-w-md" title={uploadResult?.filename}>
                    {uploadResult?.filename || "No Dataset Uploaded"}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium ${
                    requiredFieldsReady
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {requiredFieldsReady ? (
                    <>
                      <CheckCircle2 size={14} />
                      Required Core Fields Validated
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} />
                      Missing Required Fields
                    </>
                  )}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <ShieldCheck size={14} className="text-blue-600" />
                  Preserving Unassessed Zeros as Unknown
                </span>
              </div>
            </div>

            {/* Ingestion Telemetry Metrics */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-xs text-slate-500 font-medium">Source File Size</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {sourceMetadata?.file_size_kb ? `${sourceMetadata.file_size_kb} KB` : "—"}
                </p>
                <p className="text-[11px] text-slate-400">Verified on disk</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-xs text-slate-500 font-medium">Source Rows</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {validation?.row_count?.toLocaleString() ?? sourceMetadata?.source_rows ?? "—"}
                </p>
                <p className="text-[11px] text-slate-400">Raw input records</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-xs text-slate-500 font-medium">Detected Columns</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {validation?.column_count ?? sourceMetadata?.column_count ?? sourceColumns.length}
                </p>
                <p className="text-[11px] text-slate-400">{mappedCount} mapped to canonical</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-xs text-slate-500 font-medium">Canonical Fields</p>
                <p className="mt-1 text-base font-bold text-violet-700">
                  20 Fields
                </p>
                <p className="text-[11px] text-slate-400">Standard ResQUE schema</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-xs text-slate-500 font-medium">Transfer Status</p>
                <p
                  className={`mt-1 text-base font-bold ${
                    isConfirmed
                      ? "text-emerald-600"
                      : isFailed
                      ? "text-red-600"
                      : integrationStarted
                      ? "text-amber-600"
                      : "text-slate-500"
                  }`}
                >
                  {isConfirmed
                    ? "Confirmed"
                    : isFailed
                    ? "Failed"
                    : integrationStarted
                    ? "Unconfirmed"
                    : "Pending Dispatch"}
                </p>
                <p className="text-[11px] text-slate-400">Receiver audit state</p>
              </div>
            </div>

            {/* Detected Source Columns */}
            {sourceColumns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Detected Source Column Headers ({sourceColumns.length}):
                  </p>
                  <span className="text-[11px] text-slate-400">
                    Analyzed by semantic heuristic matcher
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sourceColumns.map((col) => {
                    const mapping = mappings.find((m) => m.source_field === col);
                    const status = mapping?.status || "Unmapped / Unsupported";
                    let chipClass = "bg-slate-100 border-slate-200 text-slate-600";
                    let chipTitle = "Preserved as extra source metadata";

                    if (status === "Auto Mapped") {
                      chipClass = "bg-emerald-50/70 border-emerald-200 text-emerald-800";
                      chipTitle = `Auto Mapped → ${mapping?.target_field || ""}`;
                    } else if (status === "Derived / Transformed") {
                      chipClass = "bg-purple-50/70 border-purple-200 text-purple-800";
                      chipTitle = `Derived/Transformed → ${mapping?.target_field || ""}`;
                    } else if (
                      status === "Manual Verification Required" ||
                      status === "Needs Review"
                    ) {
                      chipClass = "bg-amber-50/70 border-amber-200 text-amber-800";
                      chipTitle = `Manual Verification Required: ${mapping?.reason || ""}`;
                    }

                    return (
                      <span
                        key={col}
                        className={`rounded-md px-2.5 py-1 font-mono text-xs border ${chipClass}`}
                        title={chipTitle}
                      >
                        {col}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Transformation & Dispatch Flow */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Data Pipeline Architecture
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rigorous end-to-end data transformation pipeline and API exchange protocol
              </p>
            </div>

            <div className="mt-6 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-center">
                <Database className="mx-auto text-blue-600" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-900">1. Source Intake</p>
                <p className="mt-1 text-xs text-slate-500">Raw CSV / JSON</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center">
                <FileCheck2 className="mx-auto text-emerald-600" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-900">2. Quality Validation</p>
                <p className="mt-1 text-xs text-slate-500">Required fields check</p>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 text-center">
                <GitBranch className="mx-auto text-violet-600" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-900">3. Schema Mapping</p>
                <p className="mt-1 text-xs text-slate-500">Heuristic matching</p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 text-center">
                <RefreshCw className="mx-auto text-indigo-600" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-900">4. Standardization</p>
                <p className="mt-1 text-xs text-slate-500">20 canonical fields</p>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 text-center">
                <Send className="mx-auto text-teal-600" size={22} />
                <p className="mt-2 text-sm font-semibold text-slate-900">5. API Transfer</p>
                <p className="mt-1 text-xs text-slate-500">Correlation audit</p>
              </div>
            </div>
          </section>

          {/* Schema Mapping Table */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Schema Mapping &amp; Field Alignment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mapping detected source headers to the canonical 20-field disaster schema with explicit NOAA aliases &amp; derivations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {autoMappedCount} Auto Mapped
                </span>
                {derivedCount > 0 && (
                  <span className="rounded-md bg-purple-50 px-2.5 py-1 font-medium text-purple-700 border border-purple-200 flex items-center gap-1">
                    <Layers size={13} />
                    {derivedCount} Derived / Transformed
                  </span>
                )}
                {reviewCount > 0 && (
                  <span className="rounded-md bg-amber-50 px-2.5 py-1 font-medium text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    {reviewCount} Needs Review
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600 border border-slate-200 flex items-center gap-1">
                  <FileText size={13} />
                  {unmappedCount} Extra Metadata / Unmapped
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Source Field (Original)
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Common Canonical Field (Target)
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Standardization Rule &amp; Audit Reason
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mapping Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visibleMappings.map((mapping) => (
                    <tr key={mapping.source_field} className="hover:bg-slate-50/50">
                      {/* Source Field */}
                      <td className="px-6 py-4 align-top">
                        <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
                          {mapping.source_field}
                        </span>
                      </td>

                      {/* Common Field */}
                      <td className="px-6 py-4 align-top">
                        {mapping.target_field ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight size={16} className="text-violet-500 shrink-0" />
                            <span className="rounded-md bg-violet-50 px-3 py-1 font-mono text-xs text-violet-700 font-semibold">
                              {mapping.target_field}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-slate-400 italic">
                            <span>—</span>
                            {mapping.is_extra_metadata && (
                              <span className="text-[11px] font-sans not-italic rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                                Retained in Metadata
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Rule Description & Audit Trace */}
                      <td className="px-6 py-4 align-top">
                        <p className="text-xs font-medium text-slate-700">
                          {mapping.transformation_rule ||
                            (mapping.status === "Auto Mapped"
                              ? "Direct 1-to-1 Normalization into Canonical Format"
                              : mapping.status === "Derived / Transformed"
                              ? "Multi-source composite derivation"
                              : "Preserved in source metadata without fabrication")}
                        </p>
                        {mapping.reason && (
                          <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                            {mapping.reason}
                          </p>
                        )}
                      </td>

                      {/* Mapping Status */}
                      <td className="px-6 py-4 align-top">
                        {mapping.status === "Auto Mapped" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={14} />
                            Auto Mapped
                          </span>
                        )}

                        {mapping.status === "Derived / Transformed" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 border border-purple-200">
                            <Layers size={14} />
                            Derived / Transformed
                          </span>
                        )}

                        {(mapping.status === "Manual Verification Required" ||
                          mapping.status === "Needs Review") && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                            <AlertTriangle size={14} />
                            Manual Verification Required
                          </span>
                        )}

                        {(mapping.status === "Unmapped / Unsupported" ||
                          mapping.status === "Unknown") && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                            <FileText size={14} />
                            {mapping.is_extra_metadata ? "Extra Source Metadata" : "Unmapped / Unsupported"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {mappings.length > 8 && (
                <div className="border-t border-slate-200 p-4 text-center">
                  <button
                    onClick={() => setShowAllMappings(!showAllMappings)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {showAllMappings
                      ? "Show Less ↑"
                      : `Show More (${mappings.length - 8} more fields) ↓`}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Integration Execution Action */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Ready to Standardize &amp; Exchange Data
                </h2>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {requiredFieldsReady
                    ? `${mappedCount} source field(s) standardized (${autoMappedCount} auto-mapped, ${derivedCount} derived) to the canonical disaster-response schema. Ready to generate 20 canonical columns and dispatch to Member 2.`
                    : missingRequiredFields.length > 0
                    ? `Required canonical field(s) missing or incomplete: [${missingRequiredFields.join(", ")}]. Transformation is blocked to protect data integrity.`
                    : "Some required disaster-response fields could not be detected. Please review the schema mapping."}
                </p>
              </div>

              <button
                onClick={handleIntegration}
                disabled={!uploadResult || !requiredFieldsReady || isIntegrating || isConfirmed}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isIntegrating ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Transforming &amp; Dispatching...
                  </>
                ) : isConfirmed ? (
                  <>
                    <CheckCircle2 size={18} />
                    Integration Confirmed
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Standardize &amp; Transfer to Member 2
                  </>
                )}
              </button>
            </div>

            {/* Integration Error if any */}
            {integrationError && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
                <XCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Data Transfer Failure</p>
                  <p className="mt-0.5 text-red-700">{integrationError}</p>
                </div>
              </div>
            )}
          </section>

          {/* API Transfer & Delivery Transparency Audit Panel */}
          {integrationResult && transferDetails && (
            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      API Transfer &amp; Delivery Transparency Audit
                    </h3>
                    <p className="text-xs text-slate-500">
                      Outgoing telemetry, request headers, and receiver acknowledgment details
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold ${
                      isConfirmed
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isFailed
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {isConfirmed ? (
                      <>
                        <CheckCircle2 size={14} />
                        Receiver Confirmed
                      </>
                    ) : isFailed ? (
                      <>
                        <XCircle size={14} />
                        Transfer Failed
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} />
                        Unconfirmed Delivery
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Transfer Details Grid */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Destination Service
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.destination_service || "Member 2 Intelligence API"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 font-mono" title={transferDetails.destination_url}>
                    {transferDetails.destination_url || "/api/receive-file"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Correlation / Request ID
                  </p>
                  <p className="mt-1 text-xs font-mono font-semibold text-blue-700 truncate" title={transferDetails.correlation_id}>
                    {transferDetails.correlation_id || "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Header: <span className="font-mono">X-Correlation-ID</span>
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Source System Header
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.source_system || "Member-1"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Header: <span className="font-mono">X-Source-System: Member-1</span>
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Request Timestamp (UTC)
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.request_timestamp
                      ? new Date(transferDetails.request_timestamp).toLocaleString()
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">ISO-8601 audit record</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    HTTP Response Status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.http_status ? `${transferDetails.http_status} OK` : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Transport-level status code</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Records Standardized &amp; Sent
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.record_count?.toLocaleString() || "—"} records
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 font-mono truncate" title={transferDetails.file_sent}>
                    File: {transferDetails.file_sent || "processed.csv"}
                  </p>
                </div>
              </div>

              {/* Receiver Confirmation Audit Message */}
              <div
                className={`mt-4 rounded-xl p-4 border flex items-start gap-3 ${
                  isConfirmed
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                    : isFailed
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isConfirmed ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : isFailed ? (
                    <XCircle size={18} className="text-red-600" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-600" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Receiver Ingestion Acknowledgment:
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {transferDetails.receiver_message ||
                      (isConfirmed
                        ? "Receiver acknowledged ingestion and validated record payload."
                        : "Receiver did not confirm successful ingestion. Success is not claimed based solely on HTTP dispatch.")}
                  </p>
                </div>

                <a
                  href="/results"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  View Results &rarr;
                </a>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

export default Integration;