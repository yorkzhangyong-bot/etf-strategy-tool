# ETF 策略投资工具 — 设计文档

**日期**: 2026-05-18
**状态**: 已审阅（v2，合并 design review 反馈）

---

## 1. 概述

### 目标
为用户提供 ETF 投资决策支持：选择/定制投资策略 → 推荐匹配 ETF → 多 ETF 横向对比 → 组合回测 → 查看收益和风险报告。

### 范围
- Web 应用，全球 ETF 覆盖
- 经典策略 + 自定义多因子策略
- 多 ETF 组合回测和横向对比
- 投资专有名词 Tooltip 解释

---

## 2. 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | Next.js (App Router) + React + TypeScript |
| 样式 | Tailwind CSS |
| 图表 | Recharts |
| 后端 API | Next.js Route Handlers (Node.js 参数校验和路由) |
| 计算层 | Python Vercel Functions (Fluid Compute) |
| 数据源 | yfinance (主力) + 备用免费 API |
| 数据库 | Neon Postgres (Vercel Marketplace) |
| 部署 | Vercel (前端 + Functions) |
| 配置 | vercel.ts |
| 语言 | 仅中文（zh.json） |

---

## 3. 架构

```
┌───────────────────────────────────────────────┐
│                   Vercel 平台                  │
│                                               │
│  ┌─────────────┐     ┌──────────────────────┐ │
│  │  Next.js App│     │  Python Functions    │ │
│  │             │     │                      │ │
│  │  ├ 页面UI   │     │  ├ strategy-engine   │ │
│  │  ├ API路由  │◄───►│  ├ backtest-engine   │ │
│  │  ├ 中间件   │     │  └ data-fetcher      │ │
│  │  └ Server   │     │                      │ │
│  │    Actions  │     │                      │ │
│  └──────┬──────┘     └──────────┬───────────┘ │
│         │                      │              │
│  ┌──────▼──────────────────────▼───────────┐  │
│  │            Neon Postgres                │  │
│  │  etfs │ strategies │ scores │ backtest  │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

**Next.js → Python 通信机制：**
- Next.js API Route 通过 HTTP 请求调用 Python Function URL
- Vercel 内部网络低延迟（同项目内调用）
- Python Function 返回计算结果，API Route 格式化后返回前端
- 前端不直接调用 Python Function URL

**分层原则：**
- `app/api/` 只做路由转发和参数校验，不写业务逻辑
- `app/middleware.ts` 校验 X-API-Key，保护所有 POST/PUT/DELETE 端点
- Python Functions 做所有计算和数据抓取
- React 组件做纯展示，通过 Route Handlers 获取数据

---

## 4. 安全

### API 认证
- Next.js middleware 对所有 POST/PUT/DELETE 端点校验 `X-API-Key` 请求头
- API Key 存储在 Vercel 环境变量 `API_SECRET_KEY` 中
- 前端请求自动附带该 Key
- GET 端点（策略列表、ETF 搜索）公开可读，无需 Key

### 速率限制
- Vercel WAF 规则对 `/api/backtest/*` 限制 10 次/分钟
- Python Functions 最大执行时间 300s（回测）、60s（其他）

---

## 5. API 设计

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/api/strategies` | 获取策略列表 | 否 |
| POST | `/api/strategies` | 创建自定义策略 | 是 |
| GET | `/api/strategies/[id]` | 查看策略详情 | 否 |
| PUT | `/api/strategies/[id]` | 编辑策略 | 是 |
| DELETE | `/api/strategies/[id]` | 删除策略 | 是 |
| GET | `/api/etfs?q=&category=&region=&page=&limit=` | 搜索 ETF | 否 |
| GET | `/api/etfs/[ticker]` | ETF 详情 | 否 |
| POST | `/api/strategies/recommend` | 策略引擎评分 → 推荐 ETF | 是 |
| POST | `/api/compare` | 多 ETF 横向对比 | 是 |
| POST | `/api/backtest/run` | 执行组合回测 | 是 |
| GET | `/api/backtest/[id]` | 查看历史回测结果 | 否 |
| POST | `/api/data/refresh` | 手动触发数据刷新（cron 也会调） | 是 |

### 请求/响应示例

**POST `/api/strategies/recommend`**
```json
// Request
{
  "strategy_id": 1,
  "params": { "lookback": "6m", "max_holdings": 10 }
}
// Response
{
  "recommendations": [
    {
      "ticker": "SPY", "name": "SPDR S&P 500 ETF", "score": 94,
      "factor_scores": { "momentum": 92, "low_vol": 88, "size": 95 }
    },
    {
      "ticker": "IWM", "name": "iShares Russell 2000", "score": 89,
      "factor_scores": { "momentum": 85, "low_vol": 90, "size": 82 }
    }
  ]
}
```

**POST `/api/compare`**
```json
// Request
{ "etf_tickers": ["SPY", "QQQ", "VTI"], "lookback_months": 36 }
// Response
{
  "comparison": [
    { "ticker": "SPY", "annual_return": 0.102, "sharpe": 0.67, "volatility": 0.151, "max_drawdown": -0.337, "expense_ratio": 0.0009 },
    { "ticker": "QQQ", "annual_return": 0.148, "sharpe": 0.81, "volatility": 0.183, "max_drawdown": -0.326, "expense_ratio": 0.0020 }
  ],
  "correlation_matrix": [
    [1.0, 0.89, 0.92],
    [0.89, 1.0, 0.78],
    [0.92, 0.78, 1.0]
  ]
}
```

**POST `/api/backtest/run`**
```json
// Request
{
  "strategy_id": 1,
  "etf_tickers": ["SPY", "QQQ", "VTI"],
  "weights": [0.4, 0.3, 0.3],
  "start_date": "2020-01-01",
  "end_date": "2025-12-31"
}
// Response
{
  "id": 42,
  "annual_return": 0.112,
  "sharpe_ratio": 0.72,
  "max_drawdown": -0.285,
  "volatility": 0.142,
  "daily_nav": [{"date": "2020-01-02", "value": 1.0}, ...],
  "data_freshness": "live"
}
```

**统一错误响应格式：**
```json
{
  "error": "BACKTEST_FAILED",
  "detail": "无法获取 VTI 的历史数据（请求超时）",
  "partial_data": false
}
```

**部分失败处理：** 多 ETF 操作中若个别 ETF 数据获取失败，返回其他 ETF 的结果 + `partial_data: true` + 标注失败的 ticker。

---

## 6. 输入校验

| 端点 | 校验规则 |
|------|---------|
| POST `/api/strategies` | factors 权重总和 = 100%，每个权重 > 0 |
| POST `/api/backtest/run` | weights 长度 = etf_tickers 长度，总和 = 1.0，start_date < end_date |
| POST `/api/compare` | etf_tickers 至少 2 个，最多 10 个 |
| GET `/api/etfs` | limit ≤ 50，page ≥ 1 |

校验失败返回 400 + 具体字段错误。

---

## 7. 数据库设计

```sql
-- ETF 元数据
CREATE TABLE etfs (
  id            SERIAL PRIMARY KEY,
  ticker        VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(200),
  issuer        VARCHAR(100),
  category      VARCHAR(50),
  expense_ratio DECIMAL(5,4),          -- 修复：支持 0.0009 (0.09%)
  aum           BIGINT,
  inception     DATE,
  currency      VARCHAR(10) DEFAULT 'USD',
  region        VARCHAR(50),
  asset_class   VARCHAR(30),
  updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_etfs_updated_at ON etfs(updated_at);

-- 策略定义
CREATE TABLE strategies (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  type          VARCHAR(20) NOT NULL,  -- 'classic' | 'custom'
  factors       JSONB NOT NULL,        -- [{"name":"momentum","weight":0.5},...]
  params        JSONB NOT NULL,        -- {"lookback":"6m","max_holdings":10}
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 策略-ETF 评分（每个策略对每个 ETF 只有一条评分记录）
CREATE TABLE strategy_etf_scores (
  id            SERIAL PRIMARY KEY,
  strategy_id   INT NOT NULL REFERENCES strategies(id),
  etf_id        INT NOT NULL REFERENCES etfs(id),
  score         DECIMAL(5,2),
  factor_scores JSONB,                 -- {"momentum":92,"low_vol":88,...}
  scored_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(strategy_id, etf_id)
);
CREATE INDEX idx_scores_strategy ON strategy_etf_scores(strategy_id);
CREATE INDEX idx_scores_etf ON strategy_etf_scores(etf_id);

-- 回测结果
CREATE TABLE backtest_results (
  id            SERIAL PRIMARY KEY,
  strategy_id   INT REFERENCES strategies(id),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  annual_return DECIMAL(6,4),
  sharpe_ratio  DECIMAL(5,2),
  max_drawdown  DECIMAL(5,2),
  volatility    DECIMAL(5,2),
  daily_nav     JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_backtest_strategy ON backtest_results(strategy_id);

-- 回测-ETF 关联表（替代 INT[] 数组，支持外键约束）
CREATE TABLE backtest_etfs (
  id            SERIAL PRIMARY KEY,
  backtest_id   INT NOT NULL REFERENCES backtest_results(id) ON DELETE CASCADE,
  etf_id        INT NOT NULL REFERENCES etfs(id),
  weight        DECIMAL(5,4) NOT NULL
);
CREATE INDEX idx_backtest_etfs_bid ON backtest_etfs(backtest_id);
```

**Seed 数据** (`scripts/seed.sql`)：预置 20 只全球热门 ETF（SPY, QQQ, VTI, IWM, EFA, EEM, TLT, GLD, BND, VWO, VEA, VNQ, XLK, XLV, XLF, ARKK, LQD, HYG, SCHD, DIA），含基本信息供开发调试。

---

## 8. UI 结构

三个核心页面：

1. **策略页** — 经典策略 Tab / 自定义策略构建器，因子组合 + 参数调整 → 推荐 ETF
2. **对比页** — 多 ETF 并排对比表（收益率/夏普/波动率/回撤/费用率）+ 相关性热力图 + 权重配置
3. **回测页** — 收益曲线 + 关键指标卡片（年化收益/夏普比/最大回撤/波动率）+ 回撤区间图

全局 Tooltip 系统覆盖因子名称、策略参数、回测指标，悬停展示一句话解释。

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| yfinance 超时/429 | 指数退避重试 3 次（1s/3s/9s）→ 降级备用源 → 返回缓存 + `data_freshness: "stale"` |
| Python 计算异常 | 结构化错误 `{"error": "CODE", "detail": "...", "partial_data": false}` |
| 多 ETF 部分失败 | 返回可用数据 + `partial_data: true` + 失败列表 |
| API 层 | 统一错误码映射 400/404/500，前端 Toast 提示 |
| 输入校验失败 | 400 + 字段级错误信息 |
| 数据库断连 | Neon serverless driver 自动重连 |
| 回测超时 | Vercel Function 最大 300s，前端轮询或等待结果 |

---

## 10. 项目结构

```
investigation/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── middleware.ts              # X-API-Key 校验
│   ├── page.tsx                  # 首页 — 策略选择
│   ├── compare/page.tsx          # ETF 对比页
│   ├── backtest/page.tsx         # 回测报告页
│   └── api/
│       ├── strategies/
│       │   ├── route.ts          # GET (列表) / POST (创建)
│       │   ├── [id]/route.ts     # GET/PUT/DELETE
│       │   └── recommend/route.ts
│       ├── etfs/
│       │   ├── route.ts          # GET 搜索
│       │   └── [ticker]/route.ts # GET 详情
│       ├── backtest/
│       │   ├── route.ts          # POST 运行回测
│       │   └── [id]/route.ts     # GET 历史结果
│       ├── compare/route.ts
│       └── data/refresh/route.ts
│
├── functions/                    # Vercel Python Functions
│   ├── strategy-engine/
│   │   ├── index.py
│   │   ├── factors.py
│   │   └── ranking.py
│   ├── backtest-engine/
│   │   ├── index.py
│   │   ├── simulation.py
│   │   └── metrics.py
│   └── data-fetcher/
│       ├── index.py
│       ├── yfinance_client.py
│       └── fallback_sources.py
│
├── lib/                          # 共享库
│   ├── db.ts                     # Neon 连接
│   ├── types.ts
│   └── utils.ts
│
├── components/                   # React 组件
│   ├── StrategySelector.tsx
│   ├── EtfTable.tsx
│   ├── BacktestChart.tsx
│   ├── MetricCard.tsx
│   ├── Tooltip.tsx
│   └── CorrelationHeatmap.tsx
│
├── dictionaries/
│   └── zh.json                   # 中文术语解释
│
├── scripts/
│   └── seed.sql                  # Seed 数据（20 只热门 ETF）
│
├── package.json
├── requirements.txt
├── vercel.ts
├── next.config.js
└── tailwind.config.js
```

---

## 11. 本地开发

### 环境准备
```bash
# 1. Node.js (LTS 24 推荐)
node -v

# 2. Python 3.12（科学计算库兼容性更好）
python --version

# 3. 创建虚拟环境
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# 4. 安装依赖
npm install
pip install -r requirements.txt

# 5. 本地 PostgreSQL（或 Neon dev 分支）
# Docker: docker run --name pg-local -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
```

### 配置环境变量 (.env.local)
```
DATABASE_URL=postgresql://postgres:dev@localhost:5432/etf_invest
API_SECRET_KEY=dev-secret-key-change-in-prod
YFINANCE_CACHE_TTL=3600
```

### 启动开发
```bash
# 初始化数据库
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f scripts/seed.sql

# 前端开发服务器
npm run dev
# → http://localhost:3000

# 前端 + Python Functions 一起跑
vercel dev
# → http://localhost:3000
```

---

## 12. Vercel 部署

### 前置条件
- Vercel 账户 + CLI（`npm i -g vercel`）
- Neon Postgres 通过 Vercel Marketplace 安装
- GitHub 仓库连接

### 部署命令
```bash
# 首次
vercel           # 预览部署
vercel --prod    # 生产部署

# 环境变量
vercel env add DATABASE_URL
vercel env add API_SECRET_KEY
```

### vercel.ts 配置
```ts
import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  functions: {
    'functions/backtest-engine/index.py': {
      maxDuration: 300,
      memory: 1024,
    },
    'functions/strategy-engine/index.py': {
      maxDuration: 60,
    },
  },
  crons: [
    { path: '/api/data/refresh', schedule: '0 6 * * *' }
  ],
};
```

---

## 13. 策略因子体系

| 因子 | 含义 | 计算方式 |
|------|------|---------|
| 动量 (Momentum) | 过去N个月价格表现 | 最近N个月累计收益率排名 |
| 低波动 (Low Vol) | 价格波动小 | 标准差排名（越低越好） |
| 价值 (Value) | 估值便宜程度 | PE/PB 分位数排名 |
| 规模 (Size) | 基金体量 | 管理规模 AUM |
| 费用 (Expense) | 持有成本 | 费用率（越低越好） |
| 趋势强度 | 当前相对于均线位置 | 价格 / MA(200) 偏离度（不同于动量：动量看滚动收益，趋势看当前位置） |
| 流动性 (Liquidity) | 交易便利程度 | 日均成交量 |

用户可为每个因子分配权重（总和 100%），策略引擎按加权总分排名。

---

## 14. 设计审查记录

v2 更新（基于独立 review）：
- 添加 X-API-Key 认证中间件 + WAF 速率限制
- 修复 `expense_ratio` 精度 (5,2 → 5,4)
- `strategy_etf_scores` 添加 UNIQUE 约束和 `factor_scores` JSONB
- `backtest_etfs` 关联表替代 INT[] 数组
- 补全策略 CRUD 端点和历史回测查询
- 统一错误响应格式 + 部分失败处理
- 添加输入校验规范
- Python 3.13 → 3.12
- 添加 seed 数据和 venv 指令
- 移除 en.json，仅保留中文
- 保留趋势强度因子（与动量计算方式不同）和相关性热力图（对比页核心数据）
