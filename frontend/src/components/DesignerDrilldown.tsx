/**
 * 设计师能力圈下钻：FX × 可选第二维度。
 */
import { Select, Table, Typography } from "antd";
import { ALL_VALUE } from "../api/client";
import type { DrilldownRow } from "../types";

const DIM_OPTIONS = [
  { value: "exercise", label: "锻炼类型" },
  { value: "style", label: "风格化" },
  { value: "zt", label: "主题" },
  { value: "pain", label: "痛点" },
];

interface Props {
  designers: string[];
  selected: string;
  onSelect: (designer: string) => void;
  data: DrilldownRow[];
  loading?: boolean;
  drilldownDim: string;
  onDimChange: (dim: string) => void;
}

export default function DesignerDrilldown({
  designers,
  selected,
  onSelect,
  data,
  loading,
  drilldownDim,
  onDimChange,
}: Props) {
  const dimLabel = DIM_OPTIONS.find((o) => o.value === drilldownDim)?.label ?? drilldownDim;

  const columns = [
    { title: "方向 (FX)", dataIndex: "fx", key: "fx" },
    { title: dimLabel, dataIndex: "secondary_value", key: "secondary" },
    { title: "联合分组", dataIndex: "combo", key: "combo" },
    { title: "素材总数", dataIndex: "total_materials", key: "total" },
    { title: "出单素材数", dataIndex: "ordered_materials", key: "ordered" },
    {
      title: "出单率",
      dataIndex: "order_rate",
      key: "rate",
      render: (v: number) => `${v}%`,
    },
    {
      title: "ROAS",
      dataIndex: "weighted_roas",
      key: "roas",
      render: (v: number) => v.toFixed(2),
    },
  ];

  return (
    <div className="table-card">
      <div className="card-title">视图 B · 设计师能力圈下钻</div>
      <Typography.Paragraph type="secondary">
        选择设计师后，按「方向 + 第二维度」展示该设计师的能力分布。
      </Typography.Paragraph>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Select
          style={{ width: 240 }}
          placeholder="选择要深挖的设计师"
          value={selected === ALL_VALUE ? undefined : selected}
          options={designers.map((d) => ({ label: d, value: d }))}
          onChange={(v) => onSelect(v ?? ALL_VALUE)}
          showSearch
          allowClear
        />
        <Select
          style={{ width: 150 }}
          value={drilldownDim}
          options={DIM_OPTIONS}
          onChange={onDimChange}
        />
      </div>
      {selected && selected !== ALL_VALUE && (
        <Table
          rowKey="combo"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          size="small"
        />
      )}
    </div>
  );
}
