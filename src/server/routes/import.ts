/**
 * Excel product import API.
 *
 *   GET  /api/products/import/template      - download the blank Excel template
 *   POST /api/products/import/preview       - upload + parse + validate (no writes)
 *   POST /api/products/import/confirm       - upload again + import (single transaction)
 *   POST /api/products/import/error-report  - download an .xlsx error report
 *   GET  /api/products/import/history       - real import history records
 *
 * Every route requires an authenticated Shop Owner/Admin - authorization is
 * enforced on the backend, never inferred from the UI.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { getDb } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import {
  ImportError,
  MAX_FILE_BYTES,
  UploadedExcelFile,
} from "../import/excel";
import {
  confirmImport,
  getImportHistory,
  previewImport,
} from "../import/importService";
import {
  buildErrorReportBuffer,
  buildTemplateBuffer,
  errorReportFileName,
  templateFileName,
} from "../import/template";

export const importRouter = Router();

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    const extension = name.slice(name.lastIndexOf("."));
    const mimeOk =
      !file.mimetype ||
      [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
        "application/binary",
        "application/x-ole-storage",
        "application/x-ole-object",
      ].includes(file.mimetype.toLowerCase());
    // Rejected files surface as "no file" -> clear 400 in the handler.
    cb(null, ALLOWED_EXTENSIONS.includes(extension) && mimeOk);
  },
});

function toUploadedFile(file: Express.Multer.File): UploadedExcelFile {
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };
}

function sendImportError(res: Response, err: unknown, context: string): Response {
  if (err instanceof ImportError) {
    const status =
      err.code === "DB_CONFLICT" ? 409 : err.code === "TOO_MANY_ROWS" ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  console.error(`[Product Import] ${context} failed:`, err);
  // Unexpected errors are logged server-side only; clients get a generic message.
  return res.status(500).json({
    error: "The import failed unexpectedly. No changes were saved. Please try again.",
  });
}

function requireDatabase(res: Response): boolean {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected." });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/products/import/template - blank Excel template (headers only)
// ---------------------------------------------------------------------------
importRouter.get(
  "/template",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  (req: Request, res: Response) => {
    try {
      const buffer = buildTemplateBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${templateFileName()}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.end(buffer);
    } catch (err) {
      return sendImportError(res, err, "Template generation");
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/products/import/preview - validate only, writes nothing
// ---------------------------------------------------------------------------
importRouter.post(
  "/preview",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  excelUpload.single("file"),
  async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    if (!req.file) {
      return res.status(400).json({
        error: "A valid Excel file is required (.xlsx or .xls, maximum 5 MB).",
      });
    }

    try {
      const result = await previewImport(toUploadedFile(req.file), req.user!);
      return res.json(result);
    } catch (err) {
      return sendImportError(res, err, "Preview");
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/products/import/confirm - re-validate server-side and import
// ---------------------------------------------------------------------------
importRouter.post(
  "/confirm",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  excelUpload.single("file"),
  async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    if (!req.file) {
      return res.status(400).json({
        error: "A valid Excel file is required (.xlsx or .xls, maximum 5 MB).",
      });
    }

    try {
      const result = await confirmImport(
        toUploadedFile(req.file),
        req.user!,
        (req.body as any)?.mode || "ADD_NEW",
        req.ip
      );
      return res.status(201).json({ success: true, result });
    } catch (err) {
      return sendImportError(res, err, "Confirm");
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/products/import/error-report - downloadable .xlsx error report
// ---------------------------------------------------------------------------
const errorReportSchema = z.object({
  entries: z
    .array(
      z.object({
        rowNumber: z.number().int().min(1),
        productName: z.string().max(300).nullable(),
        errorType: z.string().max(60),
        message: z.string().max(1000),
      })
    )
    .min(1)
    .max(6000),
});

importRouter.post(
  "/error-report",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  (req: Request, res: Response) => {
    try {
      const parsed = errorReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid error report payload." });
      }

      const buffer = buildErrorReportBuffer(parsed.data.entries);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${errorReportFileName()}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.end(buffer);
    } catch (err) {
      return sendImportError(res, err, "Error report");
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/products/import/history - real past imports
// ---------------------------------------------------------------------------
importRouter.get(
  "/history",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const history = await getImportHistory();
      return res.json({ history });
    } catch (err) {
      return sendImportError(res, err, "History");
    }
  }
);
