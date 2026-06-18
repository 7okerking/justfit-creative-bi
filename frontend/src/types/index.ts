/** API 与看板通用类型定义 */

export interface DateRange {
  min: string | null;
  max: string | null;
  first_seen_min?: string | null;
  first_seen_max?: string | null;
}

export interface FilterOptions {
  fx: string[];
  zt: string[];
  styles: string[];
  pains: string[];
  exercises: string[];
  designers: string[];
}

export interface MetaResponse {
  date_range: DateRange;
  filters: FilterOptions;
  row_count: number;
  file_count: number;
}

export interface TrendPoint {
  /** 横轴：首次上线日期 */
  date: string;
  new_material_count: number;
  /** 曲线 A：筛选后 cohort 累计成活率 %（当日无上线可为 null） */
  survival_rate?: number | null;
  /** 兼容旧字段 */
  order_rate: number;
  /** 曲线 B：7 日大盘滚动基准成活率 %（不受属性筛选） */
  rolling_benchmark_rate?: number | null;
}

export interface GoldenCrossRow {
  fx: string;
  zt: string;
  fx_zt: string;
  total_materials: number;
  ordered_materials: number;
  order_rate: number;
  total_spend: number;
  weighted_roas: number;
}

export interface DesignerRow {
  designer: string;
  total_materials: number;
  ordered_materials: number;
  order_rate: number;
  total_spend: number;
  weighted_roas: number;
  total_purchases?: number;
  burst_contribution_pct?: number;
}

export interface GoldenCrossMatrix {
  fx_list: string[];
  zt_list: string[];
  cells: {
    fx: string;
    zt: string;
    order_rate: number | null;
    total_materials: number;
    ordered_materials: number;
    weighted_roas: number;
  }[];
}


export interface MaterialSummaryStats {
  total_materials: number;
  ordered_materials: number;
  total_orders: number;
  order_rate: number;
  two_plus_rate: number;
  five_plus_rate: number;
  two_plus_materials: number;
  five_plus_materials: number;
}

export interface MaterialLeaderboardRow {
  rank: number;
  standard_id: string;
  first_seen_date?: string;
  fx?: string;
  zt?: string;
  style?: string;
  pain?: string;
  exercise?: string;
  designer: string;
  director: string;
  total_purchases: number;
  has_order?: boolean;
  weighted_roas: number;
  avg_ctr: number;
  avg_cpc?: number;
  total_spend: number;
}

export interface DimensionLeaderboardRow {
  rank: number;
  dimension_label: string;
  primary_value: string;
  secondary_value: string;
  total_materials: number;
  ordered_materials: number;
  order_rate: number;
  total_purchases: number;
  weighted_roas: number;
  total_spend: number;
}

export interface GeminiStrategyResponse {
  report_markdown: string;
  input_markdown: string;
}

export type DimensionKey = "zt" | "fx" | "style" | "pain" | "exercise";
export type SecondaryDimensionKey = DimensionKey | "none";

export interface DrilldownRow {
  fx: string;
  secondary_value: string;
  combo: string;
  total_materials: number;
  ordered_materials: number;
  order_rate: number;
  weighted_roas: number;
}

export interface VaultRow {
  rank: number;
  standard_id: string;
  fx: string;
  total_purchases: number;
  avg_ctr: number;
  weighted_roas: number;
  total_spend: number;
  spend_status: string;
}

export type DataScope = "account" | "new";

export interface GlobalFilters {
  start: string;
  end: string;
  dataScope: DataScope;
  fxs: string[];
  zts: string[];
  styles: string[];
  pains: string[];
  exercises: string[];
}

export type PresetKey = "custom" | "yesterday" | "last7" | "last30";
