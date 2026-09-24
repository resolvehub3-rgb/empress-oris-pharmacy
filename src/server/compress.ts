import type { Request, Response, NextFunction } from "express";
import zlib from "node:zlib";

/**
 * Dependency-free gzip middleware (Node's built-in zlib).
 *
 * The POS bundle is large (all pages + scanner/barcode libs), so compressing
 * JSON API responses and static JS/CSS over the wire is the single biggest
 * win for cashier terminals on typical Ghanaian connections.
 *
 * It mirrors what the `compression` package does, but without adding a
 * dependency. Two details matter for correctness:
 *
 *  1. The decision is made lazily on the first write, based on Content-Type
 *     (PNG/WOFF/... are never gzipped).
 *  2. If a response carries no body at all (HEAD, 204, 304), gzip must never
 *     be started: zlib would flush its 20-byte header, which sends the
 *     headers, and any later attempt to drop `Content-Encoding` throws
 *     ERR_HTTP_HEADERS_SENT. Empty responses are passed through untouched
 *     with their original Content-Length restored.
 */

/** Only text-ish payloads are worth (and safe to) gzip. */
const COMPRESSIBLE =
  /^(text\/|application\/(?:json|javascript|xml|manifest\+json|rss\+xml|atom\+xml|x-javascript)|image\/svg\+xml)/i;

function hasPayload(chunk: unknown): boolean {
  if (chunk === undefined || chunk === null) return false;
  if (typeof chunk === "string") return chunk.length > 0;
  if (Buffer.isBuffer(chunk)) return chunk.length > 0;
  if (chunk instanceof Uint8Array) return chunk.length > 0;
  return true;
}

export function gzipCompression() {
  return function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
    const acceptEncoding = String(req.headers["accept-encoding"] || "");
    if (!/\bgzip\b/i.test(acceptEncoding)) {
      return next();
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    let stream: zlib.Gzip | null = null;
    let decided = false;
    let wroteBody = false;
    let ended = false;
    let originalContentLength: string | number | undefined;

    const decide = () => {
      if (decided) return;
      decided = true;
      if (res.headersSent) return;

      const type = String(res.getHeader("Content-Type") || "");
      const alreadyEncoded = res.getHeader("Content-Encoding");
      if (alreadyEncoded || !COMPRESSIBLE.test(type)) return;

      const contentLength = res.getHeader("Content-Length");
      originalContentLength =
        typeof contentLength === "string" || typeof contentLength === "number"
          ? contentLength
          : undefined;

      res.setHeader("Content-Encoding", "gzip");
      const vary = res.getHeader("Vary");
      res.setHeader("Vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
      // Body length changes once gzipped; let Node use chunked encoding.
      res.removeHeader("Content-Length");

      const gz = zlib.createGzip({ level: zlib.constants.Z_DEFAULT_COMPRESSION });
      gz.on("data", (chunk: Buffer) => {
        originalWrite(chunk);
      });
      gz.on("error", (err) => {
        console.error("[Compression] gzip stream error:", err?.message || err);
        try {
          originalEnd();
        } catch {
          // response already closed
        }
      });
      stream = gz;
    };

    /** Nothing was written: drop gzip again before anything reached the wire. */
    const bypassCompression = () => {
      if (stream) {
        stream.destroy();
        stream = null;
      }
      if (!res.headersSent) {
        res.removeHeader("Content-Encoding");
        if (originalContentLength !== undefined) {
          res.setHeader("Content-Length", originalContentLength);
        }
      }
    };

    (res as any).write = function (chunk: any, encoding?: any, cb?: any) {
      if (ended) return false;
      decide();
      // decide() declines (stream stays null) when someone else already sent
      // headers or the payload isn't compressible - pass those through as-is.
      if (!stream) return originalWrite(chunk, encoding, cb);

      if (hasPayload(chunk)) {
        wroteBody = true;
        stream.write(chunk, encoding, cb);
      } else if (typeof cb === "function") {
        cb();
      }
      return true;
    };

    (res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
      // Support the (callback) and (chunk, callback) overloads.
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = undefined;
        encoding = undefined;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = undefined;
      }

      if (ended) {
        if (typeof cb === "function") cb();
        return res;
      }
      ended = true;
      decide();

      const finish = () => {
        originalEnd();
        if (typeof cb === "function") cb();
      };

      const payload = hasPayload(chunk);

      // Empty body (HEAD/204/304 or nothing written): never start the gzip
      // stream, otherwise its header bytes flush the response headers first.
      if (!stream || (!wroteBody && !payload)) {
        if (!wroteBody) bypassCompression();
        if (payload) originalWrite(chunk, encoding);
        finish();
        return res;
      }

      stream.once("end", finish);

      if (payload) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(
              String(chunk),
              (typeof encoding === "string" ? encoding : "utf8") as BufferEncoding
            );
        if (buf.length > 0) {
          wroteBody = true;
          stream.write(buf);
        }
      }
      stream.end();
      return res;
    };

    next();
  };
}
