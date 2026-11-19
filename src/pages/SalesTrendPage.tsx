import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getClientSupabase } from "../lib/supabaseClient";

interface Bucket {
  label: string;
  period: string;
  value: number;
}

interface TrendResponse {
  period: string;
  date: string;
  buckets: Bucket[];
}

type Period = "day" | "month" | "year";
type ChartType = "bar" | "line" | "area";
type RtStatus = "connected" | "reconnecting" | "disconnected";

const PRIMARY = "#16A34A";
const HOVER = "#15803D";
const LINE = "#059669";
const AREA_FILL = "#D1FAE5";

function ghanaDateStr(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
}

function ghanaYear(d: Date = new Date()): number {
  return parseInt(d.toLocaleString("en-US", { timeZone: "Africa/Accra", year: "numeric" }));
}

function ghanaMonth(d: Date = new Date()): number {
  return parseInt(d.toLocaleString("en-US", { timeZone: "Africa/Accra", month: "2-digit" }));
}

function ghanaDay(d: Date = new Date()): number {
  return parseInt(d.toLocaleString("en-US", { timeZone: "Africa/Accra", day: "2-digit" }));
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDayDisplay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  });
}

function formatMonthDisplay(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  });
}

export function SalesTrendPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [period, setPeriod] = useState<Period>("day");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedDate, setSelectedDate] = useState<string>(ghanaDateStr());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${ghanaYear()}-${String(ghanaMonth()).padStart(2, "0")}`
  );
  const [selectedYear, setSelectedYear] = useState<number>(ghanaYear());

  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rtStatus, setRtStatus] = useState<RtStatus>("disconnected");
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fetchTrend = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ period });
        if (period === "day") params.set("date", selectedDate);
        if (period === "month") params.set("date", selectedMonth);
        if (period === "year") params.set("date", String(selectedYear));
        const res = await apiRequest<TrendResponse>(`/api/sales-trend?${params.toString()}`);
        setData(res);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Failed to load sales trend");
      } finally {
        setLoading(false);
      }
    },
    [period, selectedDate, selectedMonth, selectedYear]
  );

  const fetchRef = useRef(fetchTrend);
  useEffect(() => {
    fetchRef.current = fetchTrend;
  });

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  // Realtime subscription
  useEffect(() => {
    let cancelled = false;
    let channel: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sbRef: any = null;

    (async () => {
      try {
        const sb = await getClientSupabase();
        if (cancelled || !sb) {
          setRtStatus("disconnected");
          return;
        }
        sbRef = sb;
        channel = sb.channel("pharmacy-realtime");
        channel.on("broadcast", { event: "*" }, (message: any) => {
          const ev = message?.event;
          if (ev === "SALE_COMPLETED" || ev === "REFUND_PROCESSED") {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              fetchRef.current?.(true);
            }, 400);
          }
        });
        channel.subscribe((status: string) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") setRtStatus("connected");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
            setRtStatus(status === "CLOSED" ? "disconnected" : "reconnecting");
        });
      } catch {
        if (!cancelled) setRtStatus("disconnected");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (sbRef && channel) {
        try {
          sbRef.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  // Owner guard
  if (!isOwner) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        Sales Trend is available to the shop owner only.
      </div>
    );
  }

  const buckets = data?.buckets || [];
  const total = buckets.reduce((s, b) => s + (b.value || 0), 0);
  const hasSales = buckets.length > 0 && total > 0;

  const chartData = buckets.map((b) => ({ name: b.label, value: b.value, period: b.period }));

  // Navigation bounds
  const todayStr = ghanaDateStr();
  const currentMonthStr = `${ghanaYear()}-${String(ghanaMonth()).padStart(2, "0")}`;
  const currentYear = ghanaYear();

  const canGoNextDay = selectedDate < todayStr;
  const canGoNextMonth = selectedMonth < currentMonthStr;
  const canGoNextYear = selectedYear < currentYear;

  const handlePrev = () => {
    if (period === "day") setSelectedDate(addDays(selectedDate, -1));
    else if (period === "month") setSelectedMonth(addMonths(selectedMonth, -1));
    else setSelectedYear((y) => y - 1);
  };
  const handleNext = () => {
    if (period === "day" && canGoNextDay) setSelectedDate(addDays(selectedDate, 1));
    else if (period === "month" && canGoNextMonth) setSelectedMonth(addMonths(selectedMonth, 1));
    else if (period === "year" && canGoNextYear) setSelectedYear((y) => y + 1);
  };

  const periodDisplay =
    period === "day"
      ? formatDayDisplay(selectedDate)
      : period === "month"
      ? formatMonthDisplay(selectedMonth)
      : String(selectedYear);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
        <div className="font-semibold">{d.period}</div>
        <div className="mt-0.5">
          Sales: <span className="font-bold">GH₵ {Number(d.value).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="w-9 h-9 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-semibold text-rose-600">{error}</p>
          <button
            onClick={() => fetchTrend()}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      );
    }
    if (!hasSales) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">
            No sales recorded for this period.
          </p>
          <p className="text-xs text-slate-400">
            Completed sales will appear here automatically.
          </p>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 0, bottom: period === "day" ? 30 : 10 },
    };

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={period === "day" ? -45 : 0}
              textAnchor={period === "day" ? "end" : "middle"}
              interval={period === "day" ? 0 : "preserveStartEnd"}
              height={period === "day" ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(v) => `GH₵${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(22,163,74,0.08)" }} />
            <Bar
              dataKey="value"
              fill={PRIMARY}
              radius={[4, 4, 0, 0]}
              animationDuration={prefersReducedMotion ? 0 : 600}
              activeBar={{ fill: HOVER }}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={period === "day" ? -45 : 0}
              textAnchor={period === "day" ? "end" : "middle"}
              interval={period === "day" ? 0 : "preserveStartEnd"}
              height={period === "day" ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(v) => `GH₵${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={LINE}
              strokeWidth={2.5}
              dot={{ r: 3, fill: LINE }}
              activeDot={{ r: 5, fill: HOVER }}
              animationDuration={prefersReducedMotion ? 0 : 600}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LINE} stopOpacity={0.35} />
              <stop offset="95%" stopColor={AREA_FILL} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#64748b" }}
            angle={period === "day" ? -45 : 0}
            textAnchor={period === "day" ? "end" : "middle"}
            interval={period === "day" ? 0 : "preserveStartEnd"}
            height={period === "day" ? 50 : 30}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickFormatter={(v) => `GH₵${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={LINE}
            strokeWidth={2}
            fill="url(#areaGrad)"
            animationDuration={prefersReducedMotion ? 0 : 600}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const rtDotColor =
    rtStatus === "connected"
      ? "bg-emerald-500"
      : rtStatus === "reconnecting"
      ? "bg-amber-500"
      : "bg-slate-400";

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Sales Trend
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
              OWNER ONLY
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Visualize sales performance over time. Updates automatically in real time.
          </p>
        </div>

        {/* Realtime status */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`w-2 h-2 rounded-full ${rtDotColor} ${rtStatus === "connected" ? "animate-pulse" : ""}`} />
          <span className="font-semibold capitalize">{rtStatus}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-auto">
          {(["day", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition capitalize ${
                period === p
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-[140px] text-center text-sm font-bold text-slate-800">
            {periodDisplay}
          </div>
          <button
            onClick={handleNext}
            disabled={
              (period === "day" && !canGoNextDay) ||
              (period === "month" && !canGoNextMonth) ||
              (period === "year" && !canGoNextYear)
            }
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => fetchTrend()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Chart type selector */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-auto">
          <button
            onClick={() => setChartType("bar")}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              chartType === "bar"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Bar
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              chartType === "line"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" /> Line
          </button>
          <button
            onClick={() => setChartType("area")}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              chartType === "area"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Area
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-5">
        <div className="h-[360px] sm:h-[460px] lg:h-[520px] w-full">
          {renderChart()}
        </div>
      </div>
    </div>
  );
}
