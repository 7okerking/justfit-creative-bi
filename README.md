# Meta 买量素材复盘与标签统计 BI

自动扫描 `data_inputs/` 文件夹中的 Meta 广告流水表，完成 Copy 后缀去重、**First-Seen 首次上线日归因**、标准素材 ID 与标签维度解析，并提供多页面数据看板。

## 功能概览

| 模块 | 说明 |
|------|------|
| 数据清洗 | 文件名→流水日 Log_Date、Copy 归口、First_Seen_Date、13 段命名规范 |
| 全局筛选 | Meta 风格日历（昨天/近7天/近30天/自定义区间或单日）+ 风格化/痛点/锻炼类型 |
| 页面 1 | 双轴趋势图 + FX×ZT 黄金交叉表 |
| 页面 2 | 设计师总榜 + FX×LVL3 下钻 |

## 目录结构

```
demo-01/
├── data_inputs/          # 放置 Meta 导出 CSV/XLSX（文件名含流水日 20260525 等）
├── data/                 # 旧目录（无 data_inputs 时自动兼容）
├── backend/              # FastAPI + pandas 数据引擎
└── frontend/             # React + Ant Design + ECharts
```

## 快速启动

### 1. 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173

### 3. 导入数据

将 Meta 后台导出的表格放入 `data_inputs/`，**文件名**需包含 8 位**流水日期**（非素材名前缀），例如：

- `20260525当天数据.xlsx`
- `20260522_meta_ads.csv`

素材名开头的 8 位数字仅为**设计产出日**；真正**上线日**由该素材在全部历史文件中首次出现的流水日决定。

点击页头 **「重新扫描 data 文件夹」** 热刷新。

## 命名规范（标准素材 ID）

```
时间_产品名_语言_尺寸_方向_主题_风格化_痛点_锻炼类型_风控_编导_设计师_素材编号
```

示例：

```
20260522_JustFit_EN_720x1280_FX-POV_ZT-Lazy_LVL1-Real_LVL2-Fupa_LVL3-Bed_RS-P2X3R1C2_FL_DHR_05A
```

解析结果：方向 `POV`、主题 `Lazy`、风格化 `Real`、痛点 `Fupa`、锻炼类型 `Bed`、设计师 `DHR`（倒数第二段）。

## 必需列（中英文均可）

- 广告名称
- 已花费金额
- 购物次数
- ROAS（可选，用于加权 ROAS）
- 单次点击费用（全部）、点击率（全部）（可选）

## API

- `GET /api/meta` — 日期范围与筛选项
- `POST /api/refresh` — 重新加载 data 目录
- `GET /api/dashboard/golden-cross?start=&end=` — 页面 1 数据
- `GET /api/dashboard/designer?start=&end=&designer=` — 页面 2 数据
