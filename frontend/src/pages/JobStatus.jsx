import { useEffect, useState } from "react";

import {
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Send,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Server,
  XCircle,
  ArrowRight,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getJobStatus } from "../services/api";

function JobStatus() {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadJobStatus = async () => {
      try {
        const storedResult = sessionStorage.getItem("latestUploadResult");

        if (!storedResult) {
          setError("No uploaded dataset found. Please upload a dataset first.");
          setLoading(false);
          return;
        }

        const uploadResult = JSON.parse(storedResult);
        const jobId = uploadResult?.job_id;

        if (!jobId) {
          setError("Job ID not found in session storage.");
          setLoading(false);
          return;
        }

        const result = await getJobStatus(jobId);
        setJob(result.job);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.detail ||
            "Unable to load job status. Please make sure the backend is running."
        );
      } finally {
        setLoading(false);
      }
    };

    loadJobStatus();
  }, []);

  const jobCompleted = job?.status === "completed";
  const jobPartial = job?.status === "partial";
  const jobFailed = job?.status === "failed";
  const jobProcessing = job?.status === "processing";

  const pStatus = job?.pipeline_status || {};
  const transferDetails = job?.transfer_details || pStatus?.transfer_details;

  const transformationCompleted = Boolean(
    jobCompleted ||
      jobPartial ||
      pStatus?.local_transformation === "completed" ||
      job?.integration_result
  );

  const transferDelivered = Boolean(
    pStatus?.remote_file_receipt === "delivered" ||
      transferDetails?.http_status === 200 ||
      jobCompleted ||
      jobPartial
  );

  const receiverConfirmed = Boolean(
    transferDetails?.receiver_confirmed === true ||
      pStatus?.receiver_confirmation === "confirmed" ||
      jobCompleted
  );

  const steps = [
    {
      title: "1. Dataset Uploaded",
      subtitle: "Source Ingestion",
      description: "Source disaster dataset received and stored with integrity hash.",
      status: job ? "Completed" : "Pending",
      icon: Database,
    },
    {
      title: "2. Data Validation",
      subtitle: "Quality & Constraints",
      description: "Dataset structure, format, and core intake requirements verified.",
      status: job?.validation
        ? job?.validation?.checks?.required_fields === false
          ? "Failed"
          : "Completed"
        : "Pending",
      icon: ShieldCheck,
    },
    {
      title: "3. Schema Mapping",
      subtitle: "Semantic Alignment",
      description: "Source fields matched with canonical disaster-response fields.",
      status: job?.schema_mapping || job?.validation ? "Completed" : "Pending",
      icon: GitBranch,
    },
    {
      title: "4. Canonical Standardization",
      subtitle: "20 Canonical Fields",
      description: transformationCompleted
        ? "Records transformed into 20 canonical fields. Unreported values preserved as Unknown without zero fabrication."
        : "Converts data into 20 standardized disaster fields.",
      status: transformationCompleted
        ? "Completed"
        : jobProcessing
        ? "Processing"
        : pStatus?.local_transformation === "failed"
        ? "Failed"
        : "Pending",
      icon: RefreshCw,
    },
    {
      title: "5. API Transfer",
      subtitle: "Secure Dispatch",
      description: transferDelivered
        ? `Delivered to Member 2 via HTTP POST with X-Source-System and Correlation ID headers.`
        : pStatus?.remote_file_receipt === "failed"
        ? "HTTP dispatch to Member 2 endpoint failed."
        : jobProcessing
        ? "Dispatching dataset to Member 2 API endpoint..."
        : "Prepared dataset will be dispatched to Member 2.",
      status: transferDelivered
        ? "Completed"
        : pStatus?.remote_file_receipt === "failed"
        ? "Failed"
        : jobProcessing
        ? "Processing"
        : "Pending",
      icon: Send,
    },
    {
      title: "6. Receiver Confirmation",
      subtitle: "Ingestion Audit & Intelligence",
      description: receiverConfirmed && jobCompleted
        ? "Member 2 confirmed ingestion and multi-tier assessment results were retrieved."
        : jobPartial
        ? "Delivered to Member 2, but assessment retrieval was incomplete."
        : transferDetails && !receiverConfirmed
        ? "Receiver has not confirmed ingestion. Transfer cannot be marked as fully completed."
        : jobFailed
        ? "Communication or evaluation failed."
        : jobProcessing
        ? "Awaiting receiver ingestion confirmation..."
        : "Awaiting API transfer completion.",
      status: jobCompleted
        ? "Completed"
        : jobPartial
        ? "Partial"
        : transferDetails && !receiverConfirmed
        ? "Unconfirmed"
        : jobFailed
        ? "Failed"
        : jobProcessing
        ? "Processing"
        : "Pending",
      icon: CheckCircle2,
    },
  ];

  const completedSteps = steps.filter((step) => step.status === "Completed").length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="min-h-screen bg-[#eef4f8]">
      <Sidebar />
      <Navbar />

      <main className="ml-64 pt-20">
        <div className="p-8">

          {/* Header */}
          <div className="mb-7">
            <p className="text-sm font-medium text-blue-600">
              STAGE 05 &bull; PROCESS MONITORING &amp; AUDIT
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Integration Job Status &amp; Pipeline Audit
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Track the exact end-to-end progress of dataset validation, canonical transformation,
              secure API dispatch, and Member 2 receiver confirmation.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Loading pipeline status...</p>
            </section>
          )}

          {/* Error */}
          {!loading && error && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertTriangle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </section>
          )}

          {/* Job Content */}
          {!loading && !error && job && (
            <>
              {/* Job Summary Banner */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Job Identifier
                      </p>
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Active Job
                      </span>
                    </div>

                    <h2 className="mt-1 font-mono text-lg font-semibold text-slate-900">
                      {job.job_id}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Source Dataset:{" "}
                      <span className="font-semibold text-slate-800">
                        {job.filename || "Disaster Response Dataset"}
                      </span>
                      {job.source_metadata?.file_size_kb && (
                        <span className="text-slate-400 text-xs">
                          {" "}({job.source_metadata.file_size_kb} KB)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-xs font-medium text-slate-400">Pipeline Completion</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">{progress}%</p>

                    <div className="mt-2 h-2.5 w-48 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          jobCompleted
                            ? "bg-emerald-500"
                            : jobFailed
                            ? "bg-red-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {completedSteps} of {steps.length} stages confirmed
                    </p>
                  </div>
                </div>
              </section>

              {/* 6-Stage Timeline Stepper */}
              <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Processing Pipeline Stages
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Real-time verification of each stage in the interoperability lifecycle.
                    </p>
                  </div>

                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
                    Correlation ID: {transferDetails?.correlation_id?.slice(0, 8) || "N/A"}...
                  </span>
                </div>

                <div className="space-y-1">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const completed = step.status === "Completed";
                    const processing = step.status === "Processing";
                    const partial = step.status === "Partial";
                    const unconfirmed = step.status === "Unconfirmed";
                    const failed = step.status === "Failed";

                    return (
                      <div key={step.title} className="relative flex gap-4">
                        {/* Vertical Connector */}
                        {index < steps.length - 1 && (
                          <div
                            className={`absolute left-5 top-11 h-14 w-px ${
                              completed ? "bg-emerald-300" : "bg-slate-200"
                            }`}
                          ></div>
                        )}

                        {/* Step Icon */}
                        <div
                          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            completed
                              ? "bg-emerald-100 text-emerald-600"
                              : processing
                              ? "bg-blue-100 text-blue-600"
                              : partial || unconfirmed
                              ? "bg-amber-100 text-amber-600"
                              : failed
                              ? "bg-red-100 text-red-600"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <Icon size={19} />
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 pb-7">
                          <div className="flex flex-col justify-between gap-2 sm:flex-row">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-900">
                                  {step.title}
                                </h3>
                                <span className="text-xs font-medium text-slate-400">
                                  &bull; {step.subtitle}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-slate-600">
                                {step.description}
                              </p>
                            </div>

                            <span
                              className={`h-fit whitespace-nowrap self-start sm:self-auto rounded-full px-3 py-1 text-xs font-medium ${
                                completed
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : processing
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : partial || unconfirmed
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : failed
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* API Transfer & Transparency Panel if transfer initiated */}
              {transferDetails && (
                <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Server size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        API Transfer Telemetry &amp; Receiver Audit
                      </h3>
                      <p className="text-xs text-slate-500">
                        Outgoing HTTP request metadata and receiver ingestion confirmation
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Destination Service
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {transferDetails.destination_service || "Member 2 Intelligence API"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 font-mono">
                        {transferDetails.destination_url}
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
                      <p className="mt-0.5 text-[11px] text-slate-500">Dispatch audit time</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        HTTP Response Status
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {transferDetails.http_status ? `${transferDetails.http_status} OK` : "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Endpoint return code</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Standardized Records Sent
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {transferDetails.record_count?.toLocaleString() || "—"} records
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 font-mono truncate">
                        {transferDetails.file_sent}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-xl p-4 border flex items-start gap-3 ${
                      receiverConfirmed
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : jobFailed
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {receiverConfirmed ? (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      ) : jobFailed ? (
                        <XCircle size={18} className="text-red-600" />
                      ) : (
                        <AlertTriangle size={18} className="text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider">
                        Receiver Confirmation Status:
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {transferDetails.receiver_message ||
                          (receiverConfirmed
                            ? "Receiver acknowledged ingestion of standardized dataset."
                            : "Receiver has not confirmed ingestion. Full integration success is not claimed.")}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Current Operation Summary */}
              <section
                className={`mt-7 rounded-2xl border p-6 ${
                  jobCompleted
                    ? "border-emerald-200 bg-emerald-50"
                    : jobPartial
                    ? "border-amber-200 bg-amber-50"
                    : jobFailed
                    ? "border-red-200 bg-red-50"
                    : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ${
                        jobCompleted
                          ? "text-emerald-600"
                          : jobPartial
                          ? "text-amber-600"
                          : jobFailed
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {jobCompleted ? (
                        <CheckCircle2 size={22} />
                      ) : jobPartial || jobFailed ? (
                        <AlertTriangle size={22} />
                      ) : (
                        <Clock3 size={22} />
                      )}
                    </div>

                    <div>
                      <h2
                        className={`font-semibold ${
                          jobCompleted
                            ? "text-emerald-900"
                            : jobPartial
                            ? "text-amber-900"
                            : jobFailed
                            ? "text-red-900"
                            : "text-blue-900"
                        }`}
                      >
                        {jobCompleted
                          ? "Integration & Receiver Ingestion Completed"
                          : jobPartial
                          ? "Partial Integration — Assessment Incomplete"
                          : jobFailed
                          ? "Integration or API Transfer Failed"
                          : jobProcessing
                          ? "Integration Pipeline In Progress"
                          : "Dataset Validated & Ready for Standardization"}
                      </h2>

                      <p
                        className={`mt-1 text-sm leading-5 ${
                          jobCompleted
                            ? "text-emerald-800"
                            : jobPartial
                            ? "text-amber-800"
                            : jobFailed
                            ? "text-red-800"
                            : "text-blue-800"
                        }`}
                      >
                        {jobCompleted
                          ? "The dataset has been successfully standardized into 20 canonical fields, confirmed received by Member 2, and hybrid assessment results were retrieved."
                          : jobPartial
                          ? "The dataset was standardized and delivered to Member 2, but the remote assessment results could not be fully retrieved."
                          : jobFailed
                          ? "Communication with Member 2 API failed or the remote pipeline encountered an error. Please verify network connectivity and tunnel status."
                          : jobProcessing
                          ? "The dataset is currently being processed and exchanged with the intelligence system."
                          : "The dataset has been uploaded and validated. Proceed to the Integration page to standardize into 20 canonical fields and transfer to Member 2."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!transformationCompleted ? (
                      <a
                        href="/integration"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Go to Integration &rarr;
                      </a>
                    ) : (
                      <a
                        href="/results"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        View Results &rarr;
                      </a>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

export default JobStatus;