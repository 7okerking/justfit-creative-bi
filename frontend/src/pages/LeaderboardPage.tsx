/**
 * 页面：智能排行榜（素材战神榜 + 维度魔方榜）
 */
import { Alert, Button, Empty, Spin, Typography } from "antd";
import { useMemo, useState } from "react";
import { fetchLeaderboard, requestGeminiStrategy } from "../api/client";
import DimensionLeaderboardTable from "../components/DimensionLeaderboardTable";
import MaterialLeaderboardTable from "../components/MaterialLeaderboardTable";
import { useAsyncData } from "../hooks/useDashboardData";
import type {
  DimensionKey,
  GeminiStrategyResponse,
  GlobalFilters,
} from "../types";

interface Props {
  filters: GlobalFilters;
}

export default function LeaderboardPage({ filters }: Props) {
  const [dims, setDims] = useState<DimensionKey[]>(["zt"]);
  const [minMaterials, setMinMaterials] = useState(3);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<GeminiStrategyResponse | null>(null);

  const fetcher = useMemo(
    () => () =>
      fetchLeaderboard(filters, {
        dims,
        minMaterials,
      }),
    [
      filters.start,
      filters.end,
      filters.dataScope,
      filters.fxs.join(),
      filters.zts.join(),
      filters.styles.join(),
      filters.pains.join(),
      filters.exercises.join(),
      dims.join(),
      minMaterials,
    ]
  );

  const { data, loading, error } = useAsyncData(fetcher, [fetcher]);

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  if (loading && !data) {
    return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  }

  const materials = data?.material_leaderboard ?? [];
  const dimensions = data?.dimension_leaderboard ?? [];

  const handleAskGemini = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await requestGeminiStrategy(filters, {
        dims,
        minMaterials,
      });
      setAiResult(result);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Gemini 请求失败，请稍后再试");
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <MaterialLeaderboardTable data={materials} loading={loading} />
      {!loading && materials.length === 0 && (
        <Empty description="当前时间范围内无素材出单数据" style={{ marginBottom: 24 }} />
      )}
      <DimensionLeaderboardTable
        data={dimensions}
        loading={loading}
        dims={dims}
        minMaterials={minMaterials}
        onDimsChange={setDims}
        onMinMaterialsChange={setMinMaterials}
      />
      {!loading && dimensions.length === 0 && (
        <Empty description="无满足最低素材数条件的维度组合，可调低过滤阈值或扩大时间范围" />
      )}

      <div className="table-card ai-director-card">
        <div className="card-title">AI 创意总监智能复盘</div>
        <Button type="primary" loading={aiLoading} onClick={handleAskGemini}>
          让 Gemini AI 帮我制定下一步策略
        </Button>
        {aiLoading && (
          <div className="ai-loading-box">
            <Spin size="large" />
            <Typography.Text type="secondary">
              Gemini 正在读取排行榜并生成策略报告...
            </Typography.Text>
          </div>
        )}
        {aiError && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 14 }}
            message="Gemini 调用失败"
            description={aiError}
          />
        )}
        {aiResult && !aiLoading && (
          <div className="ai-report-box">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Gemini 深度分析报告
            </Typography.Title>
            <Typography.Paragraph className="ai-report-content">
              {aiResult.report_markdown}
            </Typography.Paragraph>
          </div>
        )}
      </div>
    </>
  );
}
