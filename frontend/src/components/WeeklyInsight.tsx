/**
 * Gemini 可编辑周洞察模块（支持持久化保存）
 */
import { Alert, Button, Input, Spin, Typography, message } from "antd";
import { SaveOutlined, CopyOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import {
  requestWeeklyInsight,
  fetchWeeklySavedReport,
  saveWeeklyReport,
} from "../api/client";
import type { GlobalFilters } from "../types";

const { TextArea } = Input;

interface Props {
  filters: GlobalFilters;
  weekStart?: string;
}

export default function WeeklyInsight({ filters, weekStart }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [savedVersion, setSavedVersion] = useState("");

  // 切换周时加载已保存的报告
  useEffect(() => {
    if (!weekStart) return;
    let cancelled = false;
    setReport("");
    setSavedVersion("");
    fetchWeeklySavedReport(weekStart)
      .then((saved) => {
        if (!cancelled && saved) {
          setReport(saved);
          setSavedVersion(saved);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [weekStart]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestWeeklyInsight(filters);
      setReport(result.report_markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 洞察生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleSave = useCallback(async () => {
    if (!weekStart || !report) return;
    setSaving(true);
    try {
      await saveWeeklyReport(weekStart, report);
      setSavedVersion(report);
      message.success("报告已保存");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [weekStart, report]);

  const handleSaveAndCopy = useCallback(async () => {
    if (!weekStart || !report) return;
    setSaving(true);
    try {
      await saveWeeklyReport(weekStart, report);
      setSavedVersion(report);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(report);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = report;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      message.success("报告已保存并复制到剪贴板");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }, [weekStart, report]);

  const hasUnsavedChanges = report !== savedVersion && report.length > 0;

  return (
    <div className="table-card ai-insight-card">
      <div className="card-title">
        Gemini 周维度核心洞察
        {hasUnsavedChanges && (
          <span style={{ fontSize: 11, color: "#faad14", fontWeight: 400, marginLeft: 8 }}>
            (有未保存的修改)
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="primary" loading={loading} onClick={handleGenerate}>
          生成本周 AI 核心洞察报告
        </Button>
        {report && weekStart && (
          <>
            <Button
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
            <Button
              icon={<CopyOutlined />}
              loading={saving}
              onClick={handleSaveAndCopy}
            >
              保存并复制报告
            </Button>
          </>
        )}
      </div>

      {loading && (
        <div className="ai-loading-box">
          <Spin size="large" />
          <Typography.Text type="secondary">
            Gemini 正在分析大盘数据并生成洞察报告...
          </Typography.Text>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 14 }}
          message="生成失败"
          description={error}
        />
      )}

      <TextArea
        className="ai-insight-textarea"
        value={report}
        onChange={(e) => setReport(e.target.value)}
        placeholder="点击上方按钮生成 AI 洞察报告，生成后可直接在此编辑修改并保存..."
        autoSize={{ minRows: 10, maxRows: 30 }}
        style={{ marginTop: 14 }}
      />
    </div>
  );
}
