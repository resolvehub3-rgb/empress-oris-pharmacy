/**
 * Coercion of raw Excel cell values into validated, typed values.
 *
 * Excel is messy: numbers arrive as text, dates as serial numbers, booleans as
 * "Yes"/"1"/"TRUE". Everything is normalized here with strict rules so that
 * ambiguous values ("GHS 10", "10,50", "-20") are rejected instead of being
 * silently mangled. Prices are always Ghana Cedi amounts - never converted.
 */

export type CoerceResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const PRICE_RE = /^\d+(?:\.\d+)?$/;
const TRUE_WORDS = new Set(["true", "yes", "y", "t", "1", "required", "rx", "on"]);
const FALSE_WORDS = new Set(["false", "no", "n", "f", "0", "", "notrequired", "not required", "off"]);

/** Trimmed text, or null for blank cells. Non-text primitives are stringified. */
export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim().replace(/\s+/g, " ");
  return text === "" ? null : text;
}

/** Strict money parsing: plain numbers only, in Ghana Cedis, >= 0. */
export function toPrice(value: unknown, label: string, options: { required: boolean }): CoerceResult<number | null> {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: `${label} must be a valid number.` };
    if (value < 0) return { ok: false, reason: `${label} must not be negative (received ${value}).` };
    return { ok: true, value: Math.round(value * 100) / 100 };
  }

  const text = String(value).trim();
  if (!PRICE_RE.test(text)) {
    return {
      ok: false,
      reason: `${label} must be a plain number in GH\u20B5 (received "${text}" - currency symbols, letters, thousands separators and negative values are not accepted).`,
    };
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, reason: `${label} must not be negative.` };
  }
  if (parsed > 999999999.99) {
    return { ok: false, reason: `${label} is out of range.` };
  }
  return { ok: true, value: Math.round(parsed * 100) / 100 };
}

/** Whole-number parsing (quantities, pack size, reorder level). */
export function toInteger(
  value: unknown,
  label: string,
  options: { required: boolean; min: number; max: number; fallback?: number }
): CoerceResult<number | null> {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: options.fallback ?? null };
  }

  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else {
    const text = String(value).trim();
    if (!/^[+-]?\d+$/.test(text)) {
      return { ok: false, reason: `${label} must be a whole number (received "${text}").` };
    }
    parsed = Number(text);
  }

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, reason: `${label} must be a whole number without decimals.` };
  }
  if (parsed < options.min) {
    return { ok: false, reason: `${label} must be ${options.min} or greater (received ${parsed}).` };
  }
  if (parsed > options.max) {
    return { ok: false, reason: `${label} must not exceed ${options.max}.` };
  }
  return { ok: true, value: parsed };
}

/** Normalize the controlled boolean vocabulary used across the app. */
export function toBoolean(value: unknown, label: string): CoerceResult<boolean> {
  if (value === null || value === undefined) return { ok: true, value: false };
  if (typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") {
    if (value === 1) return { ok: true, value: true };
    if (value === 0) return { ok: true, value: false };
    return { ok: false, reason: `${label} must be Yes or No (received ${value}).` };
  }

  const text = String(value).trim().toLowerCase().replace(/\s+/g, "");
  if (TRUE_WORDS.has(text)) return { ok: true, value: true };
  if (FALSE_WORDS.has(text)) return { ok: true, value: false };
  return {
    ok: false,
    reason: `${label} must be one of: Yes, No, TRUE, FALSE, 1, 0 (received "${String(value).trim()}").`,
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function dateToIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 30/02/2026 (JS silently rolls them over).
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Excel serial (1900 system) -> ISO date string. */
function serialToIso(serial: number): string | null {
  // Serial 25569 == 1970-01-01. The 1899-12-30 base handles Excel's 1900 leap-year bug.
  const ms = Math.round((serial - 25569) * 86400000);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return dateToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function jsDateToIso(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return dateToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateString(text: string): string | null {
  const value = text.trim();
  if (!value) return null;

  // ISO: 2028-05-30 or 2028/05/30
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (match) return dateToIso(Number(match[1]), Number(match[2]), Number(match[3]));

  // Day-first: 30/05/2028, 30-05-2028, 30.05.2028 (Ghana convention)
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(value);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return dateToIso(year, Number(match[2]), Number(match[1]));
  }

  // 30 May 2028 / 30-May-2028 / May 30, 2028 / May 30 2028
  match = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{4})$/.exec(value);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (month) return dateToIso(Number(match[3]), month, Number(match[1]));
  }
  match = /^([A-Za-z]{3,9})[\s-]+(\d{1,2})[\s-,]+(\d{4})$/.exec(value);
  if (match) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (month) return dateToIso(Number(match[3]), month, Number(match[2]));
  }

  // Last resort: let the engine parse unambiguous strings ("2028-05-30T00:00:00Z").
  const native = new Date(value);
  if (!Number.isNaN(native.getTime()) && /\d{4}/.test(value)) {
    return dateToIso(native.getUTCFullYear(), native.getUTCMonth() + 1, native.getUTCDate());
  }
  return null;
}

/**
 * Parse a date cell. Handles real JS dates, Excel serial numbers and common
 * text formats (DD/MM/YYYY preferred - Ghana convention - and YYYY-MM-DD),
 * so serial numbers are never stored as garbage text.
 */
export function toDate(value: unknown, label: string, options: { required: boolean }): CoerceResult<string | null> {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: null };
  }

  if (value instanceof Date) {
    const iso = jsDateToIso(value);
    if (iso) return { ok: true, value: iso };
    return { ok: false, reason: `${label} is not a valid date.` };
  }

  if (typeof value === "number") {
    // Excel serial dates: sane window (1990-01-01 .. 2100-12-31).
    if (value >= 32874 && value <= 73415) {
      const iso = serialToIso(value);
      if (iso) return { ok: true, value: iso };
    }
    return {
      ok: false,
      reason: `${label} is not a valid date (received ${value} - enter a real date such as 30/05/2028 or 2028-05-30).`,
    };
  }

  const iso = parseDateString(String(value));
  if (iso) return { ok: true, value: iso };
  return {
    ok: false,
    reason: `${label} is not a valid date (received "${String(value).trim()}"). Use DD/MM/YYYY or YYYY-MM-DD.`,
  };
}

/** Today's date as YYYY-MM-DD on the server, for expiry sanity checks. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
