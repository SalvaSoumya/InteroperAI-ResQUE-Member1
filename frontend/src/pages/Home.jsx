import { useState, useEffect } from "react";
import {
  Database,
  CheckCircle2,
  BriefcaseBusiness,
  ArrowRight,
  Upload,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Send,
  Layers,
  Activity,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";

function Home() {
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("latestUploadResult");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.job_id) {
          setActiveJob(parsed);
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }, []);

  const pipelineStages = [
    {
      step: "1",
      name: "Upload",
      subtitle: "Source Ingestion",
      description:
        "Receive raw disaster datasets (CSV/JSON), calculate metadata, and detect source schema columns.",
      icon: Upload,
      color: "blue",
    },
    {
      step: "2",
      name: "Validate",
      subtitle: "Quality & Constraints",
      description:
        "Perform data type checks, detect missing values, and verify required intake fields before mapping.",
      icon: ShieldCheck,
      color: "emerald",
    },
    {
      step: "3",
      name: "Schema Mapping",
      subtitle: "Semantic Alignment",
      description:
        "Automatically map source headers to canonical disaster response fields using heuristic matching.",
      icon: GitBranch,
      color: "violet",
    },
    {
      step: "4",
      name: "Standardization",
      subtitle: "Canonical Transformation",
      description:
        "Transform records into 20 canonical fields. Unreported casualty and damage values are preserved as Unknown — never fabricated.",
      icon: RefreshCw,
      color: "indigo",
    },
    {
      step: "5",
      name: "API Transfer",
      subtitle: "Secure Dispatch",
      description:
        "Dispatch processed data to Member 2 via authenticated API with X-Source-System and Correlation ID headers.",
      icon: Send,
      color: "amber",
    },
    {
      step: "6",
      name: "Receiver Confirmation",
      subtitle: "Ingestion & Intelligence",
      description:
        "Verify explicit receiver acknowledgment and retrieve multi-tier hybrid disaster assessment and anomaly screening.",
      icon: CheckCircle2,
      color: "teal",
    },
  ];

  return (
    <div className="min-h-screen bg-[#eef4f8]">
      <Sidebar />
      <Navbar />

      <main className="ml-64 pt-20">
        <div className="p-8">

          {/* Active Job Alert Banner if present */}
          {activeJob && (
            <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Active Integration Pipeline
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    Dataset: <span className="font-semibold text-slate-900">{activeJob.filename || "Uploaded File"}</span>
                    {" "}&bull; Job ID: <span className="font-mono text-xs text-blue-700">{activeJob.job_id}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/integration"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue Pipeline &rarr;
                </a>
                <a
                  href="/results"
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  View Results
                </a>
              </div>
            </div>
          )}

          {/* Welcome Section */}
          <section className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-8 text-white shadow-sm">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-blue-100">
                INTEROPERAI-RESQUE PLATFORM &bull; MEMBER 1
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Disaster Data Integration &amp; Transfer Workflow
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
                Connect heterogeneous disaster datasets across emergency response sources,
                validate data quality, map schemas to canonical structures, and transfer standardized
                records to Member 2 for response intelligence and assessment.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/upload"
                  className="flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <Upload size={18} />
                  Upload Dataset
                </a>

                <a
                  href="/integration"
                  className="flex items-center gap-2 rounded-lg border border-blue-300 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600"
                >
                  View Schema Integration
                  <ArrowRight size={18} />
                </a>

                <a
                  href="/job-status"
                  className="flex items-center gap-2 rounded-lg border border-blue-300/60 bg-blue-600/40 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600/70"
                >
                  <Layers size={18} />
                  Job Monitor
                </a>
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="mt-7 grid gap-5 md:grid-cols-3">
            <StatCard
              title="Datasets Ingested"
              value="12"
              description="Across connected disaster sources"
              icon={Database}
            />

            <StatCard
              title="Quality Validated"
              value="10"
              description="Passed data integrity & constraints"
              icon={CheckCircle2}
            />

            <StatCard
              title="Standardized & Transferred"
              value="8"
              description="Confirmed by Member 2 API"
              icon={BriefcaseBusiness}
            />
          </section>

          {/* 6-Stage Disaster Data Pipeline Workflow */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  End-to-End Interoperability Pipeline
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Rigorous 6-stage lifecycle from raw intake to receiver confirmation
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <ShieldCheck size={14} />
                Zero Data Fabrication Guarantee
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pipelineStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.step}
                    className="relative flex flex-col justify-between rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Icon size={20} />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-400">
                          STAGE 0{stage.step}
                        </span>
                      </div>

                      <h3 className="mt-4 font-semibold text-slate-900">
                        {stage.step}. {stage.name}
                      </h3>

                      <p className="text-xs font-medium text-blue-600">
                        {stage.subtitle}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {stage.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Status: Automated</span>
                      <ArrowRight size={13} className="text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent Integration Activity
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Audit log of recent data transformations and Member 2 exchanges
                </p>
              </div>

              <a
                href="/job-status"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View all jobs &rarr;
              </a>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Disaster incident dataset transferred to Member 2
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Confirmed by receiver &bull; 20 canonical fields standardized
                  </p>
                </div>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Confirmed
                </span>
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Flood &amp; storm emergency dataset validated
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    10 source fields detected &bull; Auto-mapped to canonical schema
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Validated
                </span>
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Multi-agency intake CSV received
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Uploaded via ingestion endpoint &bull; Quality check passed
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Ingested
                </span>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

export default Home;