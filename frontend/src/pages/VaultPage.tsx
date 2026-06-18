/**
 * 页面 4：核心资产晋级库 (Super Asset Vault)
 * 将测试期出单 >= 5 / >= 10 的超级素材集中展示。
 */
import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Spin, Table, Tabs, Tag } from "antd";
import { useMemo, useState } from "react";
import { fetchVault } from "../api/client";
import { useAsyncData } from "../hooks/useDashboardData";
import type { GlobalFilters, VaultRow } from "../types";
import { exportCsv } from "../utils/exportCsv";

interface Props {
  filters: GlobalFilters;
}

const FX_COLORS: Record<string, string> = {
  瘦身: "magenta",
  塑形: "volcano",
  健康: "green",
  增肌: "blue",
  柔韧: "purple",
  有氧: "orange",
  力量: "red",
  瑜伽: "cyan",
};

function getFxColor(fx: string): string {
  for (const [key, color] of Object.entries(FX_COLORS)) {
    if (fx.includes(key)) return color;
  }
  return "geekblue";
}

const SPEND_STATUS_MAP: Record<string, { color: string; label: string }> = {
  "增长期": { color: "green", label: "增长期" },
  "起量中": { color: "blue", label: "起量中" },
  "衰退期": { color: "orange", label: "衰退期" },
  "炮灰": { color: "default", label: "炮灰" },
};

const columns = [
  {
    title: "排名",
    dataIndex: "rank",
    key: "rank",
    width: 70,
    render: (v: number) => <span style={{ fontWeight: 700 }}>{v}</span>,
  },
  {
    title: "标准素材ID",
    dataIndex: "standard_id",
    key: "standard_id",
    ellipsis: true,
  },
  {
    title: "素材方向 (FX)",
    dataIndex: "fx",
    key: "fx",
    width: 140,
    render: (v: string) => (
      <Tag color={getFxColor(v)} style={{ fontSize: 13, fontWeight: 600, padding: "2px 10px" }}>
        {v}
      </Tag>
    ),
  },
  {
    title: "期间总出单量",
    dataIndex: "total_purchases",
    key: "total_purchases",
    width: 130,
    sorter: (a: VaultRow, b: VaultRow) => a.total_purchases - b.total_purchases,
    defaultSortOrder: "descend" as const,
    render: (v: number) => <span style={{ fontWeight: 700, color: "#d4380d" }}>{v}</span>,
  },
  {
    title: "综合 CTR",
    dataIndex: "avg_ctr",
    key: "avg_ctr",
    width: 110,
    render: (v: number) => `${(v * 100).toFixed(2)}%`,
    sorter: (a: VaultRow, b: VaultRow) => a.avg_ctr - b.avg_ctr,
  },
  {
    title: "综合 ROAS",
    dataIndex: "weighted_roas",
    key: "weighted_roas",
    width: 110,
    render: (v: number) => v.toFixed(2),
    sorter: (a: VaultRow, b: VaultRow) => a.weighted_roas - b.weighted_roas,
  },
  {
    title: "跑量情况",
    dataIndex: "spend_status",
    key: "spend_status",
    width: 110,
    filters: [
      { text: "增长期", value: "增长期" },
      { text: "起量中", value: "起量中" },
      { text: "衰退期", value: "衰退期" },
      { text: "炮灰", value: "炮灰" },
    ],
    onFilter: (value: any, record: VaultRow) => record.spend_status === value,
    render: (v: string) => {
      const cfg = SPEND_STATUS_MAP[v] ?? { color: "default", label: v };
      return (
        <Tag color={cfg.color} style={{ fontWeight: 600 }}>
          {cfg.label}
        </Tag>
      );
    },
  },
  {
    title: "总花费",
    dataIndex: "total_spend",
    key: "total_spend",
    width: 120,
    sorter: (a: VaultRow, b: VaultRow) => a.total_spend - b.total_spend,
    render: (v: number) => `$${Number(v ?? 0).toLocaleString()}`,
  },
];

export default function VaultPage({ filters }: Props) {
  const [tier, setTier] = useState<"1" | "2" | "5" | "10">("5");
  const minPurchases = tier === "10" ? 10 : tier === "5" ? 5 : tier === "2" ? 2 : 1;

  const fetcher = useMemo(
    () => () => fetchVault(filters, minPurchases),
    [
      filters.start,
      filters.end,
      filters.dataScope,
      filters.fxs.join(),
      filters.zts.join(),
      filters.styles.join(),
      filters.pains.join(),
      filters.exercises.join(),
      minPurchases,
    ]
  );

  const { data, loading, error } = useAsyncData(fetcher, [fetcher]);

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  if (loading && !data) {
    return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  }

  const rows = data?.vault_leaderboard ?? [];

  return (
    <div className="table-card">
      <div className="card-title">核心资产晋级库</div>
      <Tabs
        activeKey={tier}
        onChange={(key) => setTier(key as "1" | "2" | "5" | "10")}
        items={[
          { key: "1", label: "出单素材箱（≥ 1单）" },
          { key: "2", label: "潜力新星箱（≥ 2单）" },
          { key: "5", label: "潜力爆款箱（≥ 5单）" },
          { key: "10", label: "超级战神箱（≥ 10单）" },
        ]}
      />
      {rows.length > 0 && (
        <div style={{ marginBottom: 12, textAlign: "right" }}>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() =>
              exportCsv(
                [
                  { header: "排名", key: "rank" },
                  { header: "标准素材ID", key: "standard_id" },
                  { header: "素材方向(FX)", key: "fx" },
                  { header: "期间总出单量", key: "total_purchases" },
                  { header: "综合CTR", key: "avg_ctr", formatter: (v) => `${(Number(v ?? 0) * 100).toFixed(2)}%` },
                  { header: "综合ROAS", key: "weighted_roas", formatter: (v) => Number(v ?? 0).toFixed(2) },
                  { header: "跑量情况", key: "spend_status" },
                  { header: "总花费", key: "total_spend", formatter: (v) => `$${Number(v ?? 0).toLocaleString()}` },
                ],
                rows,
                `核心资产晋级库_≥${minPurchases}单_${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
          >
            导出 CSV
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty
          description="模范尚未诞生，继续加油测试新素材吧！"
          style={{ margin: "48px 0" }}
        />
      ) : (
        <Table
          rowKey="standard_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
          scroll={{ x: 800 }}
        />
      )}
    </div>
  );
}
