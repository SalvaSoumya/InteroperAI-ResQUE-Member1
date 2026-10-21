import { useState } from "react";
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { uploadDataset } from "../services/api";

function Upload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    setError("");
    setUploadResult(null);

    if (!file) {
      return;
    }

    const allowedTypes = [".csv", ".json"];

    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedTypes.includes(fileExtension)) {
      setError("Please select a CSV or JSON file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      setUploadResult(null);

      const jobId = `job-${Date.now()}`;

      const result = await uploadDataset(
        selectedFile,
        jobId
      );

      setUploadResult(result);

      // Save the latest upload result for the Validation page
      sessionStorage.setItem(
        "latestUploadResult",
        JSON.stringify(result)
      );

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Upload failed. Please make sure the FastAPI server is running."
      );

    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef4f8]">

      {/* Existing application layout */}
      <Sidebar />
      <Navbar />

      {/* Main Content */}
      <main className="ml-64 pt-20">

        <div className="p-8">

          {/* Header */}
          <div className="mb-7">

            <p className="text-sm font-medium text-blue-600">
              DATA INGESTION
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Upload Dataset
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Upload disaster-related CSV or JSON data for validation
              and integration with emergency-response systems.
            </p>

          </div>


          {/* Upload Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UploadIcon size={24} />
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Upload Disaster Dataset
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Supported formats: CSV and JSON
                  </p>

                </div>

              </div>

            </div>


            {/* Upload Area */}
            <div className="mt-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <UploadIcon
                  size={26}
                  className="text-blue-600"
                />
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Select a dataset to upload
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Upload a CSV or JSON disaster-response dataset
              </p>


              {/* Choose File */}
              <label className="mt-5 inline-block">

                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                  <UploadIcon size={17} />
                  Choose File
                </span>

              </label>


              {/* Selected File */}
              {selectedFile && (
                <div className="mx-auto mt-7 flex max-w-2xl items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <FileText
                        size={20}
                        className="text-blue-600"
                      />
                    </div>

                    <div>

                      <p className="text-sm font-semibold text-slate-900">
                        {selectedFile.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>

                    </div>

                  </div>


                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading
                      ? "Uploading..."
                      : "Upload Dataset"}
                  </button>

                </div>
              )}


              {/* Error */}
              {error && (
                <div className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">

                  <AlertCircle size={19} />

                  <span>
                    {error}
                  </span>

                </div>
              )}


              {/* Success */}
              {uploadResult && (
                <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-left">

                  <div className="flex items-center gap-2 font-semibold text-emerald-700">

                    <CheckCircle size={19} />

                    Dataset uploaded successfully

                  </div>


                  <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">

                    <div>

                      <p className="text-xs text-slate-500">
                        Job ID
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {uploadResult.job_id}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs text-slate-500">
                        Rows
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {uploadResult.validation.row_count}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs text-slate-500">
                        Columns
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {uploadResult.validation.column_count}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs text-slate-500">
                        Validation
                      </p>

                      <p className="mt-1 text-sm font-semibold text-emerald-600">
                        {uploadResult.validation.overall_status}
                      </p>

                    </div>

                  </div>

                </div>
              )}

            </div>

          </section>


          {/* Upload Information */}
          <section className="mt-7 grid gap-5 md:grid-cols-3">

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <p className="text-sm font-semibold text-slate-900">
                Supported Formats
              </p>

              <p className="mt-2 text-sm text-slate-500">
                CSV and JSON datasets are supported.
              </p>

            </div>


            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <p className="text-sm font-semibold text-slate-900">
                Automatic Validation
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Uploaded data is automatically checked for quality.
              </p>

            </div>


            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <p className="text-sm font-semibold text-slate-900">
                API Integration
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Validated data can continue to the integration stage.
              </p>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default Upload;