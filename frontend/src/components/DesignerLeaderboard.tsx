/**
 * 设计师总榜表格。
 */
import { Table } from "antd";
import type { DesignerRow } from "../types";

interface Props {
  data: DesignerRow[];
  loading?: boolean;
  onSelectDesigner?: (designer: string) => void;
}

function safeNum(v: unknown, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

export default function DesignerLeaderboard({
  data,
  loading,
  onSelectDesigner,
}: Props) {
  const columns = [
    {
      title: "设计师",
      dataIndex: "designer",
      key: "designer",
      render: (v: string) => (
        <a onClick={() => onSelectDesigner?.(v)}>{v}</a>
      ),
    },
    {
      title: "负责素材总数",
      dataIndex: "total_materials",
      key: "total",
      sorter: (a: DesignerRow, b: DesignerRow) => a.total_materials - b.total_materials,
    },
    {
      title: "出单素材数",
      dataIndex: "ordered_materials",
      key: "ordered",
      sorter: (a: DesignerRow, b: DesignerRow) =>
        a.ordered_materials - b.ordered_materials,
    },
    {
      title: "完整出单率",
      dataIndex: "order_rate",
      key: "rate",
      render: (v: number) => (
        <span className={v >= 50 ? "rate-high" : "rate-low"}>{safeNum(v)}%</span>
      ),
      sorter: (a: DesignerRow, b: DesignerRow) => a.order_rate - b.order_rate,
    },
    {
      title: "大盘爆款贡献度 (%)",
      dataIndex: "burst_contribution_pct",
      key: "burst",
      render: (v: number | undefined) => (
        <span className={(v ?? 0) >= 20 ? "rate-high" : undefined}>
          {safeNum(v)}%
        </span>
      ),
      sorter: (a: DesignerRow, b: DesignerRow) =>
        (a.burst_contribution_pct ?? 0) - (b.burst_contribution_pct ?? 0),
      defaultSortOrder: "descend" as const,
    },
    {
      title: "累计总消耗",
      dataIndex: "total_spend",
      key: "spend",
      render: (v: number) => `$${Number(v ?? 0).toLocaleString()}`,
      sorter: (a: DesignerRow, b: DesignerRow) => a.total_spend - b.total_spend,
    },
    {
      title: "综合加权 ROAS",
      dataIndex: "weighted_roas",
      key: "roas",
      render: (v: number) => safeNum(v),
    },
  ];

  return (
    <div className="table-card">
      <div className="card-title">视图 A · 设计师总榜</div>
      <Table
        rowKey="designer"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="small"
        onRow={(record) => ({
          onClick: () => onSelectDesigner?.(record.designer),
          style: { cursor: "pointer" },
        })}
      />
    </div>
  );
}
