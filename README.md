# SmartFactory MES Lite

智能制造生产管理与 AI 辅助决策系统。面向制造企业生产场景，覆盖生产订单、设备状态、物料库存、异常闭环和生产看板，并集成基于 Tool Calling 的 AI 助手。

> 面试介绍：这是一个轻量级 MES 与工业 AI Agent。Agent 会区分实时业务查询、业务写操作和设备知识问题，分别调用 MES Tools 或工业 RAG，并保留完整调用轨迹和操作审计。

![生产总览](docs/dashboard-final.png)

![工业 AI Agent](docs/ai-agent.png)

![模型与 API 配置](docs/ai-model-settings.png)

![系统登录](docs/login.png)

## 已实现功能

- 生产看板：今日产量、进行中订单、设备运行率、今日异常、7 日生产趋势、库存与异常预警
- 生产订单：订单查询、筛选、新增、修改、删除、分页、进度可视化和生产报工
- 生产报工：按订单录入当日计划/实际产量，事务更新生产记录、订单进度和首页看板
- 设备管理：运行、停机、故障、维护状态，产线、运行时间和真实利用率字段管理
- 库存管理：库存数量、安全库存、差额和缺料预警
- 异常管理：异常上报、级别、处理状态和解决闭环
- AI Agent：支持 8 个 Tool（6 个业务查询、1 个状态写入、1 个工业 RAG），界面展示工具类型、参数、结果和知识来源
- 可审计操作：自然语言可将指定设备更新为运行、停机、故障或维护状态，所有 Agent 调用记录成功/失败、操作者和时间
- 工业知识库：内置 CNC 维护、设备故障处理和安全维修 3 份演示文档，支持本地 BM25 风格检索与来源引用
- 通知中心：顶部铃铛聚合未处理异常、低库存和延期订单，支持直接跳转业务页面
- 模型配置中心：在 Agent 页面选择 DeepSeek 或自定义 OpenAI 兼容服务，可测试连接、保存密钥、切换模型或停用模型
- 双数据模式：默认内置 Demo 数据开箱即用，也可切换 Prisma + MySQL
- 安全基础：JWT 登录、CORS 白名单、Helmet 安全响应头、接口限流和 Zod 参数校验

## 技术架构

```mermaid
flowchart LR
  U[Vue 3 + Element Plus] -->|REST API| E[Express]
  E --> S[业务服务层]
  S --> D[(Prisma + MySQL)]
  E --> A[AI Agent 编排器]
  A <-->|Tool Calling| L[OpenAI 兼容模型]
  A -->|实时查询 / 写操作| T[7 个 MES Tools]
  A -->|设备知识问题| R[工业 RAG]
  T --> S
  R --> K[(Markdown 知识库)]
```

## 快速启动（无需 MySQL、无需 AI Key）

环境要求：Node.js 20.19 或更高版本。

```bash
npm install
npm run install:all
npm run dev
```

打开 <http://localhost:5173>。后端默认运行在 <http://localhost:3000>，使用 20 个订单、10 台设备、20 种物料的内置演示数据。演示模式的数据在后端重启后恢复初始状态。

演示账户：

```text
用户名：admin
密码：SmartFactory@2026
```

生产方式运行：

```bash
npm run build
npm start
```

打开 <http://localhost:3000>，Express 会同时托管构建后的前端。

## 免费在线部署

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fww085213%2Fsmartfactory-mes-agent)

仓库内置 `render.yaml`，使用 Render Free Web Service、Demo 数据和新加坡区域。首次创建 Blueprint 时需要在 Render 页面填写 `LLM_API_KEY`；不填写模型 Key 时，系统仍可使用本地 Agent 与工业 RAG。

线上默认启用 `PUBLIC_DEMO_MODE=true`：所有 CRUD、设备状态写入和模型配置修改均被服务端禁止，AI 接口限制为每个 IP 每 10 分钟 6 次。免费实例休眠或重启后，Demo 数据和审计记录会恢复初始状态。

## 切换 MySQL

1. 安装 MySQL 8，创建数据库 `smartfactory_mes`；如果本机有 Docker，也可执行 `docker compose up -d`。
2. 将 `backend/.env.example` 复制为 `backend/.env`。
3. 修改 `.env`：

```env
DEMO_MODE=false
DATABASE_URL="mysql://root:password@localhost:3306/smartfactory_mes"
ADMIN_USERNAME=your-admin-name
ADMIN_PASSWORD=your-strong-password
JWT_SECRET=replace-with-at-least-32-random-characters
CORS_ORIGINS=https://your-domain.example
```

4. 初始化表结构和 Mock 数据：

```bash
cd backend
npm run prisma:deploy
npm run prisma:seed
```

## 配置 AI 模型

不配置 Key 时，助手会明确显示“本地 Agent 模式”：由本地意图路由选择 MES Tool 或 RAG，仍会读写真实业务服务，但这不等同于大模型自主选择工具。接入任意支持 OpenAI Chat Completions Tool Calling 协议的服务后，模型会在多轮循环中自主选择工具、接收结构化结果并生成最终回答：

也可以直接进入“工业 AI Agent → 模型设置”，在界面完成服务选择、模型名称、Base URL 和 API Key 配置。完整密钥只写入后端 `.env`，配置接口仅返回掩码。

```env
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

也兼容原有的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 变量名。DeepSeek 配置示例：

```env
LLM_API_KEY=your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
```

模型请求设置了 20 秒超时，AI 接口限制为每分钟 20 次调用，避免异常请求长期占用连接或产生失控费用。

已经实现的工具：

| 工具 | 业务能力 |
| --- | --- |
| `getOrderProgress` | 按订单号查询总量、完成量和完成率 |
| `getDelayedOrders` | 查询已超过截止日期且尚未完成的订单 |
| `getProductionSummary` | 查询今日计划、实际产量和完成率 |
| `getEquipmentStatus` | 查询全部或指定设备状态 |
| `getEquipmentAlerts` | 查询设备异常、级别和处理状态 |
| `getLowStockMaterials` | 查询低于安全库存的物料 |
| `updateEquipmentStatus` | 按用户明确指令修改指定设备状态，并写入审计日志 |
| `searchIndustrialKnowledge` | 检索工业知识库并返回文档、章节和相关片段 |

RAG 文档位于 `backend/knowledge/`，当前内容是为项目演示编写的示例资料，不代替设备厂商正式手册或现场安全规程。

## 推荐演示脚本

1. 先打开生产总览，用 20 秒说明四个关键指标和趋势图。
2. 进入订单页面完成一次“生产报工”，再回到首页展示产量和订单进度同步变化。
3. 进入设备、库存和异常页面，演示筛选、分页和一次状态修改。
4. 打开 AI Agent，依次提问：
   - “目前有哪些延期订单？”——实时 MES 查询
   - “把设备 EQ-002 标记为维护”——写 Tool 与操作审计
   - “CNC 主轴过热应该怎么处理？”——工业 RAG 与来源引用
   - “ORD2026001 现在完成多少了？”——订单进度查询
5. 展开回答下方的 Tool 调用卡片，对比 QUERY、MUTATION、RAG 三类调用，再查看右侧最近操作审计。

## 质量检查

```bash
npm run check
```

该命令依次执行后端自动化测试、前端 ESLint、生产构建和前后端生产依赖审计。当前 15 项测试覆盖登录鉴权、分页、业务校验、生产报工闭环、通知聚合、配置脱敏、公开演示只读保护、延期订单、写 Tool、未授权写操作拦截、审计日志、工业 RAG、业务时区、CORS，以及 OpenAI 兼容接口“模型选工具 → 工具结果回传 → 最终回答”的完整协议闭环。

## 目录结构

```text
smartfactory-mes/
├── frontend/                 # Vue 3 前端
│   └── src/
│       ├── views/            # 六个业务页面
│       ├── components/       # 通用组件
│       ├── api/              # REST API 封装
│       ├── layout/           # 企业后台布局
│       └── router/           # 页面路由
├── backend/
│   ├── prisma/               # MySQL 模型、迁移和种子数据
│   ├── knowledge/            # 工业 RAG 演示知识文档
│   └── src/
│       ├── agent/            # Tool 定义、执行器、Agent 循环
│       ├── rag/              # 文档切分、检索与来源返回
│       ├── routes/           # REST API
│       ├── services/         # 业务逻辑与双数据模式
│       └── data/             # 开箱即用的 Demo 数据
└── docker-compose.yml        # 可选 MySQL 环境
```

## 核心设计亮点

- AI 工具层复用业务服务，而不是让模型直接访问数据库，权限边界清晰。
- Tool 结果以结构化 JSON 回传给模型，最终回答与原始业务数据可追踪。
- 写 Tool 同时受提示词和服务端授权校验保护：即使模型误调用，设备编号、目标状态或明确操作语义不匹配也会被拒绝；所有查询、写入和 RAG 调用统一写入 `agent_actions` 审计表。
- 实时状态问题走 MES Tool，设备处理方法走 RAG，避免把静态文档与实时生产数据混为一谈。
- Prisma schema 使用枚举、唯一约束、关联关系和级联规则约束数据一致性。
- 前端路由懒加载，数据请求统一封装，状态枚举统一映射为中文标签。
