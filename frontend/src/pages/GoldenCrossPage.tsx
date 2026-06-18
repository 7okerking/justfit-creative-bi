/**
 * 页面 1：素材黄金交叉复盘（主页）
 */
import { Alert, Empty, Spin } from "antd";
import { useMemo } from "react";
import { fetchGoldenCross } from "../api/client";
import DynamicCrossHeatmap from "../components/DynamicCrossHeatmap";
import GoldenCrossMaterialRank from "../components/GoldenCrossMaterialRank";
import TrendChart from "../components/TrendChart";
import WeeklyInsight from "../components/WeeklyInsight";
import { useAsyncData } from "../hooks/useDashboardData";
import type { GlobalFilters } from "../types";

interface Props {
  filters: GlobalFilters;
}

export default function GoldenCrossPage({ filters }: Props) {
  const fetcher = useMemo(
    () => () => fetchGoldenCross(filters),
    [
      filters.start,
      filters.end,
      filters.dataScope,
      filters.fxs.join(),
      filters.zts.join(),
      filters.styles.join(),
      filters.pains.join(),
      filters.exercises.join(),
    ]
  );

  const { data, loading, error } = useAsyncData(fetcher, [fetcher]);

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  if (loading && !data) {
    return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  }

  const trend = data?.trend ?? [];
  const fallbackSummary = {
    total_materials: 0,
    ordered_materials: 0,
    total_orders: 0,
    order_rate: 0,
    two_plus_rate: 0,
    five_plus_rate: 0,
    two_plus_materials: 0,
    five_plus_materials: 0,
  };
  const summary = data?.material_summary ?? fallbackSummary;
  const comparison = data?.comparison ?? null;
  const prevPeriod = data?.prev_period;
  const prevPeriodLabel = prevPeriod
    ? `${prevPeriod.start === prevPeriod.end ? "上周同天" : `${prevPeriod.start}~${prevPeriod.end}`}`
    : "上周期";

  if (!loading && trend.length === 0) {
    return (
      <Empty
        description="当前时间范围内无数据，请调整日历或检查 data 文件夹"
        style={{ margin: "48px 0" }}
      />
    );
  }

  return (
    <>
      <GoldenCrossMaterialRank
        summary={summary}
        comparison={comparison}
        prevPeriodLabel={prevPeriodLabel}
        dataScope={filters.dataScope}
        loading={loading}
      />
      <TrendChart data={trend} loading={loading} />
      <WeeklyInsight filters={filters} />
      <DynamicCrossHeatmap filters={filters} />
    </>
  );
}
