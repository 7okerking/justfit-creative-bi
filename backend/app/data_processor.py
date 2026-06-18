"""
Meta 广告流水数据清洗与标签解析模块。
- 流水日期 Log_Date：来自文件名（买量报表日），非素材名前缀 8 位数字（设计产出日）
- 首次上线日 First_Seen_Date：标准素材 ID 在历史流水中最早出现的 Log_Date（First-Seen 归因）
- Copy 后缀归口：同一标准 ID 下所有 Copy 行的消耗/出单合并统计
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

# 从文件名提取 8 位日期（如 20260522）
FILENAME_DATE_RE = re.compile(r"(20\d{6})")

# Meta 广告名末尾复制后缀（多种写法）
COPY_SUFFIX_RE = re.compile(
    r"(?:\s*[-_]\s*Copy(?:\s+\d+)?|\s*\(Copy(?:\s+\d+)?\)|_Copy(?:_\d+)?|\s+Copy(?:\s+\d+)?)\s*$",
    re.IGNORECASE,
)

# 维度字段前缀剥离
PREFIX_STRIP = {
    "fx": re.compile(r"^FX[-_]?", re.IGNORECASE),
    "zt": re.compile(r"^ZT[-_]?", re.IGNORECASE),
    "lvl1": re.compile(r"^LVL1[-_]?", re.IGNORECASE),
    "lvl2": re.compile(r"^LVL2[-_]?", re.IGNORECASE),
    "lvl3": re.compile(r"^LVL3[-_]?", re.IGNORECASE),
}

# Meta 导出列名映射（中英文兼容）
COLUMN_ALIASES: dict[str, list[str]] = {
    "ad_name": ["广告名称", "广告名", "Ad name", "Ad Name", "广告"],
    "spend": ["已花费金额", "花费金额", "Amount spent", "Spend", "消耗"],
    "purchases": ["购物次数", "购买次数", "Purchases", "转化次数"],
    "roas": ["ROAS", "roas", "广告支出回报率", "购物转化价值"],
    "cpc": ["单次点击费用（全部）", "单次点击费用", "CPC (all)", "CPC"],
    "ctr": ["点击率（全部）", "点击率", "CTR (all)", "CTR"],
}


def _normalize_col_token(col: str) -> str:
    """列名标准化：去空格、括号等，便于模糊匹配不同导出模板。"""
    return re.sub(r"[\s\-_（）()]+", "", col).lower()


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """将 Meta 导出表头统一为标准英文字段名。"""
    rename_map: dict[str, str] = {}
    for col in df.columns:
        col_str = str(col).strip()
        col_norm = _normalize_col_token(col_str)
        for key, aliases in COLUMN_ALIASES.items():
            alias_norms = [_normalize_col_token(a) for a in aliases]
            # 兼容精确命中 + 关键字包含（例如“已花费金额(USD)”）
            if (
                col_str in aliases
                or col_str.lower() in [a.lower() for a in aliases]
                or col_norm in alias_norms
                or any(a in col_norm for a in alias_norms)
                or any(col_norm in a for a in alias_norms)
            ):
                rename_map[col] = key
                break
    return df.rename(columns=rename_map)


SUMMARY_ROW_RE = re.compile(r"(?:汇总|总计|合计|overall|total)", re.IGNORECASE)


def _drop_summary_rows(raw: pd.DataFrame) -> pd.DataFrame:
    """
    清洗汇总行：
    - 删除广告名称为空行（常见为第二行汇总）
    - 删除广告名称包含“汇总/总计/total”等文本的非素材行
    """
    if "ad_name" not in raw.columns or raw.empty:
        return raw

    work = raw.copy()
    name_series = work["ad_name"].astype(str).str.strip()
    is_empty_name = name_series.eq("") | work["ad_name"].isna()
    is_summary_text = name_series.str.contains(SUMMARY_ROW_RE, na=False)
    work = work[~(is_empty_name | is_summary_text)].copy()
    return work


def extract_date_from_filename(filename: str) -> str | None:
    """从文件名提取【流水日期 Log_Date】（如 20260525当天数据.xlsx → 2026-05-25）。"""
    match = FILENAME_DATE_RE.search(filename)
    if not match:
        return None
    raw = match.group(1)
    return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"


def clean_copy_suffix(ad_name: str) -> str:
    """去除广告名称末尾所有 Copy 复制后缀及多余空格，得到标准素材 ID。"""
    if not ad_name or not isinstance(ad_name, str):
        return ""
    name = ad_name.strip()
    # 循环剥离，防止多层 Copy 后缀
    prev = None
    while prev != name:
        prev = name
        name = COPY_SUFFIX_RE.sub("", name).strip()
    return name


def _strip_prefix(value: str, field: str) -> str:
    if not value:
        return ""
    pattern = PREFIX_STRIP.get(field)
    if pattern:
        return pattern.sub("", value).strip()
    return value.strip()


def parse_material_tags(standard_id: str) -> dict[str, str]:
    """
    从标准素材 ID 按命名规范切分标签。
    规范：时间_产品名_语言_尺寸_方向_主题_风格化_痛点_锻炼类型_风控_编导_设计师_素材编号
    """
    empty = {
        "material_time": "",
        "product": "",
        "language": "",
        "size": "",
        "fx": "",
        "zt": "",
        "style": "",
        "pain": "",
        "exercise": "",
        "risk": "",
        "director": "",
        "designer": "",
        "material_no": "",
    }
    if not standard_id:
        return empty

    parts = standard_id.split("_")

    # 无论段数是否够13，前8位数字始终解析为 material_time
    if parts[0] and re.fullmatch(r"\d{8}", parts[0]):
        empty["material_time"] = parts[0]

    # 尾部固定：设计师(倒数第二) / 素材编号(最后)
    # 编导(倒数第三)：仅段数 >= 13 时存在，段数不足时视为缺失编导
    if len(parts) >= 2:
        empty["designer"] = parts[-2]
        empty["material_no"] = parts[-1]
    if len(parts) >= 13:
        empty["director"] = parts[-3]

    # 前面的位置字段按顺序解析（索引 1-9）
    if len(parts) >= 10:
        empty["product"] = parts[1] if len(parts) > 1 else ""
        empty["language"] = parts[2] if len(parts) > 2 else ""
        empty["size"] = parts[3] if len(parts) > 3 else ""
        empty["fx"] = _strip_prefix(parts[4], "fx") if len(parts) > 4 else ""
        empty["zt"] = _strip_prefix(parts[5], "zt") if len(parts) > 5 else ""
        empty["style"] = _strip_prefix(parts[6], "lvl1") if len(parts) > 6 else ""
        empty["pain"] = _strip_prefix(parts[7], "lvl2") if len(parts) > 7 else ""
        empty["exercise"] = _strip_prefix(parts[8], "lvl3") if len(parts) > 8 else ""
        empty["risk"] = parts[9] if len(parts) > 9 else ""

    return empty


def _read_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    if suffix == ".csv":
        for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
            try:
                return pd.read_csv(path, encoding=enc)
            except UnicodeDecodeError:
                continue
        return pd.read_csv(path, encoding="utf-8", errors="replace")
    raise ValueError(f"不支持的文件格式: {path.name}")


def load_and_clean_data(data_dir: Path) -> pd.DataFrame:
    """单目录加载（兼容旧调用）。"""
    return load_and_clean_data_from_dirs([data_dir])


def load_and_clean_data_from_dirs(data_dirs: list[Path]) -> pd.DataFrame:
    """
    扫描多个数据文件夹（data_inputs + data），合并去重后清洗。
    文件名须含 8 位流水日；广告名称列填素材全称即可（含 FX-POV_ZT-Home_... 格式）。
    """
    frames: list[pd.DataFrame] = []
    patterns = ("*.csv", "*.xlsx", "*.xls")
    seen_filenames: set[str] = set()

    for data_dir in data_dirs:
        if not data_dir.exists():
            continue
        for pattern in patterns:
            for file_path in sorted(data_dir.glob(pattern)):
                if file_path.name.startswith("."):
                    continue
                if file_path.name in seen_filenames:
                    continue
                log_date_str = extract_date_from_filename(file_path.name)
                if not log_date_str:
                    continue
                try:
                    raw = _read_file(file_path)
                except Exception:
                    continue
                if raw.empty:
                    continue

                raw = _normalize_columns(raw)
                if "ad_name" not in raw.columns:
                    continue
                raw = _drop_summary_rows(raw)
                if raw.empty:
                    continue

                seen_filenames.add(file_path.name)
                raw["log_date"] = log_date_str
                raw["source_file"] = file_path.name
                raw["standard_id"] = raw["ad_name"].astype(str).map(clean_copy_suffix)
                raw = raw[raw["standard_id"].str.strip() != ""].copy()
                if raw.empty:
                    continue

                tag_rows = raw["standard_id"].map(parse_material_tags)
                for key in [
                    "material_time", "product", "language", "size",
                    "fx", "zt", "style", "pain", "exercise",
                    "risk", "director", "designer", "material_no",
                ]:
                    raw[key] = tag_rows.map(lambda t, k=key: t.get(k, ""))

                for col in ("spend", "purchases", "roas", "cpc", "ctr"):
                    if col in raw.columns:
                        raw[col] = pd.to_numeric(raw[col], errors="coerce").fillna(0)
                    else:
                        raw[col] = 0.0

                frames.append(raw)

    if not frames:
        return pd.DataFrame()

    result = pd.concat(frames, ignore_index=True)
    result["log_date"] = pd.to_datetime(result["log_date"], errors="coerce")
    result["data_date"] = result["log_date"]
    result = result.dropna(subset=["log_date", "standard_id"])
    return _attach_first_seen_date(result)


def _attach_first_seen_date(df: pd.DataFrame) -> pd.DataFrame:
    """
    全局 First-Seen 归因：每个标准素材 ID 的首次上线日 = 历史流水中最早 Log_Date。
    后续 Copy / 加预算产生的一切长尾数据，生命周期指标均归口该 ID。
    """
    if df.empty:
        df["first_seen_date"] = pd.Series(dtype="datetime64[ns]")
        return df
    df = df.copy()
    df["first_seen_date"] = df.groupby("standard_id")["log_date"].transform("min")
    return df


def _apply_filters(
    df: pd.DataFrame,
    start: str,
    end: str,
    styles: list[str] | None,
    pains: list[str] | None,
    exercises: list[str] | None,
    fxs: list[str] | None = None,
    zts: list[str] | None = None,
) -> pd.DataFrame:
    """按日期区间与属性维度（含方向、主题）过滤底表。"""
    if df.empty:
        return df

    start_dt = pd.Timestamp(start)
    end_dt = pd.Timestamp(end) + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)

    # 全局日历筛选的是买量【流水日期】区间
    mask = (df["log_date"] >= start_dt) & (df["log_date"] <= end_dt)
    filtered = df.loc[mask].copy()

    def _dim_filter(frame: pd.DataFrame, col: str, values: list[str] | None) -> pd.DataFrame:
        if not values or "全部" in values or "__all__" in values:
            return frame
        return frame[frame[col].isin(values)]

    filtered = _dim_filter(filtered, "fx", fxs)
    filtered = _dim_filter(filtered, "zt", zts)
    filtered = _dim_filter(filtered, "style", styles)
    filtered = _dim_filter(filtered, "pain", pains)
    filtered = _dim_filter(filtered, "exercise", exercises)
    return filtered


def _aggregate_by_material(df: pd.DataFrame) -> pd.DataFrame:
    """按标准素材 ID 聚合生命周期指标（跨多行/多日累加）。"""
    if df.empty:
        return pd.DataFrame()

    agg = df.groupby("standard_id", as_index=False).agg(
        spend=("spend", "sum"),
        purchases=("purchases", "sum"),
        fx=("fx", "first"),
        zt=("zt", "first"),
        style=("style", "first"),
        pain=("pain", "first"),
        exercise=("exercise", "first"),
        designer=("designer", "first"),
        director=("director", "first"),
        first_seen_date=("first_seen_date", "min"),
        log_date=("log_date", "min"),
    )
    # 加权 ROAS：按消耗加权平均各行 ROAS；若无收入列则用 spend*roas 近似
    roas_weighted = (
        df.groupby("standard_id")
        .apply(
            lambda g: (
                (g["spend"] * g["roas"]).sum() / g["spend"].sum()
                if g["spend"].sum() > 0
                else 0.0
            ),
            include_groups=False,
        )
        .reset_index(name="weighted_roas")
    )
    agg = agg.merge(roas_weighted, on="standard_id", how="left")
    agg["has_order"] = agg["purchases"] > 0
    return agg


# 维度效能榜：前端维度 key -> 数据列名
DIMENSION_COLUMN_MAP: dict[str, str] = {
    "zt": "zt",
    "fx": "fx",
    "style": "style",
    "pain": "pain",
    "exercise": "exercise",
}


def _weighted_roas_from_group(grp: pd.DataFrame) -> float:
    spend = float(grp["spend"].sum())
    if spend <= 0:
        return 0.0
    return float((grp["spend"] * grp["weighted_roas"]).sum() / spend)


def _enrich_material_ctr(df: pd.DataFrame, materials: pd.DataFrame) -> pd.DataFrame:
    """为素材聚合表补充期间 CTR 均值。"""
    if materials.empty or df.empty:
        return materials
    ctr_avg = (
        df.groupby("standard_id")["ctr"]
        .mean()
        .reset_index(name="avg_ctr")
    )
    return materials.merge(ctr_avg, on="standard_id", how="left")


def compute_material_leaderboard(
    df: pd.DataFrame,
    ordered_only: bool = False,
) -> list[dict[str, Any]]:
    """
    素材排行榜：按期间总出单量（购物次数求和）降序。
    ordered_only=True 时仅保留累计购物次数 > 0 的出单素材。
    """
    materials = _enrich_material_ctr(df, _aggregate_by_material(df))
    if materials.empty:
        return []

    if ordered_only:
        materials = materials[materials["purchases"] > 0].copy()

    materials = materials.sort_values("purchases", ascending=False).reset_index(drop=True)
    rows = []
    for idx, row in materials.iterrows():
        spend = float(row["spend"])
        w_roas = float(row["weighted_roas"]) if spend > 0 else 0.0
        cpc_series = df.loc[df["standard_id"] == row["standard_id"], "cpc"]
        avg_cpc = float(cpc_series.mean()) if len(cpc_series) else 0.0
        fs = row.get("first_seen_date")
        fs_str = (
            pd.Timestamp(fs).strftime("%Y-%m-%d")
            if pd.notna(fs)
            else ""
        )
        rows.append({
            "rank": int(idx) + 1,
            "standard_id": row["standard_id"],
            "first_seen_date": fs_str,
            "fx": row.get("fx") or "",
            "zt": row.get("zt") or "",
            "style": row.get("style") or "",
            "pain": row.get("pain") or "",
            "exercise": row.get("exercise") or "",
            "designer": row.get("designer") or "未知",
            "director": row.get("director") or "未知",
            "total_purchases": int(row["purchases"]),
            "has_order": bool(row["has_order"]),
            "weighted_roas": round(w_roas, 4),
            "avg_ctr": round(float(row.get("avg_ctr", 0) or 0), 4),
            "avg_cpc": round(avg_cpc, 4),
            "total_spend": round(spend, 2),
        })
    return rows


def _compute_spend_status(daily_spends: list[float]) -> str:
    """
    根据筛选范围内最后3天日耗判断跑量状态。
    daily_spends: 按日期升序排列的日消耗列表（取最后3天）。
    返回: 增长期 | 起量中 | 衰退期 | 炮灰
    """
    if not daily_spends:
        return "炮灰"

    last3 = daily_spends[-3:] if len(daily_spends) >= 3 else daily_spends
    latest = last3[-1]

    # 起量中：最新日耗 > 1000
    if latest > 1000:
        return "起量中"

    # 增长期：日耗 > 100 且连续递增（最后一天 >= 400）
    if len(last3) >= 3 and all(last3[i] < last3[i + 1] for i in range(len(last3) - 1)):
        if last3[0] > 100 and last3[-1] >= 400:
            return "增长期"

    # 衰退期：连续3日消耗下降
    if len(last3) >= 3 and all(last3[i] > last3[i + 1] for i in range(len(last3) - 1)):
        return "衰退期"

    # 炮灰：日耗 < 100
    if latest < 100:
        return "炮灰"

    # 默认：介于增长和起量之间但不满足严格条件，归入增长期
    if latest >= 400:
        return "起量中"
    if latest >= 100:
        return "增长期"

    return "炮灰"


def compute_vault_leaderboard(
    df: pd.DataFrame,
    min_purchases: int = 5,
) -> list[dict[str, Any]]:
    """
    核心资产晋级库：按 standard_id 全生命周期聚合，
    筛选出单量 >= min_purchases 的素材，按出单量降序排列。
    包含跑量状态判断和总花费。
    """
    materials = _enrich_material_ctr(df, _aggregate_by_material(df))
    if materials.empty:
        return []

    materials = materials[materials["purchases"] >= min_purchases].copy()
    if materials.empty:
        return []

    # 计算每个素材的逐日消耗（用于跑量状态判断）
    daily_spend_map: dict[str, list[float]] = {}
    if not df.empty and "log_date" in df.columns:
        daily = df.groupby(["standard_id", "log_date"], as_index=False)["spend"].sum()
        daily = daily.sort_values("log_date")
        for sid, grp in daily.groupby("standard_id"):
            daily_spend_map[sid] = grp["spend"].tolist()

    materials = materials.sort_values("purchases", ascending=False).reset_index(drop=True)
    rows = []
    for idx, row in materials.iterrows():
        spend = float(row["spend"])
        w_roas = float(row["weighted_roas"]) if spend > 0 else 0.0
        sid = row["standard_id"]
        spend_status = _compute_spend_status(daily_spend_map.get(sid, []))
        rows.append({
            "rank": int(idx) + 1,
            "standard_id": sid,
            "fx": row.get("fx") or "未知",
            "total_purchases": int(row["purchases"]),
            "avg_ctr": round(float(row.get("avg_ctr", 0) or 0), 4),
            "weighted_roas": round(w_roas, 4),
            "total_spend": round(spend, 2),
            "spend_status": spend_status,
        })
    return rows


def compute_material_summary(df: pd.DataFrame) -> dict[str, float | int]:
    """
    主页素材统计模块（按当前筛选时间与属性）：
    - 上线素材总数（去重标准素材 ID）
    - 出单素材数（去重后累计购物 > 0）
    - 总出单量（购物次数求和）
    - 素材出单率
    - 2 单及以上素材率
    - 5 单及以上素材率
    """
    materials = _aggregate_by_material(df)
    if materials.empty:
        return {
            "total_materials": 0,
            "ordered_materials": 0,
            "total_orders": 0,
            "order_rate": 0.0,
            "two_plus_rate": 0.0,
            "five_plus_rate": 0.0,
            "two_plus_materials": 0,
            "five_plus_materials": 0,
        }

    total = int(len(materials))
    ordered = int((materials["purchases"] > 0).sum())
    total_orders = int(materials["purchases"].sum())
    two_plus = int((materials["purchases"] >= 2).sum())
    five_plus = int((materials["purchases"] >= 5).sum())

    return {
        "total_materials": total,
        "ordered_materials": ordered,
        "total_orders": total_orders,
        "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
        "two_plus_rate": round(two_plus / total * 100, 2) if total > 0 else 0.0,
        "five_plus_rate": round(five_plus / total * 100, 2) if total > 0 else 0.0,
        "two_plus_materials": two_plus,
        "five_plus_materials": five_plus,
    }


def _get_new_material_lifetime_df(
    full_df: pd.DataFrame,
    start: str,
    end: str,
    styles: list[str] | None = None,
    pains: list[str] | None = None,
    exercises: list[str] | None = None,
    fxs: list[str] | None = None,
    zts: list[str] | None = None,
) -> pd.DataFrame:
    """
    提取在 [start, end] 区间内首次上线的素材的全生命周期行数据。
    仅应用属性维度筛选，不截断 log_date。
    """
    if full_df.empty:
        return pd.DataFrame()

    start_dt = pd.Timestamp(start).normalize()
    end_dt = pd.Timestamp(end).normalize()

    launched_ids = full_df.loc[
        (full_df["first_seen_date"].dt.normalize() >= start_dt)
        & (full_df["first_seen_date"].dt.normalize() <= end_dt),
        "standard_id",
    ].unique()

    if len(launched_ids) == 0:
        return pd.DataFrame()

    subset = full_df[full_df["standard_id"].isin(launched_ids)].copy()

    def _dim_filter(frame: pd.DataFrame, col: str, values: list[str] | None) -> pd.DataFrame:
        if not values or "全部" in values or "__all__" in values:
            return frame
        return frame[frame[col].isin(values)]

    subset = _dim_filter(subset, "fx", fxs)
    subset = _dim_filter(subset, "zt", zts)
    subset = _dim_filter(subset, "style", styles)
    subset = _dim_filter(subset, "pain", pains)
    subset = _dim_filter(subset, "exercise", exercises)

    return subset


def compute_new_material_summary(
    full_df: pd.DataFrame,
    start: str,
    end: str,
    styles: list[str] | None = None,
    pains: list[str] | None = None,
    exercises: list[str] | None = None,
    fxs: list[str] | None = None,
    zts: list[str] | None = None,
) -> dict[str, float | int]:
    """
    上新素材全生命周期归因统计：
    1. 从全量数据中找到 first_seen_date 落在 [start, end] 内的素材 ID
    2. 提取这些素材在全部历史中的所有行（不截断 log_date）
    3. 仅应用属性维度筛选
    4. 汇总全生命周期出单
    """
    _empty = {
        "total_materials": 0,
        "ordered_materials": 0,
        "total_orders": 0,
        "order_rate": 0.0,
        "two_plus_rate": 0.0,
        "five_plus_rate": 0.0,
        "two_plus_materials": 0,
        "five_plus_materials": 0,
    }

    subset = _get_new_material_lifetime_df(
        full_df, start, end, styles, pains, exercises, fxs, zts
    )
    if subset.empty:
        return _empty

    materials = _aggregate_by_material(subset)
    if materials.empty:
        return _empty

    total = int(len(materials))
    ordered = int((materials["purchases"] > 0).sum())
    total_orders = int(materials["purchases"].sum())
    two_plus = int((materials["purchases"] >= 2).sum())
    five_plus = int((materials["purchases"] >= 5).sum())

    return {
        "total_materials": total,
        "ordered_materials": ordered,
        "total_orders": total_orders,
        "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
        "two_plus_rate": round(two_plus / total * 100, 2) if total > 0 else 0.0,
        "five_plus_rate": round(five_plus / total * 100, 2) if total > 0 else 0.0,
        "two_plus_materials": two_plus,
        "five_plus_materials": five_plus,
    }


def compute_dimension_leaderboard(
    df: pd.DataFrame,
    primary_dim: str = "zt",
    secondary_dim: str | None = None,
    min_materials: int = 3,
    dims: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    维度效能自由魔方榜：支持 1~5 个维度自由交叉分组排行。
    dims 优先级高于 primary_dim/secondary_dim（向下兼容）。
    min_materials：生产素材总数低于该值的维度组合不展示。
    """
    materials = _aggregate_by_material(df)
    if materials.empty:
        return []

    # 确定 group_cols
    if dims and len(dims) > 0:
        group_cols = []
        seen = set()
        for d in dims:
            col = DIMENSION_COLUMN_MAP.get(d)
            if col and col not in seen:
                group_cols.append(col)
                seen.add(col)
        if not group_cols:
            return []
    else:
        primary_col = DIMENSION_COLUMN_MAP.get(primary_dim)
        if not primary_col:
            return []
        group_cols = [primary_col]
        if secondary_dim and secondary_dim != "none":
            secondary_col = DIMENSION_COLUMN_MAP.get(secondary_dim)
            if secondary_col and secondary_col != primary_col:
                group_cols.append(secondary_col)

    rows = []
    for keys, grp in materials.groupby(group_cols, dropna=False):
        if not isinstance(keys, tuple):
            keys = (keys,)
        total = len(grp)
        if total < max(min_materials, 1):
            continue

        ordered = int(grp["has_order"].sum())
        spend = float(grp["spend"].sum())
        total_purchases = int(grp["purchases"].sum())
        w_roas = _weighted_roas_from_group(grp)

        dim_name = " + ".join(str(k or "未知") for k in keys)

        rows.append({
            "dimension_label": dim_name,
            "total_materials": total,
            "ordered_materials": ordered,
            "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
            "total_purchases": total_purchases,
            "weighted_roas": round(w_roas, 4),
            "total_spend": round(spend, 2),
        })

    rows.sort(key=lambda x: (-x["total_purchases"], -x["order_rate"]))
    for i, row in enumerate(rows):
        row["rank"] = i + 1
    return rows


def compute_old_material_revival(
    df: pd.DataFrame,
    start: str,
    top_n: int = 2,
) -> list[dict[str, Any]]:
    """
    老素材回春唤醒榜：
    - 老素材定义：first_seen_date < 当前筛选开始日
    - 按当前筛选区间内累计出单量降序取 TopN
    """
    materials = _aggregate_by_material(df)
    if materials.empty:
        return []

    start_dt = pd.Timestamp(start).normalize()
    old = materials[
        (materials["first_seen_date"].dt.normalize() < start_dt)
        & (materials["purchases"] > 0)
    ].copy()
    if old.empty:
        return []

    old = old.sort_values(["purchases", "spend"], ascending=[False, False]).head(top_n)
    rows: list[dict[str, Any]] = []
    for _, row in old.iterrows():
        fs = row.get("first_seen_date")
        fs_str = pd.Timestamp(fs).strftime("%Y-%m-%d") if pd.notna(fs) else ""
        rows.append(
            {
                "standard_id": row["standard_id"],
                "designer": row.get("designer") or "未知",
                "director": row.get("director") or "未知",
                "first_seen_date": fs_str,
                "total_purchases": int(row["purchases"]),
                "total_spend": round(float(row["spend"]), 2),
                "weighted_roas": round(float(row.get("weighted_roas", 0) or 0), 4),
            }
        )
    return rows


def compute_golden_cross_matrix(df: pd.DataFrame) -> dict[str, Any]:
    """为热力图提供 FX×ZT 矩阵结构。"""
    cross = compute_golden_cross(df)
    if not cross:
        return {"fx_list": [], "zt_list": [], "cells": []}

    fx_list = sorted({r["fx"] for r in cross})
    zt_list = sorted({r["zt"] for r in cross})
    lookup = {(r["fx"], r["zt"]): r for r in cross}
    cells = []
    for fx in fx_list:
        for zt in zt_list:
            r = lookup.get((fx, zt))
            cells.append({
                "fx": fx,
                "zt": zt,
                "order_rate": r["order_rate"] if r else None,
                "total_materials": r["total_materials"] if r else 0,
                "ordered_materials": r["ordered_materials"] if r else 0,
                "weighted_roas": r["weighted_roas"] if r else 0,
            })
    return {"fx_list": fx_list, "zt_list": zt_list, "cells": cells}


def compute_dynamic_cross_matrix(
    df: pd.DataFrame,
    row_dim: str,
    col_dim: str,
) -> dict[str, Any]:
    """
    多维自由交叉魔方：按任意两个维度生成出单率热力矩阵。
    row_dim / col_dim 可选：fx, zt, style, pain, exercise
    """
    materials = _aggregate_by_material(df)
    if materials.empty:
        return {"row_list": [], "col_list": [], "cells": [], "row_dim": row_dim, "col_dim": col_dim}

    row_list = sorted(materials[row_dim].dropna().unique().tolist())
    col_list = sorted(materials[col_dim].dropna().unique().tolist())

    lookup: dict[tuple[str, str], dict[str, Any]] = {}
    for (rv, cv), grp in materials.groupby([row_dim, col_dim], dropna=False):
        total = len(grp)
        ordered = int(grp["has_order"].sum())
        spend = float(grp["spend"].sum())
        w_roas = (
            (grp["spend"] * grp["weighted_roas"]).sum() / spend if spend > 0 else 0.0
        )
        lookup[(str(rv or "未知"), str(cv or "未知"))] = {
            "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
            "total_materials": total,
            "ordered_materials": ordered,
            "weighted_roas": round(w_roas, 4),
        }

    if "未知" not in row_list and any("未知" in k[0] for k in lookup):
        row_list.append("未知")
    if "未知" not in col_list and any("未知" in k[1] for k in lookup):
        col_list.append("未知")

    cells = []
    for rv in row_list:
        for cv in col_list:
            r = lookup.get((rv, cv))
            cells.append({
                "row_value": rv,
                "col_value": cv,
                "order_rate": r["order_rate"] if r else None,
                "total_materials": r["total_materials"] if r else 0,
                "ordered_materials": r["ordered_materials"] if r else 0,
                "weighted_roas": r["weighted_roas"] if r else 0,
            })

    return {
        "row_list": row_list,
        "col_list": col_list,
        "row_dim": row_dim,
        "col_dim": col_dim,
        "cells": cells,
    }


def compute_cross_drilldown(
    df: pd.DataFrame,
    row_dim: str,
    row_value: str,
    col_dim: str,
    col_value: str,
) -> list[dict[str, Any]]:
    """
    交叉下钻：返回特定维度组合下所有出单素材的明细。
    """
    materials = _enrich_material_ctr(df, _aggregate_by_material(df))
    if materials.empty:
        return []

    mask = (
        (materials[row_dim].fillna("未知") == row_value)
        & (materials[col_dim].fillna("未知") == col_value)
        & (materials["purchases"] > 0)
    )
    subset = materials.loc[mask].sort_values("purchases", ascending=False).reset_index(drop=True)
    if subset.empty:
        return []

    rows = []
    for _, row in subset.iterrows():
        fs = row.get("first_seen_date")
        fs_str = pd.Timestamp(fs).strftime("%Y-%m-%d") if pd.notna(fs) else ""
        spend = float(row["spend"])
        w_roas = float(row["weighted_roas"]) if spend > 0 else 0.0
        rows.append({
            "standard_id": row["standard_id"],
            "first_seen_date": fs_str,
            "total_purchases": int(row["purchases"]),
            "avg_ctr": round(float(row.get("avg_ctr", 0) or 0), 4),
            "weighted_roas": round(w_roas, 4),
        })
    return rows


def _apply_attribute_filters(
    df: pd.DataFrame,
    styles: list[str] | None,
    pains: list[str] | None,
    exercises: list[str] | None,
    fxs: list[str] | None = None,
    zts: list[str] | None = None,
) -> pd.DataFrame:
    """仅属性维度过滤（不限制流水日期），用于趋势 cohort 圈选。"""
    if df.empty:
        return df

    def _dim_filter(frame: pd.DataFrame, col: str, values: list[str] | None) -> pd.DataFrame:
        if not values or "全部" in values or "__all__" in values:
            return frame
        return frame[frame[col].isin(values)]

    out = df
    out = _dim_filter(out, "fx", fxs)
    out = _dim_filter(out, "zt", zts)
    out = _dim_filter(out, "style", styles)
    out = _dim_filter(out, "pain", pains)
    out = _dim_filter(out, "exercise", exercises)
    return out


def _lifetime_survival_table(df: pd.DataFrame) -> pd.DataFrame:
    """全历史累计出单（不受日历截断），用于「截止到目前」成活率。"""
    if df.empty:
        return pd.DataFrame(columns=["standard_id", "lifetime_purchases", "has_lifetime_order"])
    out = df.groupby("standard_id", as_index=False).agg(lifetime_purchases=("purchases", "sum"))
    out["has_lifetime_order"] = out["lifetime_purchases"] > 0
    return out


def _material_launch_table(df: pd.DataFrame) -> pd.DataFrame:
    """每个标准素材 ID 的首次上线日与累计是否出单。"""
    if df.empty or "first_seen_date" not in df.columns:
        return pd.DataFrame(columns=["standard_id", "launch_day", "has_lifetime_order"])
    launch = df.groupby("standard_id", as_index=False).agg(
        first_seen_date=("first_seen_date", "min")
    )
    launch["launch_day"] = launch["first_seen_date"].dt.normalize()
    launch = launch.merge(_lifetime_survival_table(df), on="standard_id", how="left")
    launch["has_lifetime_order"] = launch["has_lifetime_order"].fillna(False)
    return launch[["standard_id", "launch_day", "has_lifetime_order"]]


def _survival_rate_pct(group: pd.DataFrame) -> float | None:
    if group.empty:
        return None
    total = len(group)
    survived = int(group["has_lifetime_order"].sum())
    return round(survived / total * 100, 2) if total > 0 else None


def compute_launch_survival_trend(
    full_df: pd.DataFrame,
    start: str,
    end: str,
    styles: list[str] | None = None,
    pains: list[str] | None = None,
    exercises: list[str] | None = None,
    fxs: list[str] | None = None,
    zts: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    上新日真实成活趋势（First-Seen + 7 日大盘滚动基准）

    横轴：连续日历日 [start, end]（避免 B 线因单日无上新而断点）

    - 柱：当日 First_Seen 的全新素材数（联动属性筛选）
    - 曲线 A（实线）：当日首上线 cohort 累计成活率（联动属性筛选）
    - 曲线 B（虚线）：过去 7 日大盘首上线素材滚动成活率（全账户，不吃筛选）
    """
    if full_df.empty or "first_seen_date" not in full_df.columns:
        return []

    start_dt = pd.Timestamp(start).normalize()
    end_dt = pd.Timestamp(end).normalize()
    if start_dt > end_dt:
        return []

    # B 线：全大盘首上线素材（永远不受顶部特征筛选影响）
    market_launch = _material_launch_table(full_df)

    # 柱 + A 线：属性筛选后的素材池
    df_attr = _apply_attribute_filters(full_df, styles, pains, exercises, fxs, zts)
    filtered_launch = _material_launch_table(df_attr)

    result: list[dict[str, Any]] = []
    for day in pd.date_range(start_dt, end_dt, freq="D"):
        day_norm = pd.Timestamp(day).normalize()

        day_filtered = filtered_launch[filtered_launch["launch_day"] == day_norm]
        new_count = len(day_filtered)
        rate_a = _survival_rate_pct(day_filtered)

        # 滚动 7 日窗口：[当天-6, 当天] 内首次上线的全部大盘素材
        window_start = day_norm - pd.Timedelta(days=6)
        rolling_market = market_launch[
            (market_launch["launch_day"] >= window_start)
            & (market_launch["launch_day"] <= day_norm)
        ]
        rate_b = _survival_rate_pct(rolling_market)
        # 7 日窗口内无首上线时：回退为「截至当日前已全部上线素材」的累计成活率，避免日历漂移到无数据月份时 B 线整段消失
        if rate_b is None:
            cumulative_market = market_launch[market_launch["launch_day"] <= day_norm]
            rate_b = _survival_rate_pct(cumulative_market)

        result.append({
            "date": day_norm.strftime("%Y-%m-%d"),
            "new_material_count": new_count,
            "survival_rate": rate_a,
            "order_rate": rate_a if rate_a is not None else 0.0,
            "rolling_benchmark_rate": rate_b,
        })

    # B 线前向/后向填充：7 日窗口暂时为空时沿用最近有效大盘基准，避免折线整段消失
    _ffill_rolling_benchmark(result)

    return result


def _ffill_rolling_benchmark(rows: list[dict[str, Any]]) -> None:
    """就地填充 rolling_benchmark_rate，保证晴雨表折线连续。"""
    if not rows:
        return

    last: float | None = None
    for row in rows:
        val = row.get("rolling_benchmark_rate")
        if val is not None:
            last = float(val)
        elif last is not None:
            row["rolling_benchmark_rate"] = last

    first_valid = next(
        (float(r["rolling_benchmark_rate"]) for r in rows if r.get("rolling_benchmark_rate") is not None),
        None,
    )
    if first_valid is None:
        return
    for row in rows:
        if row.get("rolling_benchmark_rate") is None:
            row["rolling_benchmark_rate"] = first_valid
        else:
            break


def compute_golden_cross(df: pd.DataFrame) -> list[dict[str, Any]]:
    """黄金交叉透视：方向(FX) x 主题(ZT) 生命周期指标。"""
    materials = _aggregate_by_material(df)
    if materials.empty:
        return []

    materials["fx_zt"] = materials["fx"] + "+" + materials["zt"]

    rows = []
    for (fx, zt), grp in materials.groupby(["fx", "zt"], dropna=False):
        total = len(grp)
        ordered = int(grp["has_order"].sum())
        spend = float(grp["spend"].sum())
        w_roas = (
            (grp["spend"] * grp["weighted_roas"]).sum() / spend if spend > 0 else 0.0
        )
        rows.append({
            "fx": fx or "未知",
            "zt": zt or "未知",
            "fx_zt": f"{fx or '未知'}+{zt or '未知'}",
            "total_materials": total,
            "ordered_materials": ordered,
            "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
            "total_spend": round(spend, 2),
            "weighted_roas": round(w_roas, 4),
        })
    rows.sort(key=lambda x: (-x["total_spend"], -x["order_rate"]))
    return rows


def compute_designer_leaderboard(df: pd.DataFrame) -> list[dict[str, Any]]:
    """设计师总榜：生命周期去重统计 + 大盘爆款贡献度。"""
    materials = _aggregate_by_material(df)
    if materials.empty:
        return []

    market_purchases = float(materials["purchases"].sum())

    rows = []
    for designer, grp in materials.groupby("designer", dropna=False):
        total = len(grp)
        ordered = int(grp["has_order"].sum())
        spend = float(grp["spend"].sum())
        designer_purchases = float(grp["purchases"].sum())
        w_roas = _weighted_roas_from_group(grp)
        burst_pct = (
            designer_purchases / market_purchases * 100
            if market_purchases > 0
            else 0.0
        )
        rows.append({
            "designer": designer or "未知",
            "total_materials": total,
            "ordered_materials": ordered,
            "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
            "total_spend": round(spend, 2),
            "weighted_roas": round(w_roas, 4),
            "total_purchases": int(designer_purchases),
            "burst_contribution_pct": round(burst_pct, 2),
        })
    rows.sort(key=lambda x: (-x["total_spend"], -x["order_rate"]))
    return rows


def compute_designer_drilldown(
    df: pd.DataFrame,
    designer: str,
    secondary_dim: str = "exercise",
) -> list[dict[str, Any]]:
    """
    设计师下钻：方向(FX) + 自定义第二维度 联合分组。
    secondary_dim 可选：exercise, style, zt, pain
    """
    materials = _aggregate_by_material(df)
    if materials.empty or not designer:
        return []

    sub = materials[materials["designer"] == designer]
    if sub.empty:
        return []

    if secondary_dim not in ("exercise", "style", "zt", "pain"):
        secondary_dim = "exercise"

    rows = []
    for (fx, dim_val), grp in sub.groupby(["fx", secondary_dim], dropna=False):
        total = len(grp)
        ordered = int(grp["has_order"].sum())
        spend = float(grp["spend"].sum())
        w_roas = (
            (grp["spend"] * grp["weighted_roas"]).sum() / spend if spend > 0 else 0.0
        )
        rows.append({
            "fx": fx or "未知",
            "secondary_value": dim_val or "未知",
            "combo": f"{fx or '未知'} × {dim_val or '未知'}",
            "total_materials": total,
            "ordered_materials": ordered,
            "order_rate": round(ordered / total * 100, 2) if total > 0 else 0.0,
            "weighted_roas": round(w_roas, 4),
        })
    rows.sort(key=lambda x: (-x["total_materials"], -x["order_rate"]))
    return rows


def get_filter_options(df: pd.DataFrame) -> dict[str, list[str]]:
    """返回风格化、痛点、锻炼类型的可选值列表。"""
    if df.empty:
        return {
            "fx": [], "zt": [], "styles": [], "pains": [], "exercises": [], "designers": [],
        }
    return {
        "fx": sorted(df["fx"].dropna().unique().tolist()),
        "zt": sorted(df["zt"].dropna().unique().tolist()),
        "styles": sorted(df["style"].dropna().unique().tolist()),
        "pains": sorted(df["pain"].dropna().unique().tolist()),
        "exercises": sorted(df["exercise"].dropna().unique().tolist()),
        "designers": sorted(df["designer"].dropna().unique().tolist()),
    }


def get_date_range(df: pd.DataFrame) -> dict[str, str | None]:
    """日历默认范围：流水日期；另返回首次上线日范围供前端参考。"""
    if df.empty:
        return {
            "min": None,
            "max": None,
            "first_seen_min": None,
            "first_seen_max": None,
        }
    return {
        "min": df["log_date"].min().strftime("%Y-%m-%d"),
        "max": df["log_date"].max().strftime("%Y-%m-%d"),
        "first_seen_min": df["first_seen_date"].min().strftime("%Y-%m-%d"),
        "first_seen_max": df["first_seen_date"].max().strftime("%Y-%m-%d"),
    }


class DataStore:
    """内存数据仓库，启动时加载并支持热刷新。"""

    def __init__(self, data_dirs: list[Path]):
        self.data_dirs = data_dirs
        for folder in self.data_dirs:
            folder.mkdir(parents=True, exist_ok=True)
        self.raw_df = pd.DataFrame()
        self.refresh()

    def refresh(self) -> int:
        self.raw_df = load_and_clean_data_from_dirs(self.data_dirs)
        return len(self.raw_df)

    def query(
        self,
        start: str,
        end: str,
        styles: list[str] | None = None,
        pains: list[str] | None = None,
        exercises: list[str] | None = None,
        fxs: list[str] | None = None,
        zts: list[str] | None = None,
    ) -> pd.DataFrame:
        return _apply_filters(
            self.raw_df, start, end, styles, pains, exercises, fxs, zts
        )


def compute_weekly_report(
    df: pd.DataFrame,
    week_start: str,
    week_end: str,
    designer: str | None = None,
) -> dict[str, Any]:
    """
    周报统计：按素材名前 8 位日期（material_time）归属到指定周。
    week_start/week_end 格式 YYYYMMDD。
    返回 summary + ordered_materials + all_materials + designers。
    """
    if df.empty or "material_time" not in df.columns:
        return _empty_weekly()

    # 筛选该周产出的素材 standard_id
    mask = (df["material_time"] >= week_start) & (df["material_time"] <= week_end)
    week_sids = df.loc[mask, "standard_id"].unique().tolist()
    if not week_sids:
        return _empty_weekly()

    # 全生命周期数据聚合（仅限该周产出的素材）
    lifecycle_df = df[df["standard_id"].isin(week_sids)]
    materials = _enrich_material_ctr(lifecycle_df, _aggregate_by_material(lifecycle_df))
    if materials.empty:
        return _empty_weekly()

    # 如果指定设计师则过滤
    if designer and designer not in ("全部", "__all__", ""):
        designer_materials = materials[materials["designer"] == designer].copy()
    else:
        designer_materials = materials

    # 总览统计
    total = len(designer_materials)
    ordered = int(designer_materials["has_order"].sum())
    total_purchases = int(designer_materials["purchases"].sum())
    order_rate = round(ordered / total * 100, 2) if total > 0 else 0.0
    spend = float(designer_materials["spend"].sum())
    ordered_rows = designer_materials[designer_materials["purchases"] > 0]
    avg_roas = (
        float(ordered_rows["weighted_roas"].mean()) if len(ordered_rows) > 0 else 0.0
    )
    avg_ctr = float(designer_materials["avg_ctr"].mean()) if total > 0 else 0.0

    summary = {
        "total_materials": total,
        "ordered_materials": ordered,
        "total_purchases": total_purchases,
        "order_rate": order_rate,
        "avg_roas": round(avg_roas, 4),
        "avg_ctr": round(avg_ctr, 4),
        "total_spend": round(spend, 2),
    }

    # 素材明细
    def _build_rows(mat_df: pd.DataFrame) -> list[dict[str, Any]]:
        mat_df = mat_df.sort_values("purchases", ascending=False).reset_index(drop=True)
        rows = []
        for idx, row in mat_df.iterrows():
            sp = float(row["spend"])
            w_roas = float(row["weighted_roas"]) if sp > 0 else 0.0
            rows.append({
                "rank": int(idx) + 1,
                "standard_id": row["standard_id"],
                "designer": row.get("designer") or "未知",
                "director": row.get("director") or "未知",
                "fx": row.get("fx") or "",
                "total_purchases": int(row["purchases"]),
                "weighted_roas": round(w_roas, 4),
                "avg_ctr": round(float(row.get("avg_ctr", 0) or 0), 4),
                "total_spend": round(sp, 2),
            })
        return rows

    all_rows = _build_rows(designer_materials)
    ordered_list = _build_rows(
        designer_materials[designer_materials["purchases"] > 0].copy()
    )

    # 设计师列表
    designers = sorted(materials["designer"].dropna().unique().tolist())

    return {
        "summary": summary,
        "all_materials": all_rows,
        "ordered_materials": ordered_list,
        "designers": designers,
    }


def _empty_weekly() -> dict[str, Any]:
    return {
        "summary": {
            "total_materials": 0,
            "ordered_materials": 0,
            "total_purchases": 0,
            "order_rate": 0.0,
            "avg_roas": 0.0,
            "avg_ctr": 0.0,
            "total_spend": 0.0,
        },
        "all_materials": [],
        "ordered_materials": [],
        "designers": [],
    }
