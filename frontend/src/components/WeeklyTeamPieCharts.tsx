/**
 * 周报团队出单分析饼图 - 方案B（出单贡献占比）+ 内部设计师二级下钻
 */
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { useMemo, useState } from "react";

export interface TeamStats {
  name: string;
  total: number;
  ordered: number;
  orderRate: number;
}

export interface WeeklyTeamPieChartsProps {
  teamStats: TeamStats[];
  internalDesignerStats: TeamStats[];
  onDesignerSelect?: (designer: string | null) => void;
}

const COLORS = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272"];

export default function WeeklyTeamPieCharts({
  teamStats,
  internalDesignerStats,
  onDesignerSelect,
}: WeeklyTeamPieChartsProps) {
  const [drillLevel, setDrillLevel] = useState<"team" | "internal">("team");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const currentStats = drillLevel === "team" ? teamStats : internalDesignerStats;
  const totalOrdered = useMemo(
    () => teamStats.reduce((s, t) => s + t.ordered, 0),
    [teamStats]
  );

  const option = useMemo(() => {
    const data = currentStats
      .filter((t) => t.ordered > 0)
      .map((t) => ({
        name: t.name,
        value: t.ordered,
        orderRate: Math.round(t.orderRate * 10000) / 100,
        total: t.total,
      }));
    return {
      title: {
        text: drillLevel === "team" ? "团队出单贡献占比" : "内部设计师 · 出单贡献占比",
        left: "center",
        top: 0,
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const d = p.data;
          const pct = totalOrdered > 0 ? ((d.value / totalOrdered) * 100).toFixed(1) : "0";
          return `${p.name}<br/>出单数：${d.value}（占比 ${pct}%）<br/>总素材：${d.total}<br/>出单率：${d.orderRate}%`;
        },
      },
      legend: { bottom: 0, left: "center" },
      series: [
        {
          type: "pie",
          radius: ["30%", "65%"],
          center: ["50%", "50%"],
          data,
          label: {
            formatter: (p: any) => {
              const pct = totalOrdered > 0 ? ((p.data.value / totalOrdered) * 100).toFixed(1) : "0";
              return `${p.name}\n${p.data.value}单 (${pct}%)`;
            },
            fontSize: 12,
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
        },
      ],
      color: COLORS,
    };
  }, [currentStats, totalOrdered, drillLevel]);

  const handleChartClick = (params: any) => {
    if (drillLevel === "team" && params.name === "内部设计师") {
      setDrillLevel("internal");
      setSelectedName(null);
      onDesignerSelect?.(null);
    } else if (drillLevel === "internal") {
      const name = params.name as string;
      setSelectedName(name);
      onDesignerSelect?.(name);
    }
  };

  const handleBack = () => {
    setDrillLevel("team");
    setSelectedName(null);
    onDesignerSelect?.(null);
  };

  const chartEvents = { click: handleChartClick };

  return (
    <div className="table-card">
      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        团队出单分析
        {drillLevel === "internal" && (
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          >
            返回团队总览
          </Button>
        )}
        {selectedName && (
          <span style={{ fontSize: 12, color: "#1677ff", fontWeight: 400 }}>
            已选中：{selectedName}（下方表格已联动筛选）
          </span>
        )}
      </div>
      {drillLevel === "team" && (
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 8 }}>
          点击"内部设计师"扇区可查看内部各设计师明细，点击设计师扇区可联动筛选下方表格
        </div>
      )}
      {drillLevel === "internal" && !selectedName && (
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 8 }}>
          点击设计师扇区可联动筛选下方出单素材明细和全部素材表格
        </div>
      )}
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <ReactECharts
          option={option}
          style={{ height: 320 }}
          onEvents={chartEvents}
          notMerge
        />
      </div>
    </div>
  );
}
