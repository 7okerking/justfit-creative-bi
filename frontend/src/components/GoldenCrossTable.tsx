/**
 * 黄金交叉透视表：方向(FX) × 主题(ZT)，出单率列带热力底色。
 */
import { Table } from "antd";
import type { GoldenCrossRow } from "../types";
import { orderRateHeatColor } from "../utils/heatmap";

interface Props {
  data: GoldenCrossRow[];
  loading?: boolean;
}

export default function GoldenCrossTable({ data, loading }: Props) {
  const columns = [
    { title: "方向 (FX)", dataIndex: "fx", key: "fx", width: 100 },
    { title: "主题 (ZT)", dataIndex: "zt", key: "zt", width: 100 },
    { title: "方向+主题", dataIndex: "fx_zt", key: "fx_zt", width: 140 },
    {
      title: "素材总数",
      dataIndex: "total_materials",
      key: "total",
      sorter: (a: GoldenCrossRow, b: GoldenCrossRow) =>
        a.total_materials - b.total_materials,
    },
    {
      title: "出单素材数",
      dataIndex: "ordered_materials",
      key: "ordered",
      sorter: (a: GoldenCrossRow, b: GoldenCrossRow) =>
        a.ordered_materials - b.ordered_materials,
    },
    {
      title: "素材出单率",
      dataIndex: "order_rate",
      key: "rate",
      render: (v: number) => (
        <span style={{ fontWeight: v > 0 ? 600 : 400 }}>{v}%</span>
      ),
      onCell: (record: GoldenCrossRow) => ({
        style: {
          backgroundColor: orderRateHeatColor(record.order_rate),
        },
      }),
      sorter: (a: GoldenCrossRow, b: GoldenCrossRow) => a.order_rate - b.order_rate,
      defaultSortOrder: "descend" as const,
    },
    {
      title: "累计总消耗",
      dataIndex: "total_spend",
      key: "spend",
      render: (v: number) => `$${v.toLocaleString()}`,
      sorter: (a: GoldenCrossRow, b: GoldenCrossRow) => a.total_spend - b.total_spend,
    },
    {
      title: "综合加权 ROAS",
      dataIndex: "weighted_roas",
      key: "roas",
      render: (v: number) => v.toFixed(2),
      sorter: (a: GoldenCrossRow, b: GoldenCrossRow) =>
        a.weighted_roas - b.weighted_roas,
    },
  ];

  return (
    <div className="table-card">
      <div className="card-title">黄金交叉明细表 · FX × ZT（出单率列已热力着色）</div>
      <Table
        rowKey="fx_zt"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        size="small"
        scroll={{ x: 900 }}
      />
    </div>
  );
}
