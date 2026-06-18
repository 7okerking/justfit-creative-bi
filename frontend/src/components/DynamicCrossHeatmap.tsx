/**
 * 多维自由交叉魔方热力图 + 下钻联动
 */
import { Empty, Select, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCrossDrilldown,
  fetchDynamicCrossMatrix,
  type CrossDrilldownRow,
  type DynamicCrossMatrix,
} from "../api/client";
import { useAsyncData } from "../hooks/useDashboardData";
import type { GlobalFilters } from "../types";
import { orderRateHeatColor } from "../utils/heatmap";

interface Props {
  filters: GlobalFilters;
}

const DIM_OPTIONS = [
  { value: "fx", label: "方向 (FX)" },
  { value: "zt", label: "主题 (ZT)" },
  { value: "pain", label: "痛点" },
  { value: "style", label: "风格化" },
];

export default function DynamicCrossHeatmap({ filters }: Props) {
  const [rowDim, setRowDim] = useState("fx");
  const [colDim, setColDim] = useState("zt");

  // 下钻选中状态
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<CrossDrilldownRow[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const fetcher = useMemo(
    () => () => fetchDynamicCrossMatrix(filters, rowDim, colDim),
    [filters.start, filters.end, filters.dataScope, filters.fxs.join(), filters.zts.join(), filters.styles.join(), filters.pains.join(), filters.exercises.join(), rowDim, colDim]
  );

  const { data, loading } = useAsyncData(fetcher, [fetcher]);

  // 当矩阵数据加载完成时，自动选中出单率最高的组合
  useEffect(() => {
    if (!data?.cells?.length) {
      setSelectedRow(null);
      setSelectedCol(null);
      return;
    }
    const validCells = data.cells.filter((c) => c.order_rate !== null && c.order_rate > 0);
    if (validCells.length === 0) {
      setSelectedRow(null);
      setSelectedCol(null);
      return;
    }
    const best = validCells.reduce((a, b) => ((a.order_rate ?? 0) > (b.order_rate ?? 0) ? a : b));
    setSelectedRow(best.row_value);
    setSelectedCol(best.col_value);
  }, [data]);

  // 下钻请求
  useEffect(() => {
    if (!selectedRow || !selectedCol) {
      setDrilldownData([]);
      return;
    }
    let cancelled = false;
    setDrilldownLoading(true);
    fetchCrossDrilldown(filters, rowDim, selectedRow, colDim, selectedCol)
      .then((res) => {
        if (!cancelled) setDrilldownData(res.materials);
      })
      .catch(() => {
        if (!cancelled) setDrilldownData([]);
      })
      .finally(() => {
        if (!cancelled) setDrilldownLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters, rowDim, colDim, selectedRow, selectedCol]);

  const handleCellClick = useCallback((rowValue: string, colValue: string) => {
    setSelectedRow(rowValue);
    setSelectedCol(colValue);
  }, []);

  const rowDimLabel = DIM_OPTIONS.find((o) => o.value === rowDim)?.label ?? rowDim;
  const colDimLabel = DIM_OPTIONS.find((o) => o.value === colDim)?.label ?? colDim;

  return (
    <>
      {/* 热力图卡片 */}
      <div className="table-card heatmap-card">
        <div className="card-title">多维自由交叉魔方 · 出单率热力图</div>
        <div className="cross-dim-selectors">
          <span className="cross-dim-label">纵轴:</span>
          <Select
            size="small"
            value={rowDim}
            onChange={(v) => setRowDim(v)}
            options={DIM_OPTIONS}
            style={{ width: 120 }}
          />
          <span className="cross-dim-label" style={{ marginLeft: 16 }}>横轴:</span>
          <Select
            size="small"
            value={colDim}
            onChange={(v) => setColDim(v)}
            options={DIM_OPTIONS}
            style={{ width: 120 }}
          />
        </div>

        {loading && <Spin style={{ display: "block", margin: "30px auto" }} />}

        {!loading && data && data.row_list.length > 0 && data.col_list.length > 0 && (
          <>
            <div className="heatmap-legend">
              <span className="heatmap-legend-item heatmap-legend-low">0%</span>
              <span className="heatmap-legend-bar" />
              <span className="heatmap-legend-item heatmap-legend-high">高出单率</span>
              <span style={{ marginLeft: 16, fontSize: 11, color: "#8c8c8c" }}>点击格子下钻查看素材</span>
            </div>
            <div className="heatmap-scroll">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th className="heatmap-corner">{rowDimLabel} \ {colDimLabel}</th>
                    {data.col_list.map((cv) => (
                      <th key={cv} className="heatmap-col-head">{cv}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.row_list.map((rv) => (
                    <tr key={rv}>
                      <th className="heatmap-row-head">{rv}</th>
                      {data.col_list.map((cv) => {
                        const cell = data.cells.find(
                          (c) => c.row_value === rv && c.col_value === cv
                        );
                        const rate = cell?.order_rate ?? null;
                        const isSelected = selectedRow === rv && selectedCol === cv;
                        return (
                          <td
                            key={`${rv}-${cv}`}
                            className={`heatmap-cell heatmap-cell--clickable${isSelected ? " heatmap-cell--selected" : ""}`}
                            style={{ backgroundColor: orderRateHeatColor(rate) }}
                            title={
                              cell
                                ? `出单率 ${rate}% · 素材 ${cell.total_materials} · 出单 ${cell.ordered_materials}`
                                : "无数据"
                            }
                            onClick={() => handleCellClick(rv, cv)}
                          >
                            {rate !== null ? (
                              <>
                                <span className="heatmap-rate">{rate}%</span>
                                <span className="heatmap-sub">
                                  {cell?.ordered_materials}/{cell?.total_materials}
                                </span>
                              </>
                            ) : (
                              <span className="heatmap-empty">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && (!data || data.row_list.length === 0) && (
          <Empty description="当前筛选条件下无交叉数据" style={{ margin: "24px 0" }} />
        )}
      </div>

      {/* 下钻联动组件 */}
      <DrilldownPanel
        rowDim={rowDim}
        colDim={colDim}
        rowDimLabel={rowDimLabel}
        colDimLabel={colDimLabel}
        rowList={data?.row_list ?? []}
        colList={data?.col_list ?? []}
        selectedRow={selectedRow}
        selectedCol={selectedCol}
        onRowChange={setSelectedRow}
        onColChange={setSelectedCol}
        data={drilldownData}
        loading={drilldownLoading}
      />
    </>
  );
}

/* ---------- 下钻联动面板 ---------- */

interface DrilldownPanelProps {
  rowDim: string;
  colDim: string;
  rowDimLabel: string;
  colDimLabel: string;
  rowList: string[];
  colList: string[];
  selectedRow: string | null;
  selectedCol: string | null;
  onRowChange: (v: string) => void;
  onColChange: (v: string) => void;
  data: CrossDrilldownRow[];
  loading: boolean;
}

const drilldownColumns = [
  { title: "标准素材ID", dataIndex: "standard_id", key: "id", ellipsis: true },
  { title: "首次上线日", dataIndex: "first_seen_date", key: "fs", width: 110 },
  {
    title: "总出单量",
    dataIndex: "total_purchases",
    key: "purchases",
    width: 100,
    sorter: (a: CrossDrilldownRow, b: CrossDrilldownRow) => a.total_purchases - b.total_purchases,
    defaultSortOrder: "descend" as const,
    render: (v: number) => <span style={{ fontWeight: 700, color: "#d4380d" }}>{v}</span>,
  },
  {
    title: "综合 CTR",
    dataIndex: "avg_ctr",
    key: "ctr",
    width: 100,
    render: (v: number) => `${(v * 100).toFixed(2)}%`,
  },
  {
    title: "综合 ROAS",
    dataIndex: "weighted_roas",
    key: "roas",
    width: 100,
    render: (v: number) => v.toFixed(2),
  },
];

function DrilldownPanel({
  rowDimLabel,
  colDimLabel,
  rowList,
  colList,
  selectedRow,
  selectedCol,
  onRowChange,
  onColChange,
  data,
  loading,
}: DrilldownPanelProps) {
  return (
    <div className="table-card">
      <div className="card-title">爆款基因素材探测箱（下钻联动）</div>
      <div className="cross-dim-selectors" style={{ marginBottom: 12 }}>
        <span className="cross-dim-label">{rowDimLabel}:</span>
        <Select
          size="small"
          value={selectedRow ?? undefined}
          onChange={onRowChange}
          options={rowList.map((v) => ({ value: v, label: v }))}
          style={{ width: 140 }}
          placeholder="选择纵轴值"
        />
        <span className="cross-dim-label" style={{ marginLeft: 16 }}>{colDimLabel}:</span>
        <Select
          size="small"
          value={selectedCol ?? undefined}
          onChange={onColChange}
          options={colList.map((v) => ({ value: v, label: v }))}
          style={{ width: 140 }}
          placeholder="选择横轴值"
        />
        {selectedRow && selectedCol && (
          <Tag color="blue" style={{ marginLeft: 12 }}>
            {selectedRow} × {selectedCol}
          </Tag>
        )}
      </div>

      {loading && <Spin style={{ display: "block", margin: "20px auto" }} />}

      {!loading && selectedRow && selectedCol && data.length === 0 && (
        <Empty description="该特定基因组合暂无出单素材" style={{ margin: "24px 0" }} />
      )}

      {!loading && data.length > 0 && (
        <Table
          rowKey="standard_id"
          columns={drilldownColumns}
          dataSource={data}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="small"
          scroll={{ x: 600 }}
        />
      )}
    </div>
  );
}
