/**
 * 周报页面：按素材名前8位日期归属自然周，展示周维度统计。
 */
import { Alert, DatePicker, Empty, Select, Spin, Table, message } from "antd";
import { CaretUpOutlined, CaretDownOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_VALUE,
  fetchWeeklyReport,
  type WeeklyMaterialRow,
  type WeeklyReportData,
} from "../api/client";
import WeeklyTeamPieCharts, { type TeamStats } from "../components/WeeklyTeamPieCharts";
import WeeklyInsight from "../components/WeeklyInsight";
import type { GlobalFilters } from "../types";

dayjs.extend(isoWeek);

function getWeekMonday(d: Dayjs): string {
  return d.isoWeekday(1).format("YYYY-MM-DD");
}

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  message.success("已复制素材名");
}

function CopyableId({ value }: { value: string }) {
  const handleClick = useCallback(() => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(() => {
        message.success("已复制素材名");
      }).catch(() => fallbackCopy(value));
    } else {
      fallbackCopy(value);
    }
  }, [value]);

  return (
    <span
      onClick={handleClick}
      style={{ cursor: "pointer", wordBreak: "break-all", fontSize: 12, color: "#1677ff" }}
      title="点击复制"
    >
      {value}
    </span>
  );
}

function ChangeIndicator({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === 0) return null;
  const change = ((current - prev) / prev) * 100;
  if (Math.abs(change) < 0.1) return null;
  const isUp = change > 0;
  return (
    <span style={{ fontSize: 11, marginLeft: 4, color: isUp ? "#52c41a" : "#ff4d4f" }}>
      {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

const materialColumns = [
  { title: "排名", dataIndex: "rank", key: "rank", width: 60 },
  {
    title: "素材名称（点击复制）",
    dataIndex: "standard_id",
    key: "standard_id",
    render: (v: string) => <CopyableId value={v} />,
  },
  { title: "设计师", dataIndex: "designer", key: "designer", width: 100 },
  { title: "编导", dataIndex: "director", key: "director", width: 80 },
  {
    title: "总出单量",
    dataIndex: "total_purchases",
    key: "purchases",
    width: 100,
    defaultSortOrder: "descend" as const,
    sorter: (a: WeeklyMaterialRow, b: WeeklyMaterialRow) =>
      a.total_purchases - b.total_purchases,
    render: (v: number) => (
      <span style={{ fontWeight: 700, color: v > 0 ? "#d4380d" : undefined }}>{v}</span>
    ),
  },
  {
    title: "ROAS",
    dataIndex: "weighted_roas",
    key: "roas",
    width: 90,
    render: (v: number) => v.toFixed(2),
    sorter: (a: WeeklyMaterialRow, b: WeeklyMaterialRow) =>
      a.weighted_roas - b.weighted_roas,
  },
  {
    title: "CTR",
    dataIndex: "avg_ctr",
    key: "ctr",
    width: 90,
    render: (v: number) => `${(v * 100).toFixed(2)}%`,
    sorter: (a: WeeklyMaterialRow, b: WeeklyMaterialRow) => a.avg_ctr - b.avg_ctr,
  },
  {
    title: "总消耗",
    dataIndex: "total_spend",
    key: "spend",
    width: 110,
    render: (v: number) => `$${Number(v ?? 0).toLocaleString()}`,
    sorter: (a: WeeklyMaterialRow, b: WeeklyMaterialRow) =>
      a.total_spend - b.total_spend,
  },
];

export default function WeeklyReportPage() {
  const [weekDate, setWeekDate] = useState<Dayjs>(dayjs().subtract(1, "week"));
  const [designer, setDesigner] = useState<string>(ALL_VALUE);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pieSelectedDesigner, setPieSelectedDesigner] = useState<string | null>(null);
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [prevData, setPrevData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = useMemo(() => getWeekMonday(weekDate), [weekDate]);
  const weekEnd = useMemo(
    () => dayjs(weekStart).add(6, "day").format("YYYY-MM-DD"),
    [weekStart]
  );
  const prevWeekStart = useMemo(
    () => dayjs(weekStart).subtract(7, "day").format("YYYY-MM-DD"),
    [weekStart]
  );

  // 切换周时重置日筛选和饼图选中
  useEffect(() => {
    setSelectedDay(null);
    setPieSelectedDesigner(null);
  }, [weekStart]);

  // 请求当前周数据
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeeklyReport(
      weekStart,
      designer !== ALL_VALUE ? designer : undefined
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "请求失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [weekStart, designer]);

  // 请求上一周数据（用于对比）
  useEffect(() => {
    let cancelled = false;
    fetchWeeklyReport(
      prevWeekStart,
      designer !== ALL_VALUE ? designer : undefined
    )
      .then((res) => {
        if (!cancelled) setPrevData(res);
      })
      .catch(() => {
        if (!cancelled) setPrevData(null);
      });
    return () => { cancelled = true; };
  }, [prevWeekStart, designer]);

  if (error) return <Alert type="error" message={error} showIcon />;

  const summary = data?.summary;
  const prevSummary = prevData?.summary;
  const orderedMaterials = data?.ordered_materials ?? [];
  const allMaterials = data?.all_materials ?? [];
  const designers = data?.designers ?? [];

  // 饼图设计师联动筛选
  const filteredOrderedMaterials = useMemo(() => {
    if (!pieSelectedDesigner) return orderedMaterials;
    return orderedMaterials.filter(
      (row) => (row.designer || "").toUpperCase() === pieSelectedDesigner.toUpperCase()
    );
  }, [orderedMaterials, pieSelectedDesigner]);

  // 按天筛选：生成本周7天选项
  const dayOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = dayjs(weekStart).add(i, "day");
      opts.push({
        value: d.format("YYYYMMDD"),
        label: d.format("MM/DD (ddd)"),
      });
    }
    return opts;
  }, [weekStart]);

  const filteredAllMaterials = useMemo(() => {
    let result = allMaterials;
    if (selectedDay) {
      result = result.filter((row) => row.standard_id.slice(0, 8) === selectedDay);
    }
    if (pieSelectedDesigner) {
      result = result.filter(
        (row) => (row.designer || "").toUpperCase() === pieSelectedDesigner.toUpperCase()
      );
    }
    return result;
  }, [allMaterials, selectedDay, pieSelectedDesigner]);

  // 团队分组统计
  const INTERNAL_DESIGNERS = ["DHR", "WZC", "GMX", "HYX"];

  const classifyDesigner = (d: string): string => {
    const upper = d.toUpperCase();
    if (upper.includes("095KB")) return "095KB";
    if (upper.includes("PINGME")) return "Pingme";
    if (INTERNAL_DESIGNERS.includes(upper)) return "内部设计师";
    return "其他";
  };

  const { teamStats, internalDesignerStats } = useMemo(() => {
    const teamMap: Record<string, { total: number; ordered: number }> = {};
    const internalMap: Record<string, { total: number; ordered: number }> = {};

    for (const row of allMaterials) {
      const team = classifyDesigner(row.designer || "");
      if (!teamMap[team]) teamMap[team] = { total: 0, ordered: 0 };
      teamMap[team].total++;
      if (row.total_purchases > 0) teamMap[team].ordered++;

      if (team === "内部设计师") {
        const name = (row.designer || "").toUpperCase();
        if (!internalMap[name]) internalMap[name] = { total: 0, ordered: 0 };
        internalMap[name].total++;
        if (row.total_purchases > 0) internalMap[name].ordered++;
      }
    }

    const toStats = (map: Record<string, { total: number; ordered: number }>): TeamStats[] =>
      Object.entries(map).map(([name, v]) => ({
        name,
        total: v.total,
        ordered: v.ordered,
        orderRate: v.total > 0 ? v.ordered / v.total : 0,
      }));

    return { teamStats: toStats(teamMap), internalDesignerStats: toStats(internalMap) };
  }, [allMaterials]);

  // Gemini 洞察用 filters
  const weeklyFilters: GlobalFilters = useMemo(() => ({
    start: weekStart,
    end: weekEnd,
    dataScope: "account",
    fxs: [],
    zts: [],
    styles: [],
    pains: [],
    exercises: [],
  }), [weekStart, weekEnd]);

  return (
    <>
      {/* 周选择器 */}
      <div className="table-card">
        <div className="card-title">周报 · 按素材产出周统计</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <DatePicker
            picker="week"
            value={weekDate}
            onChange={(d) => d && setWeekDate(d)}
            allowClear={false}
          />
          <span style={{ fontSize: 13, color: "#595959" }}>
            {weekStart} ~ {weekEnd}
          </span>
          <Select
            style={{ width: 180 }}
            value={designer}
            onChange={setDesigner}
            placeholder="筛选设计师"
            allowClear
            onClear={() => setDesigner(ALL_VALUE)}
            options={[
              { value: ALL_VALUE, label: "全部设计师" },
              ...designers.map((d) => ({ value: d, label: d })),
            ]}
            showSearch
          />
        </div>
      </div>

      {loading && !data && (
        <Spin size="large" style={{ display: "block", margin: "60px auto" }} />
      )}

      {/* 总览统计（含上周对比） */}
      {summary && (
        <div className="table-card">
          <div className="card-title">
            本周总览{designer !== ALL_VALUE ? ` · ${designer}` : ""}
            <span style={{ fontSize: 11, color: "#8c8c8c", fontWeight: 400, marginLeft: 12 }}>
              对比上周 ({prevWeekStart} ~ {dayjs(prevWeekStart).add(6, "day").format("YYYY-MM-DD")})
            </span>
          </div>
          <div className="leaderboard-summary-row">
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">素材总数</span>
              <span className="leaderboard-summary-value">
                {summary.total_materials}
                <ChangeIndicator current={summary.total_materials} prev={prevSummary?.total_materials} />
              </span>
            </div>
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">出单素材数</span>
              <span className="leaderboard-summary-value" style={{ color: "#08979c" }}>
                {summary.ordered_materials}
                <ChangeIndicator current={summary.ordered_materials} prev={prevSummary?.ordered_materials} />
              </span>
            </div>
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">总出单量</span>
              <span className="leaderboard-summary-value" style={{ color: "#d4380d" }}>
                {summary.total_purchases}
                <ChangeIndicator current={summary.total_purchases} prev={prevSummary?.total_purchases} />
              </span>
            </div>
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">出单率</span>
              <span className="leaderboard-summary-value">
                {summary.order_rate}%
                <ChangeIndicator current={summary.order_rate} prev={prevSummary?.order_rate} />
              </span>
            </div>
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">平均 ROAS</span>
              <span className="leaderboard-summary-value">
                {summary.avg_roas.toFixed(2)}
                <ChangeIndicator current={summary.avg_roas} prev={prevSummary?.avg_roas} />
              </span>
            </div>
            <div className="leaderboard-summary-item">
              <span className="leaderboard-summary-label">平均 CTR</span>
              <span className="leaderboard-summary-value">
                {(summary.avg_ctr * 100).toFixed(2)}%
                <ChangeIndicator current={summary.avg_ctr} prev={prevSummary?.avg_ctr} />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 团队出单分析饼图 */}
      {allMaterials.length > 0 && (
        <WeeklyTeamPieCharts
          teamStats={teamStats}
          internalDesignerStats={internalDesignerStats}
          onDesignerSelect={setPieSelectedDesigner}
        />
      )}

      {/* Gemini 周维度核心洞察 */}
      <WeeklyInsight filters={weeklyFilters} weekStart={weekStart} />

      {/* 出单素材列表 */}
      <div className="table-card">
        <div className="card-title">
          出单素材明细
          {pieSelectedDesigner && (
            <span style={{ fontSize: 12, color: "#1677ff", fontWeight: 400, marginLeft: 8 }}>
              （已筛选：{pieSelectedDesigner}）
            </span>
          )}
        </div>
        {filteredOrderedMaterials.length === 0 && !loading ? (
          <Empty description="本周暂无出单素材" style={{ margin: "24px 0" }} />
        ) : (
          <Table
            rowKey="standard_id"
            columns={materialColumns}
            dataSource={filteredOrderedMaterials}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            size="small"
            scroll={{ x: 800 }}
          />
        )}
      </div>

      {/* 全部素材列表 */}
      <div className="table-card">
        <div className="card-title">
          本周全部素材
          {pieSelectedDesigner && (
            <span style={{ fontSize: 12, color: "#1677ff", fontWeight: 400, marginLeft: 8 }}>
              （已筛选：{pieSelectedDesigner}）
            </span>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Select
            style={{ width: 180 }}
            value={selectedDay ?? "all"}
            onChange={(v) => setSelectedDay(v === "all" ? null : v)}
            options={[
              { value: "all", label: "全部（整周）" },
              ...dayOptions,
            ]}
          />
          {selectedDay && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#595959" }}>
              已筛选：{dayjs(selectedDay).format("YYYY-MM-DD")} · 当日素材总数：
              <b style={{ color: "#1677ff" }}>{filteredAllMaterials.length}</b> 个
            </span>
          )}
        </div>
        {filteredAllMaterials.length === 0 && !loading ? (
          <Empty description="该日期无产出素材" style={{ margin: "24px 0" }} />
        ) : (
          <Table
            rowKey="standard_id"
            columns={materialColumns}
            dataSource={filteredAllMaterials}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            size="small"
            scroll={{ x: 800 }}
          />
        )}
      </div>
    </>
  );
}
