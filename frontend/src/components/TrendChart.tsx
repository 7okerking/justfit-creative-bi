/**
 * 上新日真实成活趋势（First-Seen）
 * - 柱：当日首上线素材数（联动属性筛选）
 * - 实线 A：当日 cohort 累计成活率
 * - 虚线 B：7 日大盘滚动基准（全账户）
 */
import { Alert } from "antd";
import ReactECharts from "echarts-for-react";
import type { TrendPoint } from "../types";

interface Props {
  data: TrendPoint[];
  loading?: boolean;
}

function toLineValue(v: unknown): number | "-" {
  if (v === null || v === undefined || v === "") {
    return "-";
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : "-";
}

function pickRateA(d: TrendPoint): number | "-" {
  if (d.new_material_count <= 0) {
    return "-";
  }
  const v = d.survival_rate ?? d.order_rate;
  return toLineValue(v);
}

function pickRateB(d: TrendPoint): number | "-" {
  return toLineValue(d.rolling_benchmark_rate);
}

export default function TrendChart({ data, loading }: Props) {
  const dates = data.map((d) => d.date);
  const counts = data.map((d) => d.new_material_count);
  const rateA = data.map(pickRateA);
  const rateB = data.map(pickRateB);

  const hasLineA = rateA.some((v) => typeof v === "number");
  const hasLineB = rateB.some((v) => typeof v === "number");
  const hasBars = counts.some((c) => c > 0);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params: Array<{ seriesName: string; value: number | string; axisValue: string }>) => {
        const day = params[0]?.axisValue ?? "";
        const lines = params
          .filter((p) => p.seriesName !== "当日首次上线素材数")
          .map((p) => {
            const val = p.value === "-" ? "无数据" : `${p.value}%`;
            return `${p.seriesName}：${val}`;
          });
        const bar = params.find((p) => p.seriesName === "当日首次上线素材数");
        return [
          `首次上线日：${day}`,
          bar ? `上新素材数：${bar.value}` : "",
          ...lines,
        ]
          .filter(Boolean)
          .join("<br/>");
      },
    },
    legend: {
      data: [
        "当日首次上线素材数",
        "筛选后累计成活率 (A)",
        "7日大盘滚动基准 (B)",
      ],
      bottom: 0,
    },
    grid: { left: 56, right: 56, top: 48, bottom: 56 },
    xAxis: {
      type: "category",
      data: dates,
      name: "首次上线日",
      axisLabel: { rotate: dates.length > 10 ? 35 : 0 },
    },
    yAxis: [
      {
        type: "value",
        name: "素材数",
        position: "left",
        minInterval: 1,
      },
      {
        type: "value",
        name: "成活率 %",
        position: "right",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%" },
      },
    ],
    series: [
      {
        name: "当日首次上线素材数",
        type: "bar",
        yAxisIndex: 0,
        data: counts,
        itemStyle: { color: "#1877f2" },
        barMaxWidth: 36,
        z: 1,
      },
      {
        name: "筛选后累计成活率 (A)",
        type: "line",
        smooth: true,
        yAxisIndex: 1,
        connectNulls: false,
        showSymbol: true,
        symbolSize: 8,
        data: rateA,
        itemStyle: { color: "#52c41a" },
        lineStyle: { width: 2.5, type: "solid", color: "#52c41a" },
        z: 3,
      },
      {
        name: "7日大盘滚动基准 (B)",
        type: "line",
        smooth: true,
        yAxisIndex: 1,
        connectNulls: true,
        showSymbol: true,
        symbolSize: 6,
        data: rateB,
        itemStyle: { color: "#fa8c16" },
        lineStyle: { width: 2, type: "dashed", color: "#fa8c16" },
        z: 2,
      },
    ],
  };

  return (
    <div className="chart-card">
      <div className="card-title">
        上新日真实成活趋势 · First-Seen 归因 + 7日大盘晴雨表
      </div>
      {!loading && data.length > 0 && !hasLineA && !hasLineB && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前日期区间内无成活率折线"
          description="请将顶部日历调到有素材首次上线日的范围（可参考 data_inputs 文件名日期），并确认后端已重启。"
        />
      )}
      {!loading && hasLineB && !hasLineA && !hasBars && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="属性筛选后当日无上新素材"
          description="橙色虚线 B 仍代表大盘晴雨表；绿色实线 A 需取消过窄的属性筛选或扩大日期范围。"
        />
      )}
      <ReactECharts
        option={option}
        style={{ height: 400 }}
        showLoading={loading}
        notMerge
        lazyUpdate={false}
      />
    </div>
  );
}
