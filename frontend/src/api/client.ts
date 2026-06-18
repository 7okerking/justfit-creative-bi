/**
 * 后端 API 客户端
 */
import type {
  DesignerRow,
  DimensionLeaderboardRow,
  DimensionKey,
  DrilldownRow,
  GeminiStrategyResponse,
  GlobalFilters,
  GoldenCrossMatrix,
  GoldenCrossRow,
  MaterialLeaderboardRow,
  MaterialSummaryStats,
  MetaResponse,
  SecondaryDimensionKey,
  TrendPoint,
} from "../types";

const ALL_VALUE = "__all__";

function buildQuery(filters: GlobalFilters, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    start: filters.start,
    end: filters.end,
    scope: filters.dataScope,
  });
  const appendList = (key: string, values: string[]) => {
    if (values.length && !values.includes(ALL_VALUE)) {
      params.set(key, values.join(","));
    }
  };
  appendList("fx", filters.fxs);
  appendList("zt", filters.zts);
  appendList("styles", filters.styles);
  appendList("pains", filters.pains);
  appendList("exercises", filters.exercises);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
  }
  return params.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "请求失败: 404（智能排行榜接口不存在）。请在后端目录重启：uvicorn app.main:app --reload --port 8000"
      );
    }
    throw new Error(`请求失败: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMeta(): Promise<MetaResponse> {
  return fetchJson<MetaResponse>("/api/meta");
}

export async function refreshData(): Promise<{ rows: number }> {
  const res = await fetch("/api/refresh", { method: "POST" });
  if (!res.ok) throw new Error("刷新失败");
  return res.json();
}

export interface ComparisonData {
  total_materials_change: number | null;
  ordered_materials_change: number | null;
  total_orders_change: number | null;
  order_rate_change: number | null;
}

export async function fetchGoldenCross(filters: GlobalFilters): Promise<{
  trend: TrendPoint[];
  golden_cross: GoldenCrossRow[];
  golden_cross_matrix: GoldenCrossMatrix;
  material_summary: MaterialSummaryStats;
  comparison: ComparisonData;
  prev_period: { start: string; end: string };
  material_leaderboard: MaterialLeaderboardRow[];
}> {
  return fetchJson(`/api/dashboard/golden-cross?${buildQuery(filters)}`);
}

export async function fetchLeaderboard(
  filters: GlobalFilters,
  options: {
    dims: DimensionKey[];
    minMaterials: number;
  }
): Promise<{
  material_leaderboard: MaterialLeaderboardRow[];
  dimension_leaderboard: DimensionLeaderboardRow[];
}> {
  const extra: Record<string, string> = {
    dims: options.dims.join(","),
    min_materials: String(options.minMaterials),
  };
  const query = buildQuery(filters, extra);
  try {
    return await fetchJson(`/api/dashboard/leaderboard?${query}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("404")) {
      return fetchJson(`/api/dashboard/smart-leaderboard?${query}`);
    }
    throw e;
  }
}

export async function fetchDesignerDashboard(
  filters: GlobalFilters,
  designer?: string,
  drilldownDim?: string
): Promise<{
  leaderboard: DesignerRow[];
  drilldown: DrilldownRow[];
}> {
  const extra: Record<string, string> = {};
  if (designer && designer !== ALL_VALUE) extra.designer = designer;
  if (drilldownDim) extra.drilldown_dim = drilldownDim;
  return fetchJson(`/api/dashboard/designer?${buildQuery(filters, Object.keys(extra).length ? extra : undefined)}`);
}

export async function fetchVault(
  filters: GlobalFilters,
  minPurchases: number
): Promise<{ vault_leaderboard: import("../types").VaultRow[] }> {
  const extra = { min_purchases: String(minPurchases) };
  return fetchJson(`/api/dashboard/vault?${buildQuery(filters, extra)}`);
}

export interface DynamicCrossMatrix {
  row_list: string[];
  col_list: string[];
  row_dim: string;
  col_dim: string;
  cells: {
    row_value: string;
    col_value: string;
    order_rate: number | null;
    total_materials: number;
    ordered_materials: number;
    weighted_roas: number;
  }[];
}

export interface CrossDrilldownRow {
  standard_id: string;
  first_seen_date: string;
  total_purchases: number;
  avg_ctr: number;
  weighted_roas: number;
}

export async function fetchDynamicCrossMatrix(
  filters: GlobalFilters,
  rowDim: string,
  colDim: string
): Promise<DynamicCrossMatrix> {
  const extra = { row_dim: rowDim, col_dim: colDim };
  return fetchJson(`/api/dashboard/cross-matrix?${buildQuery(filters, extra)}`);
}

export async function fetchCrossDrilldown(
  filters: GlobalFilters,
  rowDim: string,
  rowValue: string,
  colDim: string,
  colValue: string
): Promise<{ materials: CrossDrilldownRow[] }> {
  const extra = {
    row_dim: rowDim,
    row_value: rowValue,
    col_dim: colDim,
    col_value: colValue,
  };
  return fetchJson(`/api/dashboard/cross-drilldown?${buildQuery(filters, extra)}`);
}

export async function requestWeeklyInsight(
  filters: GlobalFilters
): Promise<GeminiStrategyResponse> {
  const query = buildQuery(filters);
  const res = await fetch(`/api/ai/weekly-insight?${query}`, { method: "POST" });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI 洞察生成失败(${res.status})：${detail || "未知错误"}`);
  }
  return res.json() as Promise<GeminiStrategyResponse>;
}

export async function requestGeminiStrategy(
  filters: GlobalFilters,
  options: {
    dims: DimensionKey[];
    minMaterials: number;
  }
): Promise<GeminiStrategyResponse> {
  const extra: Record<string, string> = {
    dims: options.dims.join(","),
    min_materials: String(options.minMaterials),
  };
  const query = buildQuery(filters, extra);
  const res = await fetch(`/api/ai/gemini-strategy?${query}`, { method: "POST" });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini 请求失败(${res.status})：${detail || "未知错误"}`);
  }
  return res.json() as Promise<GeminiStrategyResponse>;
}

export interface WeeklyReportData {
  summary: {
    total_materials: number;
    ordered_materials: number;
    total_purchases: number;
    order_rate: number;
    avg_roas: number;
    avg_ctr: number;
    total_spend: number;
  };
  all_materials: WeeklyMaterialRow[];
  ordered_materials: WeeklyMaterialRow[];
  designers: string[];
}

export interface WeeklyMaterialRow {
  rank: number;
  standard_id: string;
  designer: string;
  director: string;
  fx: string;
  total_purchases: number;
  weighted_roas: number;
  avg_ctr: number;
  total_spend: number;
}

export async function fetchWeeklyReport(
  weekStart: string,
  designer?: string
): Promise<WeeklyReportData> {
  const params = new URLSearchParams({ week_start: weekStart });
  if (designer && designer !== ALL_VALUE) params.set("designer", designer);
  return fetchJson(`/api/dashboard/weekly-report?${params.toString()}`);
}

export async function fetchWeeklySavedReport(weekStart: string): Promise<string | null> {
  const data = await fetchJson<{ report: string | null }>(
    `/api/weekly-reports/${encodeURIComponent(weekStart)}`
  );
  return data.report;
}

export async function saveWeeklyReport(weekStart: string, report: string): Promise<void> {
  const res = await fetch(`/api/weekly-reports/${encodeURIComponent(weekStart)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  });
  if (!res.ok) {
    throw new Error(`保存失败(${res.status})`);
  }
}

export { ALL_VALUE };
