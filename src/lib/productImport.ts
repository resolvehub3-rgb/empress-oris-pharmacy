/**
 * Client API helpers for the Excel Product Import feature.
 * All requests carry the authenticated session token; template and error
 * report downloads are fetched as authenticated blobs (never via bare links).
 */
import { apiRequest, getAuthToken } from "./api";
import {
  ImportConfirmResult,
  ImportHistoryItem,
  ImportPreviewResult,
} from "../types";

const TEMPLATE_FILE_NAME = "Empress-Oris-Product-Import-Template.xlsx";

export const IMPORT_FILE_EXTENSIONS = [".xlsx", ".xls"];
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(path, { ...init, headers });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Client-side file guard mirroring the backend rules (backend re-checks everything). */
export function validateImportFileClient(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!IMPORT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return `"${file.name}" is not a supported Excel file. Please choose a .xlsx or .xls file.`;
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return `The file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum supported size is 5 MB.`;
  }
  return null;
}

function formDataWithFile(file: File, mode?: string): FormData {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (mode) formData.append("mode", mode);
  return formData;
}

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({} as any));
  return data?.error || `Request failed with status ${response.status}`;
}

/** Upload and validate a workbook without importing anything. */
export async function previewImportFile(file: File): Promise<ImportPreviewResult> {
  const response = await authedFetch("/api/products/import/preview", {
    method: "POST",
    body: formDataWithFile(file),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

/** Upload the same workbook again; the backend re-validates and imports it. */
export async function confirmImportFile(file: File): Promise<ImportConfirmResult> {
  const response = await authedFetch("/api/products/import/confirm", {
    method: "POST",
    body: formDataWithFile(file, "ADD_NEW"),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  return data.result;
}

/** Download the blank Excel template. */
export async function downloadImportTemplate(): Promise<void> {
  const response = await authedFetch("/api/products/import/template");
  if (!response.ok) throw new Error(await parseError(response));
  const blob = await response.blob();
  triggerDownload(blob, TEMPLATE_FILE_NAME);
}

export interface ImportErrorReportEntry {
  rowNumber: number;
  productName: string | null;
  errorType: string;
  message: string;
}

/** Build and download the .xlsx report of failed/duplicate rows. */
export async function downloadImportErrorReport(entries: ImportErrorReportEntry[]): Promise<void> {
  const response = await authedFetch("/api/products/import/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const blob = await response.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `Product-Import-Errors-${stamp}.xlsx`);
}

/** Fetch the real import history records. */
export async function fetchImportHistory(): Promise<ImportHistoryItem[]> {
  const data = await apiRequest<{ history: ImportHistoryItem[] }>("/api/products/import/history");
  return data.history || [];
}
