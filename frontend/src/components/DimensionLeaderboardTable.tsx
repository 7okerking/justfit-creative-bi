/**
 * 模块 B：维度效能自由魔方榜 — 支持 1~5 个维度自由交叉
 */
import { InputNumber, Select, Space, Table, Typography } from "antd";
import type { DimensionKey, DimensionLeaderboardRow } from "../types";

const DIM_OPTIONS: { label: string; value: DimensionKey }[] = [
  { label: "主题", value: "zt" },
  { label: "方向", value: "fx" },
  { label: "风格化", value: "style" },
  { label: "痛点", value: "pain" },
  { label: "锻炼类型", value: "exercise" },
];

interface Props {
  data: DimensionLeaderboardRow[];
  loading?: boolean;
  dims: DimensionKey[];
  minMaterials: number;
  onDimsChange: (v: DimensionKey[]) => void;
  onMinMaterialsChange: (v: number) => void;
}

export default function DimensionLeaderboardTable({
  data,
  loading,
  dims,
  minMaterials,
  onDimsChange,
  onMinMaterialsChange,
}: Props) {
  const handleDimsChange = (values: DimensionKey[]) => {
    if (values.length === 0) return;
    onDimsChange(values.slice(0, 5));
  };

  const columns = [
    { title: "排名", dataIndex: "rank", key: "rank", width: 64 },
    {
      title: "维度组合",
      dataIndex: "dimension_label",
      key: "label",
      ellipsis: true,
    },
    {
      title: "生产素材总数",
      dataIndex: "total_materials",
      key: "total",
      sorter: (a: DimensionLeaderboardRow, b: DimensionLeaderboardRow) =>
        a.total_materials - b.total_materials,
    },
    {
      title: "出单素材数",
      dataIndex: "ordered_materials",
      key: "ordered",
      sorter: (a: DimensionLeaderboardRow, b: DimensionLeaderboardRow) =>
        a.ordered_materials - b.ordered_materials,
    },
    {
      title: "素材出单率",
      dataIndex: "order_rate",
      key: "rate",
      render: (v: number) => `${v.toFixed(2)}%`,
      sorter: (a: DimensionLeaderboardRow, b: DimensionLeaderboardRow) =>
        a.order_rate - b.order_rate,
    },
    {
      title: "期间总出单量",
      dataIndex: "total_purchases",
      key: "purchases",
      defaultSortOrder: "descend" as const,
      sorter: (a: DimensionLeaderboardRow, b: DimensionLeaderboardRow) =>
        a.total_purchases - b.total_purchases,
    },
    {
      title: "综合 ROAS",
      dataIndex: "weighted_roas",
      key: "roas",
      render: (v: number) => v.toFixed(2),
      sorter: (a: DimensionLeaderboardRow, b: DimensionLeaderboardRow) =>
        a.weighted_roas - b.weighted_roas,
    },
  ];

  return (
    <div className="table-card">
      <div className="card-title">模块 B · 维度效能自由魔方榜</div>
      <Space wrap className="dimension-controls" size="middle">
        <Space>
          <span>交叉维度（1~5个）</span>
          <Select
            mode="multiple"
            style={{ minWidth: 280 }}
            value={dims}
            options={DIM_OPTIONS}
            onChange={handleDimsChange}
            maxCount={5}
            placeholder="请选择维度"
          />
        </Space>
        <Space>
          <span>最低素材数限制</span>
          <InputNumber
            min={1}
            max={100}
            value={minMaterials}
            onChange={(v) => onMinMaterialsChange(v ?? 3)}
          />
        </Space>
      </Space>
      <Typography.Paragraph type="secondary" className="dimension-hint">
        仅展示生产素材总数 &ge; {minMaterials} 的维度组合，避免低样本偶然出单干扰判断。
      </Typography.Paragraph>
      <Table
        rowKey={(r) => r.dimension_label}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: 900 }}
      />
    </div>
  );
}
