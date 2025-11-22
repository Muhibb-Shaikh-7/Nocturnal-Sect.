"use client";

import { useCallback, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL || "http://127.0.0.1:8000";
const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];
const MAX_BYTES = 3 * 1024 * 1024;

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [validated, setValidated] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");

  const dropZoneHighlight = useMemo(() => {
    if (status === "valid") return "border-emerald-400/70 bg-emerald-500/5";
    if (errors.length) return "border-rose-400/70 bg-rose-500/5";
    return "border-white/10 bg-zinc-900/60";
  }, [status, errors.length]);

  const resetState = () => {
    setErrors([]);
    setPreview([]);
    setSuccessMessage("");
    setValidated(false);
    setProgress(0);
  };

  const readFile = useCallback(async (file) => {
    resetState();
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrors(["Only .xlsx, .xls, and .csv files are allowed."]);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors([`Unsupported MIME type: ${file.type || "unknown"}`]);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors(["File exceeds 3 MB size limit."]);
      return;
    }

    setSelectedFile(file);
    setStatus("validating");
    setProgress(35);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload/validate`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        const incomingErrors = Array.isArray(body.detail)
          ? body.detail
          : [body.detail || "Validation failed."];
        setErrors(incomingErrors);
        setStatus("error");
        setProgress(0);
        return;
      }
      setPreview(body.preview || []);
      setStatus("valid");
      setValidated(true);
      setProgress(80);
    } catch (err) {
      setErrors([err.message || "Unable to validate file."]);
      setStatus("error");
      setProgress(0);
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      readFile(file);
    },
    [readFile]
  );

  const handleSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      readFile(file);
    },
    [readFile]
  );

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus("uploading");
    setProgress(90);
    setErrors([]);
    setSuccessMessage("");

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("uploader_name", uploaderName);
    form.append("uploader_email", uploaderEmail);

    try {
      const res = await fetch(`${API_BASE}/upload/submit`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        const incomingErrors = Array.isArray(body.detail)
          ? body.detail
          : [body.detail || "Upload failed."];
        setErrors(incomingErrors);
        setStatus("error");
        setProgress(0);
        return;
      }
      setStatus("success");
      setProgress(100);
      setSuccessMessage("Upload complete. File stored securely.");
    } catch (err) {
      setErrors([err.message || "Unable to upload file."]);
      setStatus("error");
      setProgress(0);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-6 lg:px-12 py-10">
      <section className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">
              Secure Uploads
            </p>
            <h1 className="text-4xl font-black mt-2">CRM File Intake</h1>
            <p className="text-zinc-400 mt-2 max-w-2xl">
              Drag-and-drop your validated spreadsheet to run server-side schema checks,
              preview the first 10 rows, and store the file securely with full audit metadata.
            </p>
          </div>
          <a
            href={`${API_BASE}/upload/template`}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-semibold shadow-xl ring-1 ring-emerald-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
          >
            Download Template
          </a>
        </header>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${dropZoneHighlight}`}
        >
          <div className="space-y-4">
            <p className="text-lg font-semibold">Drag & Drop your file here</p>
            <p className="text-sm text-zinc-400">
              Accepted formats: .xlsx, .xls, .csv • Max size: 3 MB
            </p>
            <div>
              <label className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white cursor-pointer shadow-lg transition hover:scale-[1.02]">
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={handleSelect}
                />
                Browse Files
              </label>
            </div>
            {selectedFile && (
              <p className="text-sm text-emerald-300">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
                Status
              </p>
              <h2 className="text-2xl font-semibold">
                {status === "valid"
                  ? "Ready to upload"
                  : status === "uploading"
                  ? "Uploading..."
                  : status === "success"
                  ? "Uploaded"
                  : status === "error"
                  ? "Needs attention"
                  : "Awaiting file"}
              </h2>
            </div>
            <progress
              value={progress}
              max={100}
              className="w-full sm:w-64 h-3 rounded-full overflow-hidden bg-zinc-800"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-400">Uploader Name</span>
              <input
                type="text"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-400">Uploader Email</span>
              <input
                type="email"
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2"
                value={uploaderEmail}
                onChange={(e) => setUploaderEmail(e.target.value)}
                placeholder="ada@example.com"
              />
            </label>
          </div>

          {errors.length > 0 && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p className="font-semibold mb-2">Validation errors</p>
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((err, idx) => (
                  <li key={idx}>{String(err)}</li>
                ))}
              </ul>
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              {successMessage}
            </div>
          )}

          <button
            type="button"
            disabled={!validated || !uploaderName || !uploaderEmail || status === "uploading"}
            onClick={handleUpload}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload securely
          </button>
        </div>

        {preview.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 shadow-2xl overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Preview (first 10 rows)
              </h3>
              <span className="text-sm text-zinc-400">Rows: {preview.length}</span>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-zinc-400 text-[0.7rem] uppercase tracking-[0.3em]">
                <tr>
                  {Object.keys(preview[0] || {}).map((col) => (
                    <th key={col} className="py-2 pr-4 border-b border-white/10">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 last:border-б 0">
                    {Object.entries(row).map(([key, val]) => (
                      <td key={key} className="py-2 pr-4 text-zinc-200">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
