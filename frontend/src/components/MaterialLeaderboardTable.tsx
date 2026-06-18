/**
 * 模块 A：爆款素材战神榜
 */
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Select, Table, Tag } from "antd";
import { useMemo, useState } from "react";
import type { MaterialLeaderboardRow } from "../types";
import { exportCsv } from "../utils/exportCsv";

interface Props {
  data: MaterialLeaderboardRow[];
  loading?: boolean;
}

export default function MaterialLeaderboardTable({ data, loading }: Props) {
  const [keywords, setKeywords] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!keywords.length) return data;
    return data.filter((row) =>
      keywords.every((kw) =>
        row.standard_id.toLowerCase().includes(kw.toLowerCase())
      )
    );
  }, [data, keywords]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const totalPurchases = filtered.reduce((s, r) => s + r.total_purchases, 0);
    const orderedMaterials = filtered.filter((r) => r.total_purchases > 0).length;
    const orderedRows = filtered.filter((r) => r.total_purchases > 0);
    const avgRoas = orderedRows.length
      ? orderedRows.reduce((s, r) => s + r.weighted_roas, 0) / orderedRows.length
      : 0;
    const avgCtr = total ? filtered.reduce((s, r) => s + r.avg_ctr, 0) / total : 0;
    const avgSpend = total
      ? filtered.reduce((s, r) => s + (r.total_spend ?? 0), 0) / total
      : 0;
    return { total, totalPurchases, orderedMaterials, avgRoas, avgCtr, avgSpend };
  }, [filtered]);
  const DESIGNER_COLORS = [
    "magenta",
    "red",
    "volcano",
    "orange",
    "gold",
    "lime",
    "green",
    "cyan",
    "blue",
    "geekblue",
    "purple",
  ] as const;

  const colorForDesigner = (name: string): (typeof DESIGNER_COLORS)[number] => {
    const text = name || "未知";
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return DESIGNER_COLORS[hash % DESIGNER_COLORS.length];
  };

  const columns = [
    {
      title: "排名",
      dataIndex: "rank",
      key: "rank",
      width: 64,
      sorter: (a: MaterialLeaderboardRow, b: MaterialLeaderboardRow) => a.rank - b.rank,
    },
    {
      title: "素材全称（标准素材ID）",
      dataIndex: "standard_id",
      key: "standard_id",
      width: 320,
      render: (v: string) => (
        <span style={{ wordBreak: "break-all", fontSize: 12 }}>{v}</span>
      ),
    },
    {
      title: "首次上线日",
      dataIndex: "first_seen_date",
      key: "first_seen",
      width: 100,
    },
    {
      title: "设计师",
      dataIndex: "designer",
      key: "designer",
      width: 110,
      render: (v: string) => (
        <Tag color={colorForDesigner(v)} style={{ minWidth: 64, textAlign: "center" }}>
          {v || "未知"}
        </Tag>
      ),
    },
    { title: "编导", dataIndex: "director", key: "director", width: 72 },
    {
      title: "期间总出单量",
      dataIndex: "total_purchases",
      key: "purchases",
      defaultSortOrder: "descend" as const,
      sorter: (a: MaterialLeaderboardRow, b: MaterialLeaderboardRow) =>
        a.total_purchases - b.total_purchases,
    },
    {
      title: "综合 ROAS",
      dataIndex: "weighted_roas",
      key: "roas",
      render: (v: number) => v.toFixed(2),
      sorter: (a: MaterialLeaderboardRow, b: MaterialLeaderboardRow) =>
        a.weighted_roas - b.weighted_roas,
    },
    {
      title: "综合 CTR",
      dataIndex: "avg_ctr",
      key: "ctr",
      render: (v: number) => `${Number(v).toFixed(2)}%`,
      sorter: (a: MaterialLeaderboardRow, b: MaterialLeaderboardRow) =>
        a.avg_ctr - b.avg_ctr,
    },
    {
      title: "累计消耗",
      dataIndex: "total_spend",
      key: "spend",
      render: (v: number) => `$${Number(v ?? 0).toLocaleString()}`,
      sorter: (a: MaterialLeaderboardRow, b: MaterialLeaderboardRow) =>
        (a.total_spend ?? 0) - (b.total_spend ?? 0),
    },
  ];

  const handleExport = () => {
    exportCsv(
      [
        { header: "排名", key: "rank" },
        { header: "标准素材ID", key: "standard_id" },
        { header: "首次上线日", key: "first_seen_date" },
        { header: "设计师", key: "designer" },
        { header: "编导", key: "director" },
        { header: "期间总出单量", key: "total_purchases" },
        { header: "综合ROAS", key: "weighted_roas", formatter: (v) => Number(v ?? 0).toFixed(2) },
        { header: "综合CTR", key: "avg_ctr", formatter: (v) => `${Number(v ?? 0).toFixed(2)}%` },
        { header: "累计消耗", key: "total_spend", formatter: (v) => `$${Number(v ?? 0).toLocaleString()}` },
      ],
      filtered,
      `爆款素材战神榜_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="table-card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>模块 A · 爆款素材战神榜</span>
        <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} disabled={!filtered.length}>
          导出 CSV
        </Button>
      </div>
      <Select
        mode="tags"
        placeholder="输入关键词搜索素材（如 0605、pingme），按回车添加"
        value={keywords}
        onChange={setKeywords}
        style={{ width: "100%", marginBottom: 12 }}
        tokenSeparators={[" ", ","]}
        suffixIcon={<SearchOutlined />}
        allowClear
      />
      <div className="leaderboard-summary-row">
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">素材总数</span>
          <span className="leaderboard-summary-value">{summary.total}</span>
        </div>
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">总出单量</span>
          <span className="leaderboard-summary-value" style={{ color: "#d4380d" }}>{summary.totalPurchases}</span>
        </div>
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">出单素材数</span>
          <span className="leaderboard-summary-value" style={{ color: "#08979c" }}>{summary.orderedMaterials}</span>
        </div>
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">平均 ROAS</span>
          <span className="leaderboard-summary-value">{summary.avgRoas.toFixed(2)}</span>
        </div>
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">平均 CTR</span>
          <span className="leaderboard-summary-value">{summary.avgCtr.toFixed(2)}%</span>
        </div>
        <div className="leaderboard-summary-item">
          <span className="leaderboard-summary-label">平均消耗</span>
          <span className="leaderboard-summary-value">${summary.avgSpend.toFixed(0)}</span>
        </div>
      </div>
      <Table
        rowKey="standard_id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: 1100 }}
      />
    </div>
  );
}
