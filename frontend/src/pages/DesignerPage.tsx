/**
 * 页面：设计师绩效与下钻复盘
 */
import { Alert, Spin } from "antd";
import { useMemo, useState } from "react";
import { ALL_VALUE, fetchDesignerDashboard } from "../api/client";
import DesignerDrilldown from "../components/DesignerDrilldown";
import DesignerLeaderboard from "../components/DesignerLeaderboard";
import { useAsyncData } from "../hooks/useDashboardData";
import type { DesignerRow, FilterOptions, GlobalFilters } from "../types";

interface Props {
  filters: GlobalFilters;
  filterOptions: FilterOptions;
}

/** 规范化 API 数据，避免缺字段导致页面崩溃 */
function normalizeLeaderboard(rows: DesignerRow[]): DesignerRow[] {
  return rows.map((row) => ({
    ...row,
    burst_contribution_pct: Number(row.burst_contribution_pct ?? 0),
    weighted_roas: Number(row.weighted_roas ?? 0),
    order_rate: Number(row.order_rate ?? 0),
    total_spend: Number(row.total_spend ?? 0),
  }));
}

export default function DesignerPage({ filters, filterOptions }: Props) {
  const [selectedDesigner, setSelectedDesigner] = useState<string>(ALL_VALUE);
  const [drilldownDim, setDrilldownDim] = useState<string>("exercise");

  const fetcher = useMemo(
    () => () =>
      fetchDesignerDashboard(
        filters,
        selectedDesigner !== ALL_VALUE ? selectedDesigner : undefined,
        drilldownDim
      ),
    [
      filters.start,
      filters.end,
      filters.dataScope,
      filters.fxs.join(),
      filters.zts.join(),
      filters.styles.join(),
      filters.pains.join(),
      filters.exercises.join(),
      selectedDesigner,
      drilldownDim,
    ]
  );

  const { data, loading, error } = useAsyncData(fetcher, [fetcher]);

  const handleSelectDesigner = (designer: string | undefined) => {
    setSelectedDesigner(designer ?? ALL_VALUE);
  };

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  if (loading && !data) {
    return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  }

  const leaderboard = normalizeLeaderboard(data?.leaderboard ?? []);

  return (
    <>
      <DesignerLeaderboard
        data={leaderboard}
        loading={loading}
        onSelectDesigner={handleSelectDesigner}
      />
      <DesignerDrilldown
        designers={filterOptions.designers ?? []}
        selected={selectedDesigner}
        onSelect={handleSelectDesigner}
        data={data?.drilldown ?? []}
        loading={loading}
        drilldownDim={drilldownDim}
        onDimChange={setDrilldownDim}
      />
    </>
  );
}
