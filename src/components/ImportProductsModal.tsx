import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ImportConfirmResult,
  ImportHistoryItem,
  ImportPreviewResult,
  ImportRowStatus,
} from "../types";
import { ImportPreviewTable } from "./ImportPreviewTable";
import {
  confirmImportFile,
  downloadImportErrorReport,
  downloadImportTemplate,
  ImportErrorReportEntry,
  previewImportFile,
  fetchImportHistory,
  validateImportFileClient,
} from "../lib/productImport";

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful import so the catalog/dashboard refresh immediately. */
  onSuccess?: () => void;
}

type Stage = "form" | "validating" | "preview" | "confirming" | "done" | "failed";
type RowFilter = "all" | ImportRowStatus;

const CONFIRM_PROGRESS_STAGES = [
  "Preparing import...",
  "Validating rows...",
  "Creating products...",
  "Creating stock...",
  "Updating inventory...",
  "Finalizing import...",
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImportProductsModal({ isOpen, onClose, onSuccess }: ImportProductsModalProps) {
  const [stage, setStage] = useState<Stage>("form");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportConfirmResult | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImport = useRef(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await fetchImportHistory());
    } catch (err) {
      console.warn("[Product Import] History load failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Reset when opened; load the real import history.
  useEffect(() => {
    if (isOpen) {
      setStage("form");
      setSelectedFile(null);
      setFileError(null);
      setPreview(null);
      setFilter("all");
      setFatalError(null);
      setResult(null);
      setProgressIndex(0);
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  // Staged progress feedback while the single confirm request runs.
  useEffect(() => {
    if (stage !== "confirming") return;
    const timer = setInterval(() => {
      setProgressIndex((index) => Math.min(index + 1, CONFIRM_PROGRESS_STAGES.length - 1));
    }, 900);
    return () => clearInterval(timer);
  }, [stage]);

  if (!isOpen) return null;

  const handleChooseFile = (file: File | null) => {
    if (!file) return;
    const validationError = validateImportFileClient(file);
    setFileError(validationError);
    setSelectedFile(validationError ? null : file);
    setPreview(null);
    setFatalError(null);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setFatalError(null);
    try {
      await downloadImportTemplate();
    } catch (err: any) {
      setFatalError(err.message || "Failed to download the template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setFileError("Choose an Excel file first.");
      return;
    }
    setFatalError(null);
    setStage("validating");
    try {
      const previewResult = await previewImportFile(selectedFile);
      setPreview(previewResult);
      setFilter("all");
      setStage("preview");
    } catch (err: any) {
      setFatalError(err.message || "The file could not be validated.");
      setStage("form");
    }
  };

  const buildErrorEntries = (): ImportErrorReportEntry[] => {
    if (!preview) return [];
    const entries: ImportErrorReportEntry[] = [];
    for (const row of preview.rows) {
      if (row.status === "INVALID") {
        entries.push({
          rowNumber: row.rowNumber,
          productName: row.name,
          errorType: "INVALID",
          message: row.errors.join(" | ") || "Row failed validation.",
        });
      } else if (row.status === "DUPLICATE") {
        entries.push({
          rowNumber: row.rowNumber,
          productName: row.name,
          errorType: "DUPLICATE",
          message: row.errors.join(" | ") || "Duplicate product.",
        });
      }
    }
    return entries;
  };

  const handleDownloadErrors = async () => {
    const entries = buildErrorEntries();
    if (entries.length === 0) return;
    setDownloadingErrors(true);
    try {
      await downloadImportErrorReport(entries);
    } catch (err: any) {
      setFatalError(err.message || "Failed to build the error report.");
    } finally {
      setDownloadingErrors(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || pendingImport.current) return;
    pendingImport.current = true;
    setFatalError(null);
    setProgressIndex(0);
    setStage("confirming");
    try {
      const importResult = await confirmImportFile(selectedFile);
      setResult(importResult);
      setStage("done");
      onSuccess?.();
      loadHistory();
    } catch (err: any) {
      setFatalError(err.message || "The import failed. No changes were saved.");
      setStage("failed");
      loadHistory();
    } finally {
      pendingImport.current = false;
    }
  };

  const handleBackToForm = () => {
    setPreview(null);
    setResult(null);
    setFatalError(null);
    setFilter("all");
    setStage("form");
  };

  const filteredRows = preview
    ? filter === "all"
      ? preview.rows
      : preview.rows.filter((row) => row.status === filter.toUpperCase())
    : [];

  const summary = preview?.summary;
  const hasBlockedRows = !!summary && summary.duplicateCount + summary.invalidCount > 0;
  const canConfirm = !!summary && summary.readyCount > 0;

  const filterTabs: Array<{ id: RowFilter; label: string; count: number; className: string }> = summary
    ? [
        { id: "all", label: "All", count: summary.totalRows, className: "bg-slate-900 text-white" },
        { id: "READY", label: "Ready", count: summary.readyCount, className: "bg-emerald-600 text-white" },
        { id: "DUPLICATE", label: "Duplicates", count: summary.duplicateCount, className: "bg-amber-500 text-white" },
        { id: "INVALID", label: "Invalid", count: summary.invalidCount, className: "bg-rose-600 text-white" },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-products-title"
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-4 max-h-[94vh] flex flex-col border border-slate-200"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="import-products-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Import Products from Excel
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Import your existing pharmacy products and opening stock into the live catalog.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          {fatalError && (stage === "form" || stage === "preview") && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">
                <p className="font-semibold">Import cannot continue</p>
                <p className="text-xs mt-1">{fatalError}</p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- STAGE: form */}
          {(stage === "form" || stage === "validating") && (
            <>
              {/* Step 1: template */}
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Download the Excel template</h3>
                    <p className="text-xs text-slate-500">
                      Required columns: <strong>Product Name</strong> and <strong>Selling Price (GH&#8373;)</strong>.
                      All other columns are optional and documented inside the template.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate || stage === "validating"}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloadingTemplate ? "Preparing template..." : "Download Excel Template"}</span>
                </button>
              </section>

              {/* Step 2: upload */}
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upload your completed Excel file</h3>
                    <p className="text-xs text-slate-500">
                      Supported: <strong>.xlsx</strong> and <strong>.xls</strong> &middot; Maximum file size:{" "}
                      <strong>5 MB</strong> &middot; Up to <strong>5,000</strong> product rows per import.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center px-4 py-2.5 border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl text-xs font-bold shadow-2xs transition">
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFile ? "Choose a different file" : "Choose Excel File"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="hidden"
                      onChange={(e) => handleChooseFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  {selectedFile && !fileError && (
                    <div className="flex items-center space-x-2 text-xs text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="truncate max-w-[260px]">{selectedFile.name}</span>
                      <span className="text-slate-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  )}
                </div>

                {fileError && (
                  <p className="text-xs text-rose-700 font-semibold flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{fileError}</span>
                  </p>
                )}

                {/* Import mode */}
                <div className="pt-1 space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Import Mode</p>
                  <label className="flex items-start space-x-2.5 text-xs text-slate-700">
                    <input type="radio" name="import-mode" checked readOnly className="mt-0.5 text-teal-600" />
                    <span>
                      <strong>Add New Products</strong> - only products that do not exist yet are created. Existing
                      products are never modified or overwritten.
                    </span>
                  </label>
                  <label className="flex items-start space-x-2.5 text-xs text-slate-400">
                    <input type="radio" name="import-mode" disabled className="mt-0.5" />
                    <span>
                      Update Existing Products - not enabled in this version (stock and prices are never overwritten
                      blindly by an import).
                    </span>
                  </label>
                </div>
              </section>

              {/* Step 3: preview */}
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Review before importing</h3>
                    <p className="text-xs text-slate-500">
                      Nothing is written to the database until you review the preview and confirm.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!selectedFile || stage === "validating"}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-2"
                >
                  {stage === "validating" ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validating rows...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Preview Import</span>
                    </>
                  )}
                </button>
                <p aria-live="polite" className="sr-only">
                  {stage === "validating" ? "Validating rows..." : ""}
                </p>
              </section>
            </>
          )}

          {/* ----------------------------------------------- STAGE: preview */}
          {stage === "preview" && preview && summary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 text-white">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Rows</p>
                  <p className="text-2xl font-black">{summary.totalRows}</p>
                  <p className="text-[11px] text-slate-400 truncate">in {preview.fileName}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Ready to Import</p>
                  <p className="text-2xl font-black text-emerald-700">{summary.readyCount}</p>
                  <p className="text-[11px] text-emerald-800/70">
                    {summary.withStockCount} with stock &middot; {summary.withoutStockCount} without
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Duplicates</p>
                  <p className="text-2xl font-black text-amber-700">{summary.duplicateCount}</p>
                  <p className="text-[11px] text-amber-800/70">will be skipped</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-rose-700">Invalid Rows</p>
                  <p className="text-2xl font-black text-rose-700">{summary.invalidCount}</p>
                  <p className="text-[11px] text-rose-800/70">will not be imported</p>
                </div>
              </div>

              {/* Extra info / warnings */}
              <div className="space-y-2">
                {summary.newCategories.length > 0 && (
                  <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                    New categories that will be created:{" "}
                    <strong>{summary.newCategories.join(", ")}</strong>
                  </p>
                )}
                {summary.skuGeneratedCount > 0 && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    {summary.skuGeneratedCount} row(s) had no SKU - unique SKUs were generated automatically.
                  </p>
                )}
                {summary.expiredBatchCount > 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {summary.expiredBatchCount} row(s) have an expiry date in the past. They will be imported but
                      cannot be sold through the POS (FEFO rules).
                    </span>
                  </p>
                )}
                {preview.unmappedColumns.length > 0 && (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Columns ignored (not part of the product structure):{" "}
                    <strong>{preview.unmappedColumns.join(", ")}</strong>
                  </p>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                      filter === tab.id
                        ? tab.className
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Preview grid */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <ImportPreviewTable rows={filteredRows} />
              </div>

              {/* Confirmation */}
              <section className="rounded-2xl border-2 border-teal-200 bg-teal-50/40 p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-2xs">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Ready to Import</h3>
                </div>

                <div className="text-xs text-slate-700 space-y-1">
                  <p>
                    <strong className="text-slate-900">{summary.readyCount}</strong> product(s) will be added.
                  </p>
                  <p>
                    <strong className="text-slate-900">{summary.withStockCount}</strong> product(s) include initial
                    stock (batch, expiry and INITIAL_STOCK movement created).
                  </p>
                  <p>
                    <strong className="text-slate-900">{summary.withoutStockCount}</strong> product(s) have no initial
                    stock.
                  </p>
                  <p>
                    <strong className="text-amber-700">{summary.duplicateCount}</strong> duplicate row(s) will be
                    skipped.
                  </p>
                  <p>
                    <strong className="text-rose-700">{summary.invalidCount}</strong> invalid row(s) will not be
                    imported.
                  </p>
                  <p className="pt-1 font-semibold text-slate-900">
                    This action will create real products and inventory records in the production database.
                  </p>
                </div>

                {!canConfirm && (
                  <p className="text-xs text-rose-700 font-semibold flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>There are no valid rows to import. Correct the file and upload it again.</span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBackToForm}
                    className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition"
                  >
                    Back
                  </button>
                  {hasBlockedRows && (
                    <button
                      type="button"
                      onClick={handleDownloadErrors}
                      disabled={downloadingErrors}
                      className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition inline-flex items-center justify-center space-x-1.5 disabled:opacity-60"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadingErrors ? "Building report..." : "Download Error Report"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!canConfirm}
                    className="px-5 py-2.5 text-xs font-black text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-sm transition inline-flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Import</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* --------------------------------------------- STAGE: confirming */}
          {stage === "confirming" && (
            <section className="p-8 sm:p-12 text-center space-y-4" aria-live="polite">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">{CONFIRM_PROGRESS_STAGES[progressIndex]}</p>
              <p className="text-xs text-slate-500">
                Importing {preview?.summary.readyCount ?? 0} products in a single database transaction. Please keep
                this window open.
              </p>
            </section>
          )}

          {/* -------------------------------------------------- STAGE: done */}
          {stage === "done" && result && (
            <section className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                <h3 className="text-base font-black text-emerald-900">Import Completed Successfully</h3>
                <p className="text-xs text-emerald-800">
                  {result.fileName} &middot; {formatDateTime(result.completedAt)}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ResultCard label="Total Rows" value={result.totalRows} />
                <ResultCard label="Imported" value={result.imported} accent="text-emerald-700" />
                <ResultCard label="Duplicates Skipped" value={result.duplicates} accent="text-amber-700" />
                <ResultCard label="Invalid Rows" value={result.invalid} accent="text-rose-700" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ResultCard label="Products Created" value={result.productsCreated} />
                <ResultCard label="Initial Stock Batches" value={result.batchesCreated} />
                <ResultCard label="Stock Movements" value={result.movementsCreated} />
                <ResultCard label="Categories Created" value={result.categoriesCreated} />
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                {result.withStock} product(s) imported with initial stock and {result.withoutStock} without stock.
                Connected screens (Product Catalog, Inventory, Dashboard and POS) refresh automatically through
                Supabase Realtime - no page refresh required.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition inline-flex items-center justify-center space-x-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Another File</span>
                </button>
                {preview && preview.summary.duplicateCount + preview.summary.invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    disabled={downloadingErrors}
                    className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition inline-flex items-center justify-center space-x-1.5 disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    <span>{downloadingErrors ? "Building report..." : "Download Error Report"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition inline-flex items-center justify-center space-x-1.5"
                >
                  <Package className="w-4 h-4" />
                  <span>View Products</span>
                </button>
              </div>
            </section>
          )}

          {/* ------------------------------------------------ STAGE: failed */}
          {stage === "failed" && (
            <section className="space-y-4">
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1.5">
                <AlertCircle className="w-10 h-10 mx-auto text-rose-600" />
                <h3 className="text-base font-black text-rose-900">Import Failed</h3>
                <p className="text-xs text-rose-800 whitespace-pre-wrap">
                  {fatalError || "The import could not be completed."}
                </p>
                <p className="text-xs text-rose-700 font-semibold">
                  The transaction was rolled back - the database was not left in a partial state.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </section>
          )}

          {/* -------------------------------------------------- History */}
          {stage === "form" && (
            <section className="rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                aria-expanded={historyOpen}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition"
              >
                <span className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Import History</span>
                  <span className="text-[11px] font-semibold text-slate-400">({history.length} records)</span>
                </span>
                {historyOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {historyOpen && (
                <div className="overflow-x-auto">
                  {historyLoading ? (
                    <p className="p-4 text-xs text-slate-400">Loading import history...</p>
                  ) : history.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 italic">No product imports have been recorded yet.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5">Date / Time</th>
                          <th className="px-4 py-2.5">File</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                          <th className="px-4 py-2.5 text-right">Imported</th>
                          <th className="px-4 py-2.5 text-right">Failed</th>
                          <th className="px-4 py-2.5">User</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {history.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px]">{item.fileName}</td>
                            <td className="px-4 py-2.5 text-right font-bold">{item.totalRows}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{item.importedRows}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-rose-700">{item.failedRows}</td>
                            <td className="px-4 py-2.5">{item.uploadedByName || "-"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  item.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:block">
            Owner / Admin only &middot; Prices in GH&#8373; &middot; Africa/Accra
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "confirming"}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition disabled:opacity-50"
          >
            {stage === "done" ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
      <p className={`text-2xl font-black ${accent || "text-slate-900"}`}>{value}</p>
    </div>
  );
}
