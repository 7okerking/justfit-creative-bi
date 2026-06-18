/**
 * 应用根布局：侧边导航 + 全局筛选 + 双页面路由
 */
import { Alert, Button, Layout, Menu, Radio, Spin, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ALL_VALUE } from "./api/client";
import AttributeFilters from "./components/AttributeFilters";
import MetaCalendar from "./components/MetaCalendar";
import { useMeta } from "./hooks/useDashboardData";
import GoldenCrossPage from "./pages/GoldenCrossPage";
import DesignerPage from "./pages/DesignerPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import VaultPage from "./pages/VaultPage";
import WeeklyReportPage from "./pages/WeeklyReportPage";
import type { DataScope, GlobalFilters } from "./types";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "/", label: "素材黄金交叉复盘" },
  { key: "/leaderboard", label: "智能排行榜" },
  { key: "/designer", label: "设计师绩效看板" },
  { key: "/vault", label: "核心资产晋级库" },
  { key: "/weekly", label: "周报" },
];

function menuSelectedKey(pathname: string): string {
  if (pathname.startsWith("/leaderboard")) return "/leaderboard";
  if (pathname.startsWith("/designer")) return "/designer";
  if (pathname.startsWith("/vault")) return "/vault";
  if (pathname.startsWith("/weekly")) return "/weekly";
  return "/";
}

function defaultFilters(maxDate?: string | null): GlobalFilters {
  const end = maxDate ?? dayjs().format("YYYY-MM-DD");
  const start = dayjs(end).subtract(6, "day").format("YYYY-MM-DD");
  return {
    start,
    end,
    dataScope: "account",
    fxs: [ALL_VALUE],
    zts: [ALL_VALUE],
    styles: [ALL_VALUE],
    pains: [ALL_VALUE],
    exercises: [ALL_VALUE],
  };
}

const EMPTY_FILTER_OPTIONS = {
  fx: [],
  zt: [],
  styles: [],
  pains: [],
  exercises: [],
  designers: [],
};

export default function App() {
  const { meta, loading, error, refresh } = useMeta();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const navigate = useNavigate();
  const location = useLocation();

  // 对齐到数据实际范围：end=最晚流水日，start=最早首次上线日（趋势图横轴才有线）
  useEffect(() => {
    if (meta?.date_range?.max) {
      const end = meta.date_range.max;
      const start =
        meta.date_range.first_seen_min ??
        dayjs(end).subtract(6, "day").format("YYYY-MM-DD");
      setFilters((prev) => ({
        ...prev,
        start,
        end,
      }));
    }
  }, [meta?.date_range?.max, meta?.date_range?.first_seen_min]);

  const handleDateChange = useCallback((start: string, end: string) => {
    setFilters((prev) => ({ ...prev, start, end }));
  }, []);

  const handleRefresh = async () => {
    try {
      const res = await refresh();
      message.success(`已刷新，共 ${res?.rows ?? meta?.row_count ?? 0} 条明细`);
    } catch {
      message.error("刷新失败，请确认后端已启动");
    }
  };

  if (loading && !meta) {
    return <Spin size="large" style={{ margin: "40vh auto", display: "block" }} />;
  }

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <span className="app-logo">JustFit_web_买量素材复盘BI</span>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          重新扫描 data_inputs
        </Button>
      </Header>
      <Layout>
        <Sider width={200} className="app-sider">
          <Menu
            mode="inline"
            selectedKeys={[menuSelectedKey(location.pathname)]}
            items={MENU_ITEMS}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, marginTop: 8 }}
          />
        </Sider>
        <Content className="app-content">
          {error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="后端未连接"
              description="请在另一终端启动：cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
            />
          )}
          {!error && meta && meta.row_count === 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="data 文件夹暂无有效数据"
              description="请将带 8 位日期的 Meta 导出 CSV/XLSX 放入 demo-01/data_inputs/ 后点击「重新扫描」"
            />
          )}
          {location.pathname !== "/weekly" && (
            <>
              <div className="time-scope-row">
                <MetaCalendar
                  minDate={meta?.date_range?.min}
                  maxDate={meta?.date_range?.max}
                  start={filters.start}
                  end={filters.end}
                  onChange={handleDateChange}
                />
                <Radio.Group
                  value={filters.dataScope}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dataScope: e.target.value as DataScope }))
                  }
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="account">账户内成效</Radio.Button>
                  <Radio.Button value="new">上新素材成效</Radio.Button>
                </Radio.Group>
              </div>
              {meta && (
                <AttributeFilters
                  options={{
                    ...EMPTY_FILTER_OPTIONS,
                    ...meta.filters,
                    fx: meta.filters.fx ?? [],
                    zt: meta.filters.zt ?? [],
                  }}
                  fxs={filters.fxs}
                  zts={filters.zts}
                  styles={filters.styles}
                  pains={filters.pains}
                  exercises={filters.exercises}
                  onFxsChange={(fxs) => setFilters((p) => ({ ...p, fxs }))}
                  onZtsChange={(zts) => setFilters((p) => ({ ...p, zts }))}
                  onStylesChange={(styles) => setFilters((p) => ({ ...p, styles }))}
                  onPainsChange={(pains) => setFilters((p) => ({ ...p, pains }))}
                  onExercisesChange={(exercises) => setFilters((p) => ({ ...p, exercises }))}
                />
              )}
            </>
          )}
          <Routes>
            <Route path="/" element={<GoldenCrossPage filters={filters} />} />
            <Route
              path="/leaderboard"
              element={<LeaderboardPage filters={filters} />}
            />
            <Route
              path="/designer"
              element={
                <DesignerPage
                  filters={filters}
                  filterOptions={
                    meta?.filters
                      ? { ...EMPTY_FILTER_OPTIONS, ...meta.filters }
                      : EMPTY_FILTER_OPTIONS
                  }
                />
              }
            />
            <Route
              path="/vault"
              element={<VaultPage filters={filters} />}
            />
            <Route
              path="/weekly"
              element={<WeeklyReportPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
