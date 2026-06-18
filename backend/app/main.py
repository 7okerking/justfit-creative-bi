"""
Meta 买量素材复盘 BI — FastAPI 服务入口。
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

from .data_processor import (
    DataStore,
    _get_new_material_lifetime_df,
    compute_cross_drilldown,
    compute_designer_drilldown,
    compute_designer_leaderboard,
    compute_dimension_leaderboard,
    compute_dynamic_cross_matrix,
    compute_golden_cross,
    compute_golden_cross_matrix,
    compute_old_material_revival,
    compute_material_leaderboard,
    compute_material_summary,
    compute_new_material_summary,
    compute_launch_survival_trend,
    compute_vault_leaderboard,
    compute_weekly_report,
    get_date_range,
    get_filter_options,
)

# 数据文件夹：优先 data_inputs，兼容旧版 data/
_ROOT = Path(__file__).resolve().parents[2]
_DATA_INPUTS = _ROOT / "data_inputs"
_DATA_LEGACY = _ROOT / "data"


gemini_api_key = os.getenv('GEMINI_API_KEY', '')

def resolve_data_dir() -> Path:
    for folder in (_DATA_INPUTS, _DATA_LEGACY):
        if any(folder.glob("*.csv")) or any(folder.glob("*.xlsx")) or any(folder.glob("*.xls")):
            return folder
    _DATA_INPUTS.mkdir(parents=True, exist_ok=True)
    return _DATA_INPUTS


DATA_DIRS = [_DATA_INPUTS, _DATA_LEGACY]
DATA_DIR = resolve_data_dir()
API_VERSION = "2.1.0"

app = FastAPI(title="JustFit_web_买量素材复盘BI", version=API_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = DataStore(DATA_DIRS)


GEMINI_SYSTEM_PROMPT = """你现在是一个精通海外（特别是美国市场）女性健身/减脂 App（产品名叫 JustFit）的顶级买量操盘手与创意总监。你的任务是根据用户提供的前置低预算『测试组』数据，给出极其犀利、一针见血、不讲废话的下一步执行建议。
你的分析必须包含：
1. 🎯 黄金公式：根据表现最好的组合，告诉编导下周拍摄必须锁死哪些元素（方向+主题），如何进行裂变。
2. 🛑 避坑指南：根据表现极差、毫无胜率的组合，点名警告哪些方向必须立刻停止研发，不要浪费测试预算。
3. 🔄 捡钱复测：根据回春的老素材，明确指出哪几个老素材建议立刻通知『起量组』在正式账号里建组重新跑量。
请用轻松、专业、富有实战感的中文语气输出报告，多用 Emoji 增强可读性。"""


def _parse_list_param(value: str | None) -> list[str] | None:
    if not value or value in ("全部", "__all__", ""):
        return None
    return [v.strip() for v in value.split(",") if v.strip()]


def _filtered_df(
    start: str,
    end: str,
    styles: str | None = None,
    pains: str | None = None,
    exercises: str | None = None,
    fx: str | None = None,
    zt: str | None = None,
):
    return store.query(
        start,
        end,
        _parse_list_param(styles),
        _parse_list_param(pains),
        _parse_list_param(exercises),
        _parse_list_param(fx),
        _parse_list_param(zt),
    )


def _scoped_df(
    scope: str,
    start: str,
    end: str,
    styles: str | None = None,
    pains: str | None = None,
    exercises: str | None = None,
    fx: str | None = None,
    zt: str | None = None,
):
    """根据 scope 返回对应的 DataFrame：
    - account: 期间过滤（按 log_date）
    - new: 上新素材全生命周期
    """
    if scope == "new":
        return _get_new_material_lifetime_df(
            store.raw_df,
            start,
            end,
            _parse_list_param(styles),
            _parse_list_param(pains),
            _parse_list_param(exercises),
            _parse_list_param(fx),
            _parse_list_param(zt),
        )
    return _filtered_df(start, end, styles, pains, exercises, fx, zt)


def _format_rows_as_markdown(
    title: str,
    rows: list[dict[str, Any]],
    columns: list[tuple[str, str]],
) -> str:
    """将结构化行数据格式化为 Markdown 表格。"""
    if not rows:
        return f"### {title}\n暂无数据\n"

    headers = "| " + " | ".join([col[0] for col in columns]) + " |"
    sep = "| " + " | ".join(["---"] * len(columns)) + " |"
    lines = [f"### {title}", headers, sep]
    for row in rows:
        vals = [str(row.get(col[1], "")) for col in columns]
        lines.append("| " + " | ".join(vals) + " |")
    return "\n".join(lines) + "\n"


def _build_gemini_input_markdown(
    df: Any,
    start: str,
    end: str,
    primary_dim: str,
    secondary_dim: str,
    min_materials: int,
) -> str:
    """构建 Gemini 输入文本：魔方榜前3后2 + 老素材回春Top2。"""
    sec = None if secondary_dim in ("none", "", "无") else secondary_dim
    dim_rows = compute_dimension_leaderboard(df, primary_dim, sec, min_materials)
    best3 = dim_rows[:3]
    worst2 = sorted(dim_rows, key=lambda x: (x["total_purchases"], x["order_rate"]))[:2]
    old2 = compute_old_material_revival(df, start=start, top_n=2)

    best_md = _format_rows_as_markdown(
        "维度效能自由魔方榜 · Top 3",
        best3,
        [
            ("组合名", "dimension_label"),
            ("出单率(%)", "order_rate"),
            ("出单量", "total_purchases"),
            ("生产素材数", "total_materials"),
        ],
    )
    worst_md = _format_rows_as_markdown(
        "维度效能自由魔方榜 · Bottom 2",
        worst2,
        [
            ("组合名", "dimension_label"),
            ("出单率(%)", "order_rate"),
            ("出单量", "total_purchases"),
            ("生产素材数", "total_materials"),
        ],
    )
    old_md = _format_rows_as_markdown(
        "老素材回春唤醒榜 · Top 2",
        old2,
        [
            ("标准素材ID", "standard_id"),
            ("设计师", "designer"),
            ("编导", "director"),
            ("总出单量", "total_purchases"),
            ("ROAS", "weighted_roas"),
        ],
    )

    return (
        "## 当前筛选上下文\n"
        f"- 日期区间: {start} ~ {end}\n"
        f"- 主维度: {primary_dim}\n"
        f"- 次级维度: {secondary_dim}\n"
        f"- 最低素材数限制: {min_materials}\n\n"
        f"{best_md}\n{worst_md}\n{old_md}\n"
        "请基于以上数据给出下一步创意测试与放量建议。"
    )


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": API_VERSION,
        "rows": len(store.raw_df),
        "data_dirs": [str(d) for d in DATA_DIRS],
        "active_data_dir": str(DATA_DIR),
        "endpoints": [
            "/api/dashboard/golden-cross",
            "/api/dashboard/leaderboard",
            "/api/dashboard/designer",
        ],
    }


@app.post("/api/refresh")
def refresh_data() -> dict[str, Any]:
    count = store.refresh()
    return {"message": "数据已刷新", "rows": count}


@app.get("/api/meta")
def get_meta() -> dict[str, Any]:
    """返回数据日期范围与筛选维度选项。"""
    return {
        "date_range": get_date_range(store.raw_df),
        "filters": get_filter_options(store.raw_df),
        "row_count": len(store.raw_df),
        "file_count": sum(
            len(list(d.glob("*.csv"))) + len(list(d.glob("*.xlsx")))
            for d in DATA_DIRS
            if d.exists()
        ),
        "data_dirs": [str(d) for d in DATA_DIRS],
    }


def _compute_prev_period(start: str, end: str) -> tuple[str, str]:
    """根据当前选择的时间区间，计算上一周期的对比时间范围。"""
    import datetime
    s = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    span = (e - s).days + 1
    if span == 1:
        # 单天：对比上周同一天
        prev_e = s - datetime.timedelta(days=7)
        prev_s = prev_e
    else:
        # 多天：对比前一个等长周期
        prev_e = s - datetime.timedelta(days=1)
        prev_s = prev_e - datetime.timedelta(days=span - 1)
    return prev_s.isoformat(), prev_e.isoformat()


def _compute_comparison(current: dict, previous: dict) -> dict[str, float | None]:
    """计算各指标的环比变化百分比。"""
    result = {}
    for key in ("total_materials", "ordered_materials", "total_orders", "order_rate"):
        cur_v = current.get(key, 0)
        prev_v = previous.get(key, 0)
        if prev_v and prev_v != 0:
            result[f"{key}_change"] = round((cur_v - prev_v) / prev_v * 100, 2)
        else:
            result[f"{key}_change"] = None
    return result


@app.get("/api/dashboard/golden-cross")
def golden_cross_page(
    start: str = Query(..., description="开始日期 YYYY-MM-DD"),
    end: str = Query(..., description="结束日期 YYYY-MM-DD"),
    scope: str = Query("account", description="数据视角: account | new"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
) -> dict[str, Any]:
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)

    if scope == "new":
        summary = compute_new_material_summary(
            store.raw_df,
            start,
            end,
            _parse_list_param(styles),
            _parse_list_param(pains),
            _parse_list_param(exercises),
            _parse_list_param(fx),
            _parse_list_param(zt),
        )
    else:
        summary = compute_material_summary(df)

    # 环比对比：计算上周期的 summary
    prev_start, prev_end = _compute_prev_period(start, end)
    if scope == "new":
        prev_summary = compute_new_material_summary(
            store.raw_df,
            prev_start,
            prev_end,
            _parse_list_param(styles),
            _parse_list_param(pains),
            _parse_list_param(exercises),
            _parse_list_param(fx),
            _parse_list_param(zt),
        )
    else:
        prev_df = _scoped_df("account", prev_start, prev_end, styles, pains, exercises, fx, zt)
        prev_summary = compute_material_summary(prev_df)

    comparison = _compute_comparison(summary, prev_summary)

    return {
        "trend": compute_launch_survival_trend(
            store.raw_df,
            start,
            end,
            _parse_list_param(styles),
            _parse_list_param(pains),
            _parse_list_param(exercises),
            _parse_list_param(fx),
            _parse_list_param(zt),
        ),
        "golden_cross": compute_golden_cross(df),
        "golden_cross_matrix": compute_golden_cross_matrix(df),
        "material_summary": summary,
        "comparison": comparison,
        "prev_period": {"start": prev_start, "end": prev_end},
        "material_leaderboard": compute_material_leaderboard(df, ordered_only=True),
    }


def _leaderboard_payload(
    start: str,
    end: str,
    scope: str,
    styles: str | None,
    pains: str | None,
    exercises: str | None,
    fx: str | None,
    zt: str | None,
    primary_dim: str,
    secondary_dim: str,
    min_materials: int,
    dims: str | None = None,
) -> dict[str, Any]:
    """智能排行榜：素材战神榜 + 维度效能魔方榜。"""
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)

    # dims 优先：逗号分隔的多维度列表
    if dims:
        dim_list = [d.strip() for d in dims.split(",") if d.strip()]
        return {
            "material_leaderboard": compute_material_leaderboard(df),
            "dimension_leaderboard": compute_dimension_leaderboard(
                df, min_materials=min_materials, dims=dim_list
            ),
        }

    sec = None if secondary_dim in ("none", "", "无") else secondary_dim
    return {
        "material_leaderboard": compute_material_leaderboard(df),
        "dimension_leaderboard": compute_dimension_leaderboard(
            df, primary_dim, sec, min_materials
        ),
    }


@app.get("/api/dashboard/leaderboard")
def leaderboard_page(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
    primary_dim: str = Query("zt", description="主维度: zt|fx|style|pain|exercise"),
    secondary_dim: str = Query("none", description="次级维度，none 表示单维"),
    min_materials: int = Query(3, ge=1, le=100, description="最低素材数过滤"),
    dims: str | None = Query(None, description="多维交叉列表（逗号分隔），优先于 primary/secondary"),
) -> dict[str, Any]:
    return _leaderboard_payload(
        start, end, scope, styles, pains, exercises, fx, zt,
        primary_dim, secondary_dim, min_materials, dims,
    )


# 兼容别名，防止旧代理或路径缓存导致 404
@app.get("/api/dashboard/smart-leaderboard")
def smart_leaderboard_page(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
    primary_dim: str = Query("zt"),
    secondary_dim: str = Query("none"),
    min_materials: int = Query(3, ge=1, le=100),
    dims: str | None = Query(None),
) -> dict[str, Any]:
    return _leaderboard_payload(
        start, end, scope, styles, pains, exercises, fx, zt,
        primary_dim, secondary_dim, min_materials, dims,
    )


@app.get("/api/dashboard/designer")
def designer_page(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
    designer: str | None = Query(None, description="下钻目标设计师"),
    drilldown_dim: str = Query("exercise", description="下钻第二维度: exercise|style|zt|pain"),
) -> dict[str, Any]:
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    result: dict[str, Any] = {
        "leaderboard": compute_designer_leaderboard(df),
        "drilldown": [],
    }
    if designer and designer not in ("全部", "__all__", ""):
        result["drilldown"] = compute_designer_drilldown(df, designer, drilldown_dim)
    return result


@app.get("/api/dashboard/vault")
def vault_page(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    min_purchases: int = Query(5, ge=1, description="最低出单数阈值"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
) -> dict[str, Any]:
    """核心资产晋级库：筛选出单 >= min_purchases 的超级素材。"""
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    return {
        "vault_leaderboard": compute_vault_leaderboard(df, min_purchases),
    }


@app.get("/api/dashboard/cross-matrix")
def dynamic_cross_matrix(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    row_dim: str = Query("fx", description="纵轴维度: fx|zt|style|pain|exercise"),
    col_dim: str = Query("zt", description="横轴维度: fx|zt|style|pain|exercise"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
) -> dict[str, Any]:
    """多维自由交叉魔方：按任意两个属性维度生成出单率热力矩阵。"""
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    return compute_dynamic_cross_matrix(df, row_dim, col_dim)


@app.get("/api/dashboard/cross-drilldown")
def cross_drilldown(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    row_dim: str = Query("fx"),
    row_value: str = Query(..., description="纵轴选中值"),
    col_dim: str = Query("zt"),
    col_value: str = Query(..., description="横轴选中值"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
) -> dict[str, Any]:
    """交叉下钻穿透：返回特定维度组合下所有出单素材明细。"""
    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    return {
        "materials": compute_cross_drilldown(df, row_dim, row_value, col_dim, col_value),
    }


@app.get("/api/dashboard/weekly-report")
def weekly_report(
    week_start: str = Query(..., description="周一日期，格式 YYYY-MM-DD"),
    designer: str | None = Query(None, description="可选：筛选设计师"),
) -> dict[str, Any]:
    """周报：按素材名前8位日期归属到指定自然周，聚合全生命周期指标。"""
    import datetime
    ws = datetime.date.fromisoformat(week_start)
    we = ws + datetime.timedelta(days=6)
    ws_str = ws.strftime("%Y%m%d")
    we_str = we.strftime("%Y%m%d")
    return compute_weekly_report(store.raw_df, ws_str, we_str, designer)


@app.post("/api/ai/gemini-strategy")
def gemini_strategy(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
    primary_dim: str = Query("zt"),
    secondary_dim: str = Query("none"),
    min_materials: int = Query(3, ge=1, le=100),
    dims: str | None = Query(None),
) -> dict[str, Any]:
    """
    AI 创意总监智能复盘：
    - 打包魔方榜 Top3 / Bottom2 + 老素材回春 Top2
    - 调用 Gemini 2.5 Flash 输出策略报告
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="未检测到 GEMINI_API_KEY，请先在后端运行环境中配置该环境变量。",
        )

    # 如果传了 dims，用第一个作为 primary_dim 兼容旧逻辑
    effective_primary = primary_dim
    effective_secondary = secondary_dim
    if dims:
        dim_list = [d.strip() for d in dims.split(",") if d.strip()]
        if dim_list:
            effective_primary = dim_list[0]
            effective_secondary = dim_list[1] if len(dim_list) > 1 else "none"

    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    prompt_md = _build_gemini_input_markdown(
        df=df,
        start=start,
        end=end,
        primary_dim=effective_primary,
        secondary_dim=effective_secondary,
        min_materials=min_materials,
    )

    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_md,
            config=types.GenerateContentConfig(
                system_instruction=GEMINI_SYSTEM_PROMPT,
                temperature=0.6,
            ),
        )
        text = getattr(resp, "text", None)
        if not text:
            text = "Gemini 返回为空，请稍后重试。"
        return {"report_markdown": text, "input_markdown": prompt_md}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API 调用失败：{str(e)}",
        ) from e


WEEKLY_INSIGHT_PROMPT = """你是一个精通海外女性健身/减脂 App（JustFit）买量投放的高级数据分析师。请根据用户提供的本周大盘数据，输出一份精简、有操盘指导价值的"本周核心洞察报告"。

报告要求：
1. 用 Markdown 格式输出，结构清晰。
2. 包含以下板块：
   - 📊 本周大盘一句话总结（和上周期对比的涨跌结论）
   - 🔥 最强方向/主题组合 Top 3（说明为什么强）
   - ⚠️ 需警惕的下滑信号（哪些指标环比恶化）
   - 💡 下周优先行动建议（具体、可执行的 2-3 条）
3. 语言简练、专业、中文输出，适当使用 Emoji 增强可读性。
4. 控制在 500 字以内。"""


@app.post("/api/ai/weekly-insight")
def weekly_insight(
    start: str = Query(...),
    end: str = Query(...),
    scope: str = Query("account"),
    styles: str | None = Query(None),
    pains: str | None = Query(None),
    exercises: str | None = Query(None),
    fx: str | None = Query(None),
    zt: str | None = Query(None),
) -> dict[str, Any]:
    """
    Gemini 周维度核心洞察：打包本周大盘 + 环比 + 最优最差组合。
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="未检测到 GEMINI_API_KEY，请先在后端运行环境中配置该环境变量。",
        )

    df = _scoped_df(scope, start, end, styles, pains, exercises, fx, zt)
    summary = compute_material_summary(df) if scope != "new" else compute_new_material_summary(
        store.raw_df, start, end,
        _parse_list_param(styles), _parse_list_param(pains),
        _parse_list_param(exercises), _parse_list_param(fx), _parse_list_param(zt),
    )

    prev_start, prev_end = _compute_prev_period(start, end)
    if scope == "new":
        prev_summary = compute_new_material_summary(
            store.raw_df, prev_start, prev_end,
            _parse_list_param(styles), _parse_list_param(pains),
            _parse_list_param(exercises), _parse_list_param(fx), _parse_list_param(zt),
        )
    else:
        prev_df = _scoped_df("account", prev_start, prev_end, styles, pains, exercises, fx, zt)
        prev_summary = compute_material_summary(prev_df)

    comparison = _compute_comparison(summary, prev_summary)

    golden_cross = compute_golden_cross(df)
    top3 = golden_cross[:3] if golden_cross else []
    worst2 = sorted(golden_cross, key=lambda x: (x["order_rate"], x["total_spend"]))[:2] if golden_cross else []

    prompt_md = (
        f"## 数据区间: {start} ~ {end}\n\n"
        f"### 本期大盘 KPI\n"
        f"- 素材总数: {summary.get('total_materials', 0)}\n"
        f"- 出单素材数: {summary.get('ordered_materials', 0)}\n"
        f"- 总出单量: {summary.get('total_orders', 0)}\n"
        f"- 出单率: {summary.get('order_rate', 0)}%\n\n"
        f"### 环比变化（对比 {prev_start}~{prev_end}）\n"
        f"- 素材总数变化: {comparison.get('total_materials_change', '无数据')}%\n"
        f"- 出单素材数变化: {comparison.get('ordered_materials_change', '无数据')}%\n"
        f"- 总出单量变化: {comparison.get('total_orders_change', '无数据')}%\n"
        f"- 出单率变化: {comparison.get('order_rate_change', '无数据')}%\n\n"
    )

    if top3:
        prompt_md += "### 最强方向×主题组合 Top 3\n"
        for r in top3:
            prompt_md += f"- {r['fx_zt']}：出单率{r['order_rate']}%，素材{r['total_materials']}条\n"
        prompt_md += "\n"

    if worst2:
        prompt_md += "### 最弱方向×主题组合 Bottom 2\n"
        for r in worst2:
            prompt_md += f"- {r['fx_zt']}：出单率{r['order_rate']}%，素材{r['total_materials']}条\n"
        prompt_md += "\n"

    prompt_md += "请基于以上数据给出本周核心洞察报告。"

    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_md,
            config=types.GenerateContentConfig(
                system_instruction=WEEKLY_INSIGHT_PROMPT,
                temperature=0.5,
            ),
        )
        text = getattr(resp, "text", None)
        if not text:
            text = "Gemini 返回为空，请稍后重试。"
        return {"report_markdown": text, "input_markdown": prompt_md}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API 调用失败：{str(e)}",
        ) from e


# ========== 周报报告持久化 ==========

WEEKLY_REPORTS_FILE = Path(__file__).resolve().parent.parent / "data" / "weekly_reports.json"


def _load_weekly_reports() -> dict[str, str]:
    if WEEKLY_REPORTS_FILE.exists():
        return json.loads(WEEKLY_REPORTS_FILE.read_text(encoding="utf-8"))
    return {}


def _save_weekly_reports(data: dict[str, str]) -> None:
    WEEKLY_REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    WEEKLY_REPORTS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


class WeeklyReportBody(BaseModel):
    report: str


@app.get("/api/weekly-reports/{week_start}")
def get_weekly_report_saved(week_start: str) -> dict[str, Any]:
    reports = _load_weekly_reports()
    return {"report": reports.get(week_start)}


@app.put("/api/weekly-reports/{week_start}")
def save_weekly_report_endpoint(week_start: str, body: WeeklyReportBody) -> dict[str, str]:
    reports = _load_weekly_reports()
    reports[week_start] = body.report
    _save_weekly_reports(reports)
    return {"status": "ok"}


# ========== 生产环境：前端静态文件服务 ==========
_FRONTEND_DIST = _ROOT / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="static")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = _FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
