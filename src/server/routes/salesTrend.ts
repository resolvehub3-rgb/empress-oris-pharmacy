import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";

export const salesTrendRouter = Router();

interface Bucket {
  label: string;
  period: string;
  value: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hour12(h: number): number {
  const r = h % 12;
  return r === 0 ? 12 : r;
}

function ampm(h: number): string {
  return h >= 12 ? "PM" : "AM";
}

function formatHourLabel(h: number): string {
  return `${pad2(h)}:00`;
}

function monthShort(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "Africa/Accra",
  });
}

function monthLong(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "Africa/Accra",
  });
}

salesTrendRouter.get(
  "/",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });

    const period = String(req.query.period || "day");
    const dateParam = req.query.date ? String(req.query.date) : null;

    try {
      const now = new Date();
      const ghanaDate = now.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
      const ghanaYear = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", year: "numeric" })
      );
      const ghanaMonth = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", month: "2-digit" })
      );
      const ghanaDay = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", day: "2-digit" })
      );
      const ghanaHour = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", hour: "2-digit", hour12: false })
      );

      // ---------- DAY ----------
      if (period === "day") {
        const d = dateParam || ghanaDate;
        const isFuture = d > ghanaDate;
        const isToday = d === ghanaDate;

        const buckets: Bucket[] = [];
        if (!isFuture) {
          const endHour = isToday ? ghanaHour : 23;

          const rows = await rawSql`
            SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS hour,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND (created_at AT TIME ZONE 'Africa/Accra')::date = ${d}::date
            GROUP BY hour
          `;
          const map = new Map<number, number>(
            rows.map((r: any) => [Number(r.hour), Number(r.amount)])
          );

          for (let h = 0; h <= endHour; h++) {
            const next = h === 23 ? 0 : h + 1;
            const nextDay = h === 23;
            const nextAmpm = nextDay ? "AM" : ampm(next);
            const nextHour = nextDay ? 12 : hour12(next);
            buckets.push({
              label: formatHourLabel(h),
              period: `${hour12(h)}:00 ${ampm(h)} – ${nextHour}:00 ${nextAmpm}`,
              value: map.get(h) || 0,
            });
          }
        }

        return res.json({ period, date: d, buckets });
      }

      // ---------- MONTH ----------
      if (period === "month") {
        const d = dateParam || `${ghanaYear}-${pad2(ghanaMonth)}`;
        const [yStr, mStr] = d.split("-");
        const y = parseInt(yStr);
        const m = parseInt(mStr);
        const isFuture = y > ghanaYear || (y === ghanaYear && m > ghanaMonth);
        const isCurrent = y === ghanaYear && m === ghanaMonth;

        const buckets: Bucket[] = [];
        if (!isFuture) {
          const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const maxDay = isCurrent ? ghanaDay : lastDay;

          const rows = await rawSql`
            SELECT EXTRACT(DAY FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS day,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${y}
              AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${m}
            GROUP BY day
          `;
          const map = new Map<number, number>(
            rows.map((r: any) => [Number(r.day), Number(r.amount)])
          );

          for (let day = 1; day <= maxDay; day++) {
            const dateStr = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" }
            );
            buckets.push({
              label: String(day),
              period: dateStr,
              value: map.get(day) || 0,
            });
          }
        }

        return res.json({ period, date: d, buckets });
      }

      // ---------- YEAR ----------
      if (period === "year") {
        const y = parseInt(dateParam || String(ghanaYear));
        const isFuture = y > ghanaYear;
        const isCurrent = y === ghanaYear;

        const buckets: Bucket[] = [];
        if (!isFuture) {
          const maxMonth = isCurrent ? ghanaMonth : 12;

          const rows = await rawSql`
            SELECT EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS month,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${y}
            GROUP BY month
          `;
          const map = new Map<number, number>(
            rows.map((r: any) => [Number(r.month), Number(r.amount)])
          );

          for (let mth = 1; mth <= maxMonth; mth++) {
            buckets.push({
              label: monthShort(y, mth),
              period: `${monthLong(y, mth)} ${y}`,
              value: map.get(mth) || 0,
            });
          }
        }

        return res.json({ period, date: String(y), buckets });
      }

      return res.status(400).json({ error: "Invalid period. Use day, month, or year." });
    } catch (err: any) {
      console.error("[Sales Trend] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch sales trend" });
    }
  }
);
