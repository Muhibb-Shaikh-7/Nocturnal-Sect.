"use client";

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";

const API_BASE =
  process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL || "http://127.0.0.1:5050";
const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_UPLOAD_ROWS = 5000;
const PREVIEW_ROWS = 10;

const EXPECTED_COLUMNS = [
  "Invoice",
  "CustomerID",
  "CustomerName",
  "Amount",
  "Currency",
  "InvoiceDate",
  "Status",
];

const COLUMN_RULES = {
  Invoice: {
    type: "int",
    required: true,
    description: "Numeric invoice identifier (e.g., 123456).",
  },
  CustomerID: {
    type: "int",
    required: true,
    description: "CRM customer identifier (digits only).",
  },
  CustomerName: {
    type: "string",
    required: true,
    description: "Full customer name (text value).",
  },
  Amount: {
    type: "float",
    required: true,
    description: "Invoice total amount (supports decimals).",
  },
  Currency: {
    type: "string",
    required: true,
    description: "3-letter ISO currency code (USD, EUR, INR…).",
  },
  InvoiceDate: {
    type: "date",
    required: true,
    description: "Invoice date (YYYY-MM-DD or Excel date cell).",
  },
  Status: {
    type: "string",
    required: true,
    description: "Lifecycle status such as Paid / Pending.",
  },
};

const STATUS_META = {
  idle: {
    label: "No file uploaded",
    helper: "Select or drop a file to begin validation.",
    badge: "bg-zinc-800/80 text-zinc-200",
  },
  validating: {
    label: "Validating…",
    helper: "Parsing spreadsheet securely in your browser.",
    badge: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50",
  },
  ready: {
    label: "Ready to upload",
    helper: "Schema looks perfect. Review preview before uploading.",
    badge: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/50",
  },
  uploading: {
    label: "Upload in progress…",
    helper: "Streaming JSON payload to the Flask API.",
    badge: "bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/40",
  },
  success: {
    label: "Upload successful",
    helper: "Backend stored the dataset with audit metadata.",
    badge: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/60",
  },
  invalid: {
    label: "Validation failed",
    helper: "Fix the listed issues and re-validate.",
    badge: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/60",
  },
  error: {
    label: "Upload failed",
    helper: "Server rejected the payload. Check errors below.",
    badge: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/60",
  },
};

const normalizeHeader = (value) => (value ?? "").toString().trim();
const isBlankCell = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");
const isRowEmpty = (row = []) => row.every((cell) => isBlankCell(cell));

const coerceInteger = (value) => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isInteger(parsed) ? parsed : null;
};

const coerceFloat = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value);
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSerialDate = (serial) => {
  if (!Number.isFinite(serial)) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const iso = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  return iso.toISOString().slice(0, 10);
};

const coerceDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return parseSerialDate(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isoCandidate = new Date(trimmed);
    if (!Number.isNaN(isoCandidate.getTime())) {
      return isoCandidate.toISOString().slice(0, 10);
    }
    const match = trimmed.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{2,4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const iso = new Date(Date.UTC(year, month - 1, day));
        return iso.toISOString().slice(0, 10);
      }
    }
  }
  return null;
};

const coerceString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const validateHeaders = (headers) => {
  const errors = [];
  if (headers.length !== EXPECTED_COLUMNS.length) {
    errors.push(
      `Header mismatch. Expected ${EXPECTED_COLUMNS.length} columns but found ${headers.length}.`
    );
    return errors;
  }
  EXPECTED_COLUMNS.forEach((expected, index) => {
    const actual = normalizeHeader(headers[index]);
    if (actual !== expected) {
      errors.push(
        `Column ${index + 1} must be '${expected}' (found '${actual || ""}').`
      );
    }
  });
  return errors;
};

const validateDataRows = (rows) => {
  const sanitized = [];
  const errors = [];
  const warnings = [];

  rows.forEach((cells, rowIndex) => {
    if (isRowEmpty(cells)) return;
    const record = {};
    const rowNumber = rowIndex + 2; // account for header row
    let rowHasError = false;

    EXPECTED_COLUMNS.forEach((column, columnIndex) => {
      const rule = COLUMN_RULES[column];
      const cell = cells[columnIndex];
      const blank = isBlankCell(cell);

      if (blank) {
        record[column] = "";
        if (rule.required) {
          errors.push(`Empty required field '${column}' in row ${rowNumber}.`);
          rowHasError = true;
        }
        return;
      }

      if (rule.type === "int") {
        const value = coerceInteger(cell);
        if (value === null) {
          errors.push(`Row ${rowNumber}: '${column}' must be an integer.`);
          rowHasError = true;
        } else {
          record[column] = value;
        }
        return;
      }

      if (rule.type === "float") {
        const value = coerceFloat(cell);
        if (value === null) {
          errors.push(`Row ${rowNumber}: '${column}' must be a valid number.`);
          rowHasError = true;
        } else {
          record[column] = value;
        }
        return;
      }

      if (rule.type === "date") {
        const value = coerceDate(cell);
        if (!value) {
          errors.push(
            `Row ${rowNumber}: '${column}' must be a valid date (YYYY-MM-DD or Excel date cell).`
          );
          rowHasError = true;
        } else {
          record[column] = value;
        }
        return;
      }

      const text = coerceString(cell);
      if (rule.required && !text) {
        errors.push(`Row ${rowNumber}: '${column}' cannot be blank.`);
        rowHasError = true;
      } else {
        record[column] = column === "Currency" ? text.toUpperCase() : text;
      }
    });

    if (!rowHasError) {
      if (record.Currency && record.Currency.length !== 3) {
        warnings.push(
          `Row ${rowNumber}: Currency '${record.Currency}' should be a 3-letter ISO code.`
        );
      }
      sanitized.push(record);
    }
  });

  if (!sanitized.length && !errors.length) {
    errors.push("Uploaded file does not contain any data rows.");
  }

  if (sanitized.length > MAX_UPLOAD_ROWS) {
    errors.push(
      `Too many rows (${sanitized.length}). Maximum supported rows per upload is ${MAX_UPLOAD_ROWS}.`
    );
  }

  return { rows: sanitized, errors, warnings };
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const triggerDownload = (fileName, base64, mimeType) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function UploadPage() {
  const [status, setStatus] = useState("idle");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [serverMessage, setServerMessage] = useState(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setStatus("idle");
    setErrors([]);
    setWarnings([]);
    setDataset(null);
    setPreviewRows([]);
    setSelectedFile(null);
    setServerMessage(null);
  }, []);

  const handleValidation = useCallback(
    async (file) => {
      setErrors([]);
      setWarnings([]);
      setPreviewRows([]);
      setDataset(null);
      setServerMessage(null);

      if (!file) {
        setStatus("idle");
        setSelectedFile(null);
        return;
      }

      const extMatch = file.name ? file.name.match(/\.[0-9a-zA-Z]+$/) : null;
      const ext = extMatch ? extMatch[0].toLowerCase() : "";
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setErrors(["Only .xlsx, .xls, and .csv files are allowed."]);
        setStatus("invalid");
        setSelectedFile(file);
        return;
      }

      if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
        setErrors([`Unsupported MIME type: ${file.type}`]);
        setStatus("invalid");
        setSelectedFile(file);
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        setErrors(["File exceeds the 3 MB limit."]);
        setStatus("invalid");
        setSelectedFile(file);
        return;
      }

      setSelectedFile(file);
      setStatus("validating");

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) {
          throw new Error("The workbook does not contain any sheets.");
        }
        const sheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (!matrix.length) {
          throw new Error("Uploaded file contains no rows.");
        }
        const headers = (matrix[0] || []).map((cell) => normalizeHeader(cell));
        const headerErrors = validateHeaders(headers);
        if (headerErrors.length) {
          setErrors(headerErrors);
          setStatus("invalid");
          return;
        }

        const { rows, errors: rowErrors, warnings: rowWarnings } = validateDataRows(
          matrix.slice(1)
        );
        if (rowErrors.length) {
          setErrors(rowErrors);
          setStatus("invalid");
          return;
        }

        setDataset({ rows });
        setWarnings(rowWarnings);
        setPreviewRows(rows.slice(0, PREVIEW_ROWS));
        setStatus("ready");
      } catch (error) {
        setErrors([error.message || "Failed to parse the spreadsheet."]);
        setStatus("invalid");
      }
    },
    []
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      handleValidation(file);
    },
    [handleValidation]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      handleValidation(file);
    },
    [handleValidation]
  );

  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    setErrors([]);
    try {
      const response = await fetch(`${API_BASE}/api/uploads/template`);
      if (!response.ok) {
        throw new Error("Unable to download the template right now.");
      }
      const body = await response.json();
      triggerDownload(body.fileName, body.base64, body.mimeType);
    } catch (error) {
      setErrors([error.message || "Failed to download template."]);
      setStatus("invalid");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!dataset?.rows?.length) return;
    setStatus("uploading");
    setErrors([]);
    setServerMessage(null);

    const sanitizedName = uploaderName.trim();
    const sanitizedEmail = uploaderEmail.trim();
    const payload = {
      columns: EXPECTED_COLUMNS,
      data: dataset.rows,
      meta: {
        originalFilename: selectedFile?.name || "unknown.xlsx",
        uploadTime: new Date().toISOString(),
        warnings,
      },
      uploader: {
        name: sanitizedName || "anonymous",
        email: sanitizedEmail || "anonymous@example.com",
        id: sanitizedEmail || sanitizedName || "anonymous",
      },
    };

    try {
      const response = await fetch(`${API_BASE}/api/uploads/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || body.success === false) {
        const incomingErrors = Array.isArray(body.errors) && body.errors.length
          ? body.errors
          : [body.message || body.detail || "Upload failed."];
        setErrors(incomingErrors);
        setStatus(body.errors ? "invalid" : "error");
        return;
      }
      setStatus("success");
      setServerMessage({
        message: body.message,
        uploadId: body.uploadId,
        rowCount: body.rowCount,
      });
    } catch (error) {
      setErrors([error.message || "Unable to upload data right now."]);
      setStatus("error");
    }
  }, [dataset, selectedFile, uploaderEmail, uploaderName, warnings]);

  const statusDetails = STATUS_META[status] || STATUS_META.idle;
  const canUpload = status === "ready" && Boolean(dataset?.rows?.length);

  const dropZoneClasses = useMemo(() => {
    if (status === "ready") return "border-emerald-400/70 bg-emerald-500/5";
    if (status === "invalid" || status === "error") {
      return "border-rose-500/60 bg-rose-500/5";
    }
    if (isDragging) return "border-sky-400/70 bg-sky-500/5";
    if (status === "validating") return "border-amber-400/50 bg-amber-500/5";
    return "border-white/10 bg-zinc-900/60";
  }, [status, isDragging]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-6 lg:px-12 py-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">
              Secure Uploads
            </p>
            <h1 className="text-4xl font-black mt-2">CRM Intake & Validation</h1>
            <p className="text-zinc-400 mt-2 max-w-3xl">
              Validate Excel or CSV files locally with SheetJS, preview the first {PREVIEW_ROWS} rows,
              and upload JSON-only payloads to the Flask API for secondary validation, auditing, and storage.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-semibold shadow-xl ring-1 ring-emerald-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingTemplate ? "Preparing sample…" : "Download sample file"}
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${dropZoneClasses}`}
          >
            <div className="space-y-4">
              <p className="text-lg font-semibold">Drag & drop your spreadsheet</p>
              <p className="text-sm text-zinc-400">
                Formats: {ACCEPTED_EXTENSIONS.join(", ")} • Max size: {formatBytes(MAX_FILE_BYTES)} • Max rows: {MAX_UPLOAD_ROWS}
              </p>
              <div>
                <label className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white cursor-pointer shadow-lg transition hover:scale-[1.02]">
                  <input
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    onChange={handleSelect}
                  />
                  Browse files
                </label>
              </div>
              {selectedFile && (
                <p className="text-sm text-emerald-300">
                  Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
              <p className="text-xs text-zinc-500">
                Files never leave your browser. We parse with SheetJS and send JSON-only payloads to the backend.
              </p>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/5 bg-zinc-950/70 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold">Required format</h3>
            <p className="text-sm text-zinc-400">
              Columns must exactly match this order and spelling.
            </p>
            <div className="rounded-2xl border border-white/5 bg-black/30 max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase tracking-[0.3em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Column</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Required</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {EXPECTED_COLUMNS.map((column) => (
                    <tr key={column}>
                      <td className="px-4 py-3 font-semibold text-white">{column}</td>
                      <td className="px-4 py-3 text-zinc-300">{COLUMN_RULES[column].type}</td>
                      <td className="px-4 py-3 text-zinc-300">{COLUMN_RULES[column].required ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-zinc-400">{COLUMN_RULES[column].description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-400">
              <li>Dates must be ISO (YYYY-MM-DD) or Excel date cells.</li>
              <li>Currencies should be uppercase 3-letter ISO codes.</li>
              <li>Leave optional cells blank instead of typing placeholders.</li>
            </ul>
          </aside>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl space-y-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Status</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold">{statusDetails.label}</h2>
                <span className={`rounded-2xl px-4 py-1 text-xs font-semibold uppercase tracking-wide ${statusDetails.badge}`}>
                  {status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-zinc-400">{statusDetails.helper}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-400">Uploader name (optional)</span>
                <input
                  type="text"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2"
                  value={uploaderName}
                  onChange={(event) => setUploaderName(event.target.value)}
                  placeholder="Ada Lovelace"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-400">Uploader email (optional)</span>
                <input
                  type="email"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2"
                  value={uploaderEmail}
                  onChange={(event) => setUploaderEmail(event.target.value)}
                  placeholder="ada@example.com"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "uploading" ? "Uploading…" : "Upload validated JSON"}
              </button>
              <button
                type="button"
                onClick={resetState}
                className="w-full rounded-2xl border border-white/10 px-6 py-3 text-base font-semibold text-white/80 transition hover:border-white/30"
              >
                Reset form
              </button>
            </div>

            {selectedFile && (
              <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-zinc-300">
                <p className="font-semibold text-sm text-white">File details</p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <span className="text-zinc-500">Name:</span> {selectedFile.name}
                  </li>
                  <li>
                    <span className="text-zinc-500">Size:</span> {formatBytes(selectedFile.size)}
                  </li>
                  <li>
                    <span className="text-zinc-500">Type:</span> {selectedFile.type || "n/a"}
                  </li>
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-zinc-400">
              <p className="font-semibold text-sm text-white">Process overview</p>
              <ol className="mt-3 space-y-2 list-decimal pl-5">
                <li>No file uploaded → choose spreadsheet.</li>
                <li>Validating… → in-browser schema + data checks.</li>
                <li>Validation failed → fix issues if any.</li>
                <li>Ready to upload → preview first rows, confirm.</li>
                <li>Upload in progress… → JSON POST to Flask.</li>
                <li>Upload successful / failed → server response.</li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            {warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-50">
                <p className="font-semibold mb-2">Warnings</p>
                <ul className="list-disc space-y-1 pl-5">
                  {warnings.map((warning, index) => (
                    <li key={`warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {errors.length > 0 && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                <p className="font-semibold mb-2">Validation errors</p>
                <ul className="list-disc space-y-1 pl-5">
                  {errors.map((error, index) => (
                    <li key={`error-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {serverMessage && status === "success" && (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <p className="font-semibold mb-1">Upload successful</p>
                <p className="text-sm text-emerald-100">{serverMessage.message}</p>
                <dl className="mt-3 grid gap-2 text-xs text-emerald-100 sm:grid-cols-2">
                  <div>
                    <dt className="text-emerald-300 uppercase tracking-wide">Upload ID</dt>
                    <dd className="font-mono text-sm">{serverMessage.uploadId}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-300 uppercase tracking-wide">Rows stored</dt>
                    <dd className="text-lg font-semibold">{serverMessage.rowCount}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Data preview (first {PREVIEW_ROWS} rows)</h3>
              <p className="text-sm text-zinc-400">
                Review before uploading. Only the first {PREVIEW_ROWS} rows are displayed here; the full JSON payload includes all {dataset?.rows?.length || 0} rows.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300">
              Rows ready: <span className="font-semibold text-white">{dataset?.rows?.length || 0}</span>
            </div>
          </div>
          {previewRows.length > 0 ? (
            <div className="mt-4 overflow-auto rounded-2xl border border-white/5">
              <table className="w-full text-sm text-left">
                <thead className="text-zinc-400 text-[0.7rem] uppercase tracking-[0.3em]">
                  <tr>
                    {EXPECTED_COLUMNS.map((column) => (
                      <th key={column} className="py-3 px-4 border-b border-white/10">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`preview-row-${rowIndex}`} className="border-b border-white/5 last:border-b-0">
                      {EXPECTED_COLUMNS.map((column) => (
                        <td key={`${rowIndex}-${column}`} className="py-2 px-4 text-zinc-100">
                          {row[column] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center text-sm text-zinc-400">
              No preview available yet. Upload and validate a file to see the first {PREVIEW_ROWS} rows here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
