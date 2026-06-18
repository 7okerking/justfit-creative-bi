/**
 * 黄金交叉页 · 素材成效统计模块（含环比对比箭头）
 */
import { Col, Empty, Row, Skeleton, Statistic } from "antd";
import type { ComparisonData } from "../api/client";
import type { DataScope, MaterialSummaryStats } from "../types";

interface Props {
  summary: MaterialSummaryStats;
  comparison?: ComparisonData | null;
  prevPeriodLabel?: string;
  dataScope: DataScope;
  loading?: boolean;
}

function pct(v: number) {
  return `${Number(v ?? 0).toFixed(2)}%`;
}

function ChangeTag({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return <span className="compare-tag compare-tag--na">对比{label} —</span>;
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? "#52c41a" : isDown ? "#f5222d" : "#8c8c8c";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return (
    <span className="compare-tag" style={{ color }}>
      对比{label} {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatItem({
  title,
  value,
  change,
  compareLabel,
}: {
  title: string;
  value: string | number;
  change?: number | null;
  compareLabel?: string;
}) {
  return (
    <div className="material-stat-item">
      <Statistic title={title} value={value} />
      {compareLabel && <ChangeTag value={change} label={compareLabel} />}
    </div>
  );
}

export default function GoldenCrossMaterialRank({
  summary,
  comparison,
  prevPeriodLabel,
  dataScope,
  loading,
}: Props) {
  const cardTitle = dataScope === "new" ? "上新素材成效统计" : "账户内成效统计";
  const totalLabel = dataScope === "new" ? "上新素材总数" : "账户内素材总数";
  const cmpLabel = prevPeriodLabel || "上周期";

  if (loading) {
    return (
      <div className="table-card">
        <div className="card-title">{cardTitle}</div>
        <Skeleton active paragraph={{ rows: 2 }} />
      </div>
    );
  }

  const total = Number(summary.total_materials ?? 0);
  if (total <= 0) {
    return (
      <div className="table-card">
        <div className="card-title">{cardTitle}</div>
        <Empty description="当前筛选范围内无素材数据" />
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="card-title">{cardTitle}</div>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title={totalLabel}
            value={summary.total_materials}
            change={comparison?.total_materials_change}
            compareLabel={cmpLabel}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title="出单素材数"
            value={summary.ordered_materials}
            change={comparison?.ordered_materials_change}
            compareLabel={cmpLabel}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title="总出单量"
            value={summary.total_orders}
            change={comparison?.total_orders_change}
            compareLabel={cmpLabel}
          />
        </Col>

        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title="素材出单率"
            value={pct(summary.order_rate)}
            change={comparison?.order_rate_change}
            compareLabel={cmpLabel}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title={`2单及以上素材率（${summary.two_plus_materials}条）`}
            value={pct(summary.two_plus_rate)}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={8}>
          <StatItem
            title={`5单及以上素材率（${summary.five_plus_materials}条）`}
            value={pct(summary.five_plus_rate)}
          />
        </Col>
      </Row>
    </div>
  );
}
