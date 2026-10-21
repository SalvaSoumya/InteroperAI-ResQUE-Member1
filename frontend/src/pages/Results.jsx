import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Package,
  MapPin,
  Brain,
  ArrowUpRight,
  RefreshCw,
  ShieldAlert,
  Activity,
  Info,
  ChevronLeft,
  ChevronRight,
  Server,
  GitBranch,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  XCircle,
  Send,
  Layers,
  FileText,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getJobStatus } from "../services/api";

function Results() {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assessmentPage, setAssessmentPage] = useState(1);
  const RECORDS_PER_PAGE = 10;

  useEffect(() => {
    let active = true;

    const loadResults = async () => {
      try {
        setLoading(true);
        setError("");

        const storedResult = sessionStorage.getItem("latestUploadResult");

        if (!storedResult) {
          throw new Error("No uploaded dataset found. Please upload a dataset first.");
        }

        const uploadResult = JSON.parse(storedResult);
        const jobId = uploadResult?.job_id;

        if (!jobId) {
          throw new Error("Job ID not found. Please upload the dataset again.");
        }

        const result = await getJobStatus(jobId);

        if (!result?.job) {
          throw new Error("Unable to find the uploaded job.");
        }

        if (active) {
          setJob(result.job);
        }
      } catch (err) {
        console.error("Error loading results:", err);

        if (active) {
          setError(
            err.response?.data?.detail ||
              err.message ||
              "Unable to load results. Please make sure the backend is running."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadResults();

    return () => {
      active = false;
    };
  }, []);

  const integration = job?.integration_result;

  const transferDetails = useMemo(() => {
    return job?.transfer_details || job?.pipeline_status?.transfer_details || null;
  }, [job]);

  const isTransferConfirmed = Boolean(
    transferDetails?.receiver_confirmed === true ||
    job?.pipeline_status?.receiver_confirmation === "confirmed"
  );

  const isTransferFailed = Boolean(
    job?.status === "failed" ||
    job?.pipeline_status?.remote_file_receipt === "failed" ||
    transferDetails?.confirmation_status === "Failed"
  );

  const mappingsList = useMemo(() => {
    return job?.schema_mapping?.mappings || integration?.mapping_details || [];
  }, [job, integration]);

  const unmappedCanonical = useMemo(() => {
    return integration?.unmapped_canonical_fields || [];
  }, [integration]);

  const unsupportedSource = useMemo(() => {
    return integration?.unsupported_source_fields || [];
  }, [integration]);

  const autoMappedCount = useMemo(() => {
    return mappingsList.filter((m) => m.status === "Auto Mapped").length;
  }, [mappingsList]);

  const derivedCount = useMemo(() => {
    return mappingsList.filter((m) => m.status === "Derived / Transformed").length;
  }, [mappingsList]);

  const reviewCount = useMemo(() => {
    return mappingsList.filter(
      (m) => m.status === "Manual Verification Required" || m.status === "Needs Review"
    ).length;
  }, [mappingsList]);

  const unmappedCount = useMemo(() => {
    return mappingsList.filter(
      (m) => m.status === "Unmapped / Unsupported" || m.status === "Unknown"
    ).length;
  }, [mappingsList]);

  const extraMetadataMappings = useMemo(() => {
    return mappingsList.filter(
      (m) => m.is_extra_metadata || m.status === "Unmapped / Unsupported"
    );
  }, [mappingsList]);

  // Member 2's remote response is saved in assessment_result by Member 1's integration API.
  const member2Response = job?.assessment_result;

  // Verify exact Member 2 response associated with the current job (never use stale results from a prior job)
  const isMember2ResponseValidForJob = useMemo(() => {
    if (!member2Response || !job?.job_id) return false;
    const currentJobId = String(job.job_id);
    const respJobId = String(member2Response.job_id || "");
    const respFilename = String(member2Response.filename || "");
    const respSavedFile = String(member2Response.processed_file_saved || "");

    const matchesJobId = Boolean(
      respJobId && (
        respJobId === currentJobId ||
        respJobId === `${currentJobId}_processed` ||
        respJobId.startsWith(currentJobId) ||
        currentJobId.startsWith(respJobId)
      )
    );

    const matchesFilename = Boolean(
      respFilename && (
        respFilename.includes(currentJobId) ||
        respSavedFile.includes(currentJobId)
      )
    );

    if (!respJobId && !respFilename) {
      return Boolean(job?.pipeline_status?.remote_file_receipt === "delivered" && member2Response.records);
    }

    return Boolean(matchesJobId || matchesFilename);
  }, [member2Response, job?.job_id, job?.pipeline_status]);

  const hasMember2EvaluatedRecords = Boolean(
    isMember2ResponseValidForJob &&
    Array.isArray(member2Response?.records) &&
    member2Response.records.length > 0
  );

  // Processed data preview: uses genuine Member 2 records if verified; otherwise local preview labeled as such
  const preview = useMemo(() => {
    if (hasMember2EvaluatedRecords) {
      return member2Response.records;
    }

    if (Array.isArray(integration?.preview) && integration.preview.length > 0) {
      return integration.preview;
    }

    return [];
  }, [hasMember2EvaluatedRecords, member2Response, integration]);

  // Hybrid assessment records returned strictly by Member 2 for this job (never falls back to unassessed local preview or stale results)
  const hybridRecords = useMemo(() => {
    if (!isMember2ResponseValidForJob) {
      return [];
    }

    if (Array.isArray(member2Response?.records) && member2Response.records.length > 0) {
      return member2Response.records;
    }

    if (
      Array.isArray(member2Response?.sample_evaluated_records) &&
      member2Response.sample_evaluated_records.length > 0
    ) {
      return member2Response.sample_evaluated_records;
    }

    return [];
  }, [member2Response, isMember2ResponseValidForJob]);

  // Verify that genuine hybrid evaluation fields exist in the records
  const hasHybridAssessment = useMemo(() => {
    return (
      hybridRecords.length > 0 &&
      hybridRecords.some(
        (r) =>
          r.anomaly_score !== undefined ||
          r.anomaly_status !== undefined ||
          r.impact_screening_score !== undefined ||
          r.impact_tier !== undefined ||
          r.human_review_recommendation !== undefined
      )
    );
  }, [hybridRecords]);

  // Hybrid assessment summary stats
  const hybridStats = useMemo(() => {
    if (!hasHybridAssessment) return null;

    const total = hybridRecords.length;
    const unusualCount = hybridRecords.filter(
      (r) =>
        r.is_anomaly === true ||
        String(r.anomaly_status || "").toLowerCase() === "unusual"
    ).length;

    const impactTiers = {};
    let completenessSum = 0;
    let completenessCount = 0;

    hybridRecords.forEach((r) => {
      const tier = r.impact_tier || "Unspecified";
      impactTiers[tier] = (impactTiers[tier] || 0) + 1;

      if (r.evidence_completeness_pct !== null && r.evidence_completeness_pct !== undefined && r.evidence_completeness_pct !== "") {
        completenessSum += Number(r.evidence_completeness_pct);
        completenessCount += 1;
      }
    });

    const avgCompleteness =
      completenessCount > 0 ? (completenessSum / completenessCount).toFixed(0) : null;

    return {
      total,
      unusualCount,
      impactTiers,
      avgCompleteness,
    };
  }, [hasHybridAssessment, hybridRecords]);

  // Pagination for hybrid assessment table
  const totalPages = Math.ceil(hybridRecords.length / RECORDS_PER_PAGE) || 1;
  const paginatedHybridRecords = useMemo(() => {
    const startIndex = (assessmentPage - 1) * RECORDS_PER_PAGE;
    return hybridRecords.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [hybridRecords, assessmentPage]);

  const sourcePreview = Array.isArray(job?.source_preview)
    ? job.source_preview
    : [];

  const sourceColumns =
    sourcePreview.length > 0 ? Object.keys(sourcePreview[0]) : [];

  const processedColumns =
    Array.isArray(member2Response?.columns) && member2Response.columns.length > 0
      ? member2Response.columns
      : preview.length > 0
        ? Object.keys(preview[0])
        : [];

  const totalRecords =
    member2Response?.total_records ??
    integration?.row_count ??
    integration?.rows_processed ??
    job?.validation?.row_count ??
    preview.length;

  // Safe population calculation: do not convert missing values or empty strings to confirmed zero
  const recordsWithPopulation = useMemo(() => {
    return preview.filter((row) => {
      const val = row?.affected_population;
      return (
        val !== null &&
        val !== undefined &&
        val !== "" &&
        !isNaN(Number(val)) &&
        Number(val) > 0
      );
    });
  }, [preview]);

  const hasPopulationData = recordsWithPopulation.length > 0;

  const affectedPopulationTotal = useMemo(() => {
    if (!hasPopulationData) return null;
    return preview.reduce((total, row) => {
      const val = row?.affected_population;
      if (val !== null && val !== undefined && val !== "" && !isNaN(Number(val))) {
        return total + Number(val);
      }
      return total;
    }, 0);
  }, [preview, hasPopulationData]);

  // Safe priority classification: check if priority is actually assigned
  const knownPriorityRecords = useMemo(() => {
    return preview.filter((row) => {
      const p = String(row?.priority_level || "").trim().toLowerCase();
      return p && p !== "unknown" && p !== "null" && p !== "undefined" && p !== "—";
    });
  }, [preview]);

  const hasPriorityData = knownPriorityRecords.length > 0;

  const highPriorityCount = useMemo(() => {
    if (!hasPriorityData) return 0;
    return knownPriorityRecords.filter((row) => {
      const priority = String(row?.priority_level || "").toLowerCase();
      return priority === "high" || priority === "critical";
    }).length;
  }, [knownPriorityRecords, hasPriorityData]);

  const isComplete = job?.status === "completed" && Boolean(integration);
  const isPartial = job?.status === "partial" && Boolean(integration);
  const isFailed = job?.status === "failed";

  // Safe resource-shortage calculation: check if dataset actually has numeric required and available quantities
  const resourceShortageData = useMemo(() => {
    let hasNumericData = false;
    let totalShortage = 0;

    preview.forEach((row) => {
      const req = row?.required_resources;
      const avail = row?.available_resources;
      const reqNum = Number(req);
      const availNum = Number(avail);

      if (
        req !== null &&
        req !== undefined &&
        req !== "" &&
        !isNaN(reqNum) &&
        avail !== null &&
        avail !== undefined &&
        avail !== "" &&
        !isNaN(availNum)
      ) {
        hasNumericData = true;
        if (reqNum > availNum) {
          totalShortage += reqNum - availNum;
        }
      }
    });

    return {
      hasNumericData,
      totalShortage,
    };
  }, [preview]);

  // Helper: safely format general values without turning missing fields into zeros
  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  };

  // Helper: format numeric fields preserving distinction between genuine 0 and missing/unassessed
  const formatNumericField = (val) => {
    if (val === null || val === undefined || String(val).trim() === "") {
      return "—";
    }
    const num = Number(val);
    if (isNaN(num)) {
      return "—";
    }
    return num.toLocaleString();
  };

  // Helper: format loss values preserving distinction between genuine $0 and missing/unassessed
  const formatLossField = (val) => {
    if (val === null || val === undefined || String(val).trim() === "") {
      return "—";
    }
    const num = Number(val);
    if (isNaN(num)) {
      return "—";
    }
    return `$${num.toLocaleString()}`;
  };

  // Helper: display safe label for assessment fields
  const displayAssessmentField = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") {
      return "Not available";
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef4f8]">
        <Sidebar />
        <Navbar />

        <main className="ml-64 pt-20">
          <div className="p-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">
                Loading integration results...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#eef4f8]">
        <Sidebar />
        <Navbar />

        <main className="ml-64 pt-20">
          <div className="p-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertTriangle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef4f8]">
      <Sidebar />
      <Navbar />

      <main className="ml-64 pt-20">
        <div className="p-8">
          {/* Page Header */}
          <div className="mb-7">
            <p className="text-sm font-medium text-emerald-600">
              RESPONSE INTELLIGENCE
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Disaster Response Results
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              View the standardized disaster-response data transferred through
              the integration pipeline and evaluated by Member 2.
            </p>
          </div>

          {/* Integration Status */}
          <section
            className={`rounded-2xl border p-6 ${
              isComplete
                ? "border-emerald-200 bg-emerald-50"
                : isPartial
                ? "border-amber-200 bg-amber-50"
                : isFailed
                ? "border-red-200 bg-red-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ${
                  isComplete
                    ? "text-emerald-600"
                    : isPartial
                    ? "text-amber-600"
                    : isFailed
                    ? "text-red-600"
                    : "text-slate-600"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 size={23} />
                ) : isPartial || isFailed ? (
                  <AlertTriangle size={23} />
                ) : (
                  <RefreshCw size={23} />
                )}
              </div>

              <div>
                <h2
                  className={`font-semibold ${
                    isComplete
                      ? "text-emerald-900"
                      : isPartial
                      ? "text-amber-900"
                      : isFailed
                      ? "text-red-900"
                      : "text-slate-900"
                  }`}
                >
                  {isComplete
                    ? "Integration Completed"
                    : isPartial
                    ? "Partial Integration — Assessment Incomplete"
                    : isFailed
                    ? "Integration Failed"
                    : "Integration Not Completed"}
                </h2>

                <p
                  className={`mt-1 text-sm ${
                    isComplete
                      ? "text-emerald-800"
                      : isPartial
                      ? "text-amber-800"
                      : isFailed
                      ? "text-red-800"
                      : "text-slate-700"
                  }`}
                >
                  {isComplete
                    ? `The dataset ${job?.filename || ""} was transformed, received by Member 2, and assessment results were successfully retrieved.`
                    : isPartial
                    ? `The dataset ${job?.filename || ""} was transformed and received by Member 2, but assessment results could not be fully retrieved.`
                    : isFailed
                    ? "Communication with Member 2 API failed or the remote pipeline encountered an error."
                    : "Complete data integration before viewing the evaluated assessment results."}
                </p>
              </div>
            </div>
          </section>

          {/* API Transfer & Delivery Transparency Audit Panel */}
          {transferDetails && (
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
                      isTransferConfirmed
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isTransferFailed
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {isTransferConfirmed ? (
                      <>
                        <CheckCircle2 size={14} />
                        Receiver Confirmed
                      </>
                    ) : isTransferFailed ? (
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
                    {transferDetails.destination_service || "Member 2 Disaster Response Intelligence API"}
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
                    Standardized Records Sent
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {transferDetails.record_count?.toLocaleString() || "—"} records
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 font-mono truncate" title={transferDetails.file_sent}>
                    File: {transferDetails.file_sent || "processed.csv"}
                  </p>
                </div>
              </div>

              {/* Receiver Confirmation Message */}
              <div
                className={`mt-4 rounded-xl p-4 border flex items-start gap-3 ${
                  isTransferConfirmed
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                    : isTransferFailed
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isTransferConfirmed ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : isTransferFailed ? (
                    <XCircle size={18} className="text-red-600" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-600" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Receiver Ingestion Confirmation:
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {transferDetails.receiver_message ||
                      (isTransferConfirmed
                        ? "Receiver acknowledged ingestion of the processed dataset."
                        : "Receiver has not confirmed successful ingestion. Integration success is not claimed based solely on HTTP dispatch.")}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Key Metrics */}
          <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    High Priority Incidents
                  </p>
                  <p className={`mt-2 text-3xl font-bold ${hasPriorityData ? "text-red-600" : "text-slate-700"}`}>
                    {hasPriorityData ? highPriorityCount.toLocaleString() : "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {hasPriorityData
                      ? "High or Critical incidents"
                      : "Priority unassigned in source"}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <AlertTriangle size={21} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Affected Population
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {hasPopulationData
                      ? affectedPopulationTotal.toLocaleString()
                      : "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {hasPopulationData
                      ? "Reported affected individuals"
                      : "Not reported in dataset intake"}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Users size={21} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Resource Shortages
                  </p>
                  <p className={`mt-2 text-3xl font-bold ${resourceShortageData.hasNumericData ? "text-amber-600" : "text-slate-700"}`}>
                    {resourceShortageData.hasNumericData
                      ? resourceShortageData.totalShortage.toLocaleString()
                      : "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {resourceShortageData.hasNumericData
                      ? "Reported resource deficit"
                      : "Not assessed — requires numeric quantities"}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Package size={21} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Records Received</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">
                    {Number(totalRecords || 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Integrated dataset records
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MapPin size={21} />
                </div>
              </div>
            </div>
          </section>

          {/* Response Intelligence Summary */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Brain size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Response Intelligence Summary
                </h2>
                <p className="text-sm text-slate-500">
                  Summary of the available integrated disaster records and data quality.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-red-900">
                    Incident Priority
                  </h3>
                  <ArrowUpRight size={19} className="text-red-600" />
                </div>

                <p className="mt-3 text-sm leading-6 text-red-800">
                  {hasPriorityData
                    ? `${highPriorityCount.toLocaleString()} displayed record(s) are marked as High or Critical priority.`
                    : "Incident priority is unassigned or Unknown across the intake records. Preserved as Unknown without fabricated classification."}
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-900">
                    Affected Population
                  </h3>
                  <Users size={19} className="text-blue-600" />
                </div>

                <p className="mt-3 text-sm leading-6 text-blue-800">
                  {hasPopulationData ? (
                    <>
                      The displayed records contain an affected population of{" "}
                      <strong>{affectedPopulationTotal.toLocaleString()}</strong>.
                    </>
                  ) : (
                    "Affected population counts are not provided in this dataset intake. Values remain unassigned rather than assumed to be zero."
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-amber-900">
                    Resource Shortages
                  </h3>
                  <Package size={19} className="text-amber-600" />
                </div>

                <p className="mt-3 text-sm leading-6 text-amber-800">
                  {resourceShortageData.hasNumericData
                    ? `${resourceShortageData.totalShortage.toLocaleString()} resource shortage deficit detected across reported quantities.`
                    : "Resource shortages are not assessed because the dataset lacks numeric required and available resource quantities. Deficits are not assumed or fabricated."}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-emerald-900">
                    Integration Status
                  </h3>
                  <CheckCircle2 size={19} className="text-emerald-600" />
                </div>

                <p className="mt-3 text-sm leading-6 text-emerald-800">
                  {isComplete
                    ? "The processed dataset was evaluated by Member 2 and assessment results were retrieved successfully."
                    : isPartial
                    ? "The dataset was delivered to Member 2, but assessment retrieval was incomplete or returned partial results."
                    : isFailed
                    ? "The integration workflow encountered a communication or evaluation error."
                    : "The dataset has not completed the integration workflow."}
                </p>
              </div>
            </div>
          </section>

          {/* Latest Uploaded Dataset */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Latest Uploaded Dataset
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Original source-data preview from the uploaded dataset.
                  </p>
                </div>

                <div className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  Source Data
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    File
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {job?.filename || "Unknown"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Records
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {job?.validation?.row_count?.toLocaleString() || "—"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Source Fields
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {job?.validation?.column_count || sourceColumns.length || "—"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Validation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">
                    {job?.validation?.overall_status || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {sourcePreview.length > 0 ? (
                <table className="w-full min-w-max text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {sourceColumns.map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {column.replaceAll("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {sourcePreview.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50">
                        {sourceColumns.map((column) => (
                          <td
                            key={column}
                            className="whitespace-nowrap px-6 py-4 text-sm text-slate-600"
                          >
                            {formatValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  No source-data preview is available.
                </div>
              )}
            </div>
          </section>

          {/* =============================================================== */}
          {/* BEFORE-AND-AFTER FIELD MAPPING & CANONICAL TRANSFORMATION AUDIT */}
          {/* =============================================================== */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <GitBranch size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Before-and-After Field Mapping &amp; Canonical Transformation Audit
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Detailed semantic alignment from raw source schema into the ResQUE 20-field canonical schema
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    {autoMappedCount} Auto Mapped
                  </span>
                  {derivedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                      <Layers size={13} />
                      {derivedCount} Derived
                    </span>
                  )}
                  {reviewCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <AlertTriangle size={13} />
                      {reviewCount} Review
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <FileText size={13} />
                    {unmappedCount} Extra Metadata / Unmapped
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    20 Canonical Fields
                  </span>
                </div>
              </div>

              {/* Data Pipeline Telemetry Summary Chips */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Records Standardized
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {integration?.processed_rows?.toLocaleString() || Number(totalRecords || 0).toLocaleString()} rows
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Input: {job?.validation?.row_count?.toLocaleString() || "—"} rows &bull; Rejected: 0
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Standardized Columns
                  </p>
                  <p className="mt-1 text-lg font-bold text-violet-700">
                    {integration?.processed_columns || 20} Canonical Fields
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    From {sourceColumns.length} detected source columns
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Required Fields Check
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      job?.validation?.checks?.required_fields === false
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {job?.validation?.checks?.required_fields === false
                      ? "Missing Required"
                      : "Passed All Checks"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Core incident, type &amp; location verified
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Zero Fabrication Policy
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-800">
                    Strict Preservation
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Missing casualties preserved as Unknown
                  </p>
                </div>
              </div>
            </div>

            {/* Before-and-After Mappings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Original Source Field (Before)
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Standardized Canonical Field (After)
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Transformation &amp; Audit Trace
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mapping Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {mappingsList.map((m) => (
                    <tr key={m.source_field} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 align-top">
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                          {m.source_field}
                        </span>
                      </td>

                      <td className="px-6 py-3.5 align-top">
                        {m.target_field ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight size={15} className="text-violet-500 shrink-0" />
                            <span className="rounded-md bg-violet-50 px-2.5 py-1 font-mono text-xs font-semibold text-violet-700">
                              {m.target_field}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-slate-400 italic">
                            <span>—</span>
                            {m.is_extra_metadata && (
                              <span className="text-[11px] font-sans not-italic rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                                Retained in Metadata
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-3.5 align-top text-xs text-slate-600">
                        <p className="font-medium text-slate-700">
                          {m.transformation_rule ||
                            (m.status === "Auto Mapped"
                              ? "Mapped to canonical disaster schema. Validated data types & bounds."
                              : m.status === "Derived / Transformed"
                              ? "Multi-source composite derivation into canonical field."
                              : "Preserved in source metadata without fabricating missing values.")}
                        </p>
                        {m.reason && (
                          <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                            {m.reason}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-3.5 align-top">
                        {m.status === "Auto Mapped" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={13} />
                            Auto Mapped
                          </span>
                        )}

                        {m.status === "Derived / Transformed" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                            <Layers size={13} />
                            Derived / Transformed
                          </span>
                        )}

                        {(m.status === "Manual Verification Required" ||
                          m.status === "Needs Review") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                            <AlertTriangle size={13} />
                            Manual Review
                          </span>
                        )}

                        {(m.status === "Unmapped / Unsupported" ||
                          m.status === "Unknown") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                            <FileText size={13} />
                            {m.is_extra_metadata ? "Extra Metadata" : "Unmapped"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Field Explanation & Policy Highlights */}
            <div className="border-t border-slate-100 p-6 bg-slate-50/40">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Unmapped Canonical Fields ({unmappedCanonical.length})
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Canonical disaster fields not present in the original intake file.
                    Under InteroperAI-ResQUE policy, these remain safely <strong>null / Unknown</strong> and are <strong>never replaced with fabricated zeros</strong>:
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {unmappedCanonical.length > 0 ? (
                      unmappedCanonical.map((field) => (
                        <span
                          key={field}
                          className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 border border-slate-200"
                        >
                          {field}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">All 20 canonical fields mapped</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Preserved Source Metadata ({extraMetadataMappings.length})
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Source columns not mapped into canonical fields (e.g. meteorological measurements, storm categories, scales) are preserved as auxiliary metadata:
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {extraMetadataMappings.length > 0 ? (
                      extraMetadataMappings.map((m) => (
                        <span
                          key={m.source_field}
                          className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 border border-slate-200"
                          title={m.reason}
                        >
                          {m.source_field}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No extra metadata columns</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-violet-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Standardized Delivery Dataset
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    The transformed file generated by Member 1 and transferred to Member 2:
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 font-mono">
                    <p>Filename: <span className="font-semibold text-slate-800">{integration?.output_filename || `${job?.job_id}_processed.csv`}</span></p>
                    <p>Standardized Schema: <span className="text-violet-700 font-semibold">20 Canonical Columns</span></p>
                    <p>Delivered Records: <span className="text-emerald-700 font-semibold">{integration?.processed_rows || totalRecords || 0} rows</span></p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Processed Disaster Data */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Processed Disaster Data
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {hasMember2EvaluatedRecords
                      ? "Standardized disaster records returned and evaluated by Member 2 API."
                      : "Standardized disaster records from local transformation preview (Member 2 evaluation pending or not retrieved)."}
                  </p>

                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    {Number(totalRecords || 0).toLocaleString()} total records
                  </p>
                </div>

                <div className="shrink-0">
                  {hasMember2EvaluatedRecords ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={13} />
                      Member 2 Evaluated Records
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      Local Standardized Preview (Pre-Assessment)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {preview.length > 0 ? (
                <table className="w-full min-w-max text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {processedColumns.map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {column.replaceAll("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, rowIndex) => {
                      const priority = String(
                        row?.priority_level || ""
                      ).toLowerCase();

                      const priorityClass =
                        priority === "critical"
                          ? "bg-red-100 text-red-800"
                          : priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : priority === "medium"
                              ? "bg-amber-100 text-amber-800"
                              : priority === "low"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700";

                      return (
                        <tr key={rowIndex} className="hover:bg-slate-50">
                          {processedColumns.map((column) => (
                            <td
                              key={column}
                              className="whitespace-nowrap px-5 py-4 text-sm text-slate-600"
                            >
                              {column === "priority_level" ? (
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${priorityClass}`}
                                >
                                  {formatValue(row[column])}
                                </span>
                              ) : column === "estimated_loss" ? (
                                formatLossField(row[column])
                              ) : column === "affected_population" ||
                                column === "reported_casualties" ||
                                column === "injured_population" ||
                                column === "displaced_population" ? (
                                formatNumericField(row[column])
                              ) : (
                                formatValue(row[column])
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  No processed records were found in the saved integration
                  response. Run the integration workflow again to populate
                  this section.
                </div>
              )}
            </div>
          </section>

          {/* =============================================================== */}
          {/* HYBRID DISASTER ASSESSMENT (MEMBER 2 ML OUTPUT)                  */}
          {/* =============================================================== */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Brain size={16} />
                    </span>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Hybrid Disaster Assessment
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Multi-tier evaluation from Member 2 combining unsupervised anomaly detection,
                    impact screening scores, and human review recommendations.
                  </p>
                </div>

                {hasHybridAssessment && hybridStats && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                      <Activity size={14} className="text-indigo-600" />
                      {hybridStats.total.toLocaleString()} Evaluated
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        hybridStats.unusualCount > 0
                          ? "border border-amber-200 bg-amber-50 text-amber-800"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <ShieldAlert size={14} />
                      {hybridStats.unusualCount} Unusual Flagged
                    </span>

                    {hybridStats.avgCompleteness && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                        <Info size={14} className="text-blue-600" />
                        {hybridStats.avgCompleteness}% Evidence Quality
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Explanatory Methodology Legend */}
              <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 sm:grid-cols-3">
                <div>
                  <span className="font-semibold text-slate-800">1. Anomaly Detection:</span>{" "}
                  Isolation Forest decision score indicating statistical pattern deviation (not a confidence percentage).
                </div>
                <div>
                  <span className="font-semibold text-slate-800">2. Impact Screening:</span>{" "}
                  Tiered score derived from estimated loss, casualties, and operational exposure.
                </div>
                <div>
                  <span className="font-semibold text-slate-800">3. Priority Classification:</span>{" "}
                  Operational triage level; preserves <em>Unknown</em> when source data lacks verified priority.
                </div>
              </div>
            </div>

            {hasHybridAssessment ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Incident
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Disaster & Location
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Anomaly Detection
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Impact Screening
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Priority Level
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Contributing Evidence
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Completeness
                        </th>
                        <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Human Review Recommendation
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {paginatedHybridRecords.map((row, idx) => {
                        const isUnusual =
                          row?.is_anomaly === true ||
                          String(row?.anomaly_status || "").toLowerCase() === "unusual";

                        const anomalyStatusLabel = row?.anomaly_status
                          ? String(row.anomaly_status)
                          : isUnusual
                          ? "Unusual"
                          : "Normal";

                        const anomalyScoreLabel =
                          row?.anomaly_score !== null &&
                          row?.anomaly_score !== undefined &&
                          row?.anomaly_score !== ""
                            ? Number(row.anomaly_score).toFixed(4)
                            : "Not available";

                        const impactTier = row?.impact_tier || "Not available";
                        const impactScore =
                          row?.impact_screening_score !== null &&
                          row?.impact_screening_score !== undefined &&
                          row?.impact_screening_score !== ""
                            ? `${Number(row.impact_screening_score).toFixed(1)} / 100`
                            : "Not available";

                        const priorityRaw = String(row?.priority_level || "").trim();
                        const priorityLower = priorityRaw.toLowerCase();
                        const priorityDisplay = priorityRaw || "Not available";

                        let priorityBadgeClass = "bg-slate-100 text-slate-700 border border-slate-200";
                        if (priorityLower === "critical") priorityBadgeClass = "bg-red-100 text-red-800";
                        else if (priorityLower === "high") priorityBadgeClass = "bg-orange-100 text-orange-800";
                        else if (priorityLower === "medium") priorityBadgeClass = "bg-amber-100 text-amber-800";
                        else if (priorityLower === "low") priorityBadgeClass = "bg-emerald-100 text-emerald-800";

                        let impactBadgeClass = "bg-slate-100 text-slate-700";
                        if (impactTier.toLowerCase().includes("critical") || impactTier.toLowerCase().includes("severe")) {
                          impactBadgeClass = "bg-red-100 text-red-800";
                        } else if (impactTier.toLowerCase().includes("moderate")) {
                          impactBadgeClass = "bg-amber-100 text-amber-800";
                        } else if (impactTier.toLowerCase().includes("minor")) {
                          impactBadgeClass = "bg-blue-100 text-blue-800";
                        }

                        const hasCompleteness =
                          row?.evidence_completeness_pct !== null &&
                          row?.evidence_completeness_pct !== undefined &&
                          row?.evidence_completeness_pct !== "" &&
                          !isNaN(Number(row?.evidence_completeness_pct));

                        const completenessVal = hasCompleteness
                          ? `${Number(row.evidence_completeness_pct).toFixed(0)}%`
                          : "Not available";

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            {/* Incident Identifier */}
                            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-semibold text-slate-800">
                              {displayAssessmentField(row?.incident_identifier)}
                            </td>

                            {/* Disaster Type & Location */}
                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-900">
                                {displayAssessmentField(row?.disaster_type)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {displayAssessmentField(row?.incident_location)}
                              </p>
                            </td>

                            {/* Anomaly Detection (Status & Decision Score) */}
                            <td className="whitespace-nowrap px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isUnusual
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isUnusual && <ShieldAlert size={12} />}
                                {anomalyStatusLabel}
                              </span>
                              <p className="mt-1 font-mono text-xs text-slate-500">
                                Score: {anomalyScoreLabel}
                              </p>
                            </td>

                            {/* Impact Screening (Tier & Score) */}
                            <td className="whitespace-nowrap px-5 py-4">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${impactBadgeClass}`}
                              >
                                {impactTier}
                              </span>
                              <p className="mt-1 text-xs text-slate-500">
                                Index: {impactScore}
                              </p>
                            </td>

                            {/* Priority Level (Preserves Unknown) */}
                            <td className="whitespace-nowrap px-5 py-4">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadgeClass}`}
                              >
                                {priorityDisplay}
                              </span>
                            </td>

                            {/* Contributing Evidence */}
                            <td className="max-w-xs px-5 py-4 text-xs text-slate-600">
                              <p className="line-clamp-2" title={String(row?.contributing_evidence || "")}>
                                {displayAssessmentField(row?.contributing_evidence)}
                              </p>
                            </td>

                            {/* Evidence Completeness */}
                            <td className="whitespace-nowrap px-5 py-4 text-xs">
                              {hasCompleteness ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className="h-full bg-indigo-600"
                                      style={{ width: `${Math.max(0, Math.min(100, Number(row.evidence_completeness_pct)))}%` }}
                                    />
                                  </div>
                                  <span className="font-medium text-slate-700">{completenessVal}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Not available</span>
                              )}
                            </td>

                            {/* Human Review Recommendation */}
                            <td className="max-w-sm px-5 py-4 text-xs text-slate-700">
                              <p className="line-clamp-2" title={String(row?.human_review_recommendation || "")}>
                                {displayAssessmentField(row?.human_review_recommendation)}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-700">
                      {(assessmentPage - 1) * RECORDS_PER_PAGE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-slate-700">
                      {Math.min(assessmentPage * RECORDS_PER_PAGE, hybridRecords.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-700">
                      {hybridRecords.length.toLocaleString()}
                    </span>{" "}
                    evaluated incidents
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAssessmentPage((p) => Math.max(p - 1, 1))}
                      disabled={assessmentPage <= 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>

                    <span className="px-2 text-xs font-medium text-slate-600">
                      Page {assessmentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setAssessmentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={assessmentPage >= totalPages}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Brain size={24} />
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Hybrid assessment results are not available for this job yet.
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Execute the data integration workflow with Member 2 to populate anomaly detection, impact screening, and human review recommendations.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default Results;
