# HubForge AI 解决方案技术架构与商业模式

> 版本: v1.0 | 日期: 2026-07-29
> 编制: 架构规划
> 基于: HubForge 多租户应用门户框架 + 9 大 AI 产品矩阵

---

## 一、整体定位

HubForge 作为 **AI 应用门户平台**，承载华检科 9 大 AI 解决方案，面向质量安全检测行业（交通工程、建筑工程、环境监测、水利水电），提供 SaaS 化的 AI 工具集。

**核心逻辑**: HubForge 是"壳"（用户/权限/多租户/入口），9 个 AI 产品是"核"（业务价值），两者通过 iframe + postMessage 协议松耦合集成。

---

## 二、技术架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户层 (User Layer)                      │
│  PC 浏览器  │  移动端 H5  │  企业微信/钉钉内嵌  │  大屏展示    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   门户层 (Portal Layer)                       │
│  HubForge 框架 — cdthf.cn                                    │
│  ┌─────────┬──────────┬──────────┬──────────┐               │
│  │ 官网    │ 登录认证 │ 应用导航 │ 管理后台 │               │
│  │ (公开)  │ (SSO)    │ (Dashboard)│(Admin) │               │
│  └─────────┴──────────┴──────────┴──────────┘               │
│  技术栈: Next.js 14 + Tailwind CSS + shadcn/ui              │
└──────────────────────┬──────────────────────────────────────┘
                       │ iframe + postMessage
┌──────────────────────┴──────────────────────────────────────┐
│                  AI 应用层 (AI Application Layer)             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ AI检测   │ │ AI智能   │ │ AI风险   │ │ AI合规   │       │
│  │ 报告助手 │ │ 巡检     │ │ 预警平台 │ │ 审查     │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ AI设备   │ │ 智能问数 │ │ 数字人   │ │ 桌面应急 │       │
│  │ 健康管理 │ │          │ │ 培训考核 │ │ 演练专家 │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐                                                │
│  │ 检测数据 │                                                │
│  │ 中台     │                                                │
│  └──────────┘                                                │
│                                                              │
│  每个应用独立部署/独立技术栈，通过 HubForge SDK 接入          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  AI 能力层 (AI Capability Layer)              │
│  ┌────────────┬────────────┬────────────┬────────────┐      │
│  │ LLM 服务   │ 视觉识别   │ 语音/NLP   │ 数据分析   │      │
│  │ GPT/Claude │ YOLO/SAM   │ Whisper    │ Pandas/SQL │      │
│  │ DeepSeek   │ 自研模型   │ RAG        │ ECharts    │      │
│  └────────────┴────────────┴────────────┴────────────┘      │
│  统一 AI 网关: 模型路由 · 用量计量 · 成本控制 · 缓存        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  数据层 (Data Layer)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │PostgreSQL│ │ Redis    │ │ OSS/MinIO│ │ 向量数据库│       │
│  │ 主数据库 │ │ 缓存/会话│ │ 文件存储 │ │ pgvector │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  基础设施层 (Infrastructure)                  │
│  Docker Compose → 阿里云 ECS                                │
│  Nginx 反向代理 · SSL · 域名路由                             │
│  水平扩展: Portal 多实例 + LB（已有集群部署方案）             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 9 大 AI 产品技术拆解

| # | 产品名称 | 核心 AI 能力 | 技术栈建议 | 数据源 | 部署方式 |
|---|---------|-------------|-----------|--------|---------|
| 1 | **AI 检测报告助手** | LLM 文本生成 + 模板填充 | Next.js + OpenAI API | 检测数据、标准库 | SaaS 共享 |
| 2 | **AI 智能巡检** | 图像识别 + 缺陷检测 | Python + YOLO/移动端 | 巡检图片、设备数据 | SaaS + 边缘 |
| 3 | **AI 风险预警平台** | 时序预测 + 异常检测 | Next.js + Prophet/ARIMA | 监测传感器数据 | SaaS 共享 |
| 4 | **AI 合规审查** | RAG + 规则引擎 | Next.js + LangChain | 法规标准库 | SaaS 共享 |
| 5 | **AI 设备健康管理** | 预测性维护 + 时序分析 | Python + LSTM/RF | 设备运行数据 | SaaS 共享 |
| 6 | **智能问数** | Text-to-SQL + 数据可视化 | Next.js + GPT-4 + ECharts | 业务数据库 | SaaS 共享 |
| 7 | **数字人培训考核** | 对话 AI + 评分模型 | Next.js + TTS/STT | 培训题库、场景库 | SaaS 共享 |
| 8 | **桌面应急演练专家** | 场景生成 + 推演引擎 | Next.js + LLM | 应急预案库 | SaaS 共享 |
| 9 | **检测数据中台** | ETL + 数据治理 | Next.js + Python ETL | 多源数据汇聚 | 租户独立 |

### 2.3 应用集成架构（已有能力）

HubForge 已实现的应用集成机制：

```
HubForge Portal (cdthf.cn)
  │
  ├── /app/[slug] → iframe 加载子应用
  │     │
  │     ├── postMessage 通信协议
  │     │   ├── hubforge:ready      → 应用就绪
  │     │   ├── hubforge:auth       → 获取认证 Token
  │     │   ├── hubforge:request-auth → 请求认证
  │     │   ├── hubforge:navigate   → 页面导航
  │     │   ├── hubforge:close      → 关闭应用
  │     │   └── hubforge:resize     → 调整尺寸
  │     │
  │     ├── Token 机制 (1h 有效)
  │     │   GET /api/apps/[id]/token → 签发
  │     │   POST /api/apps/verify-token → 验证
  │     │
  │     └── 安全沙箱 (sandbox="allow-scripts allow-forms")
  │
  ├── 权限控制
  │   ├── 框架权限: app.<slug>.access (租户级别)
  │   ├── 应用权限: 自定义 (用户级别)
  │   └── 两层校验: 租户授权 + 用户授权
  │
  └── 多租户隔离
      ├── 数据库级: tenantId 字段 + RLS
      └── 应用级: 租户独立配置/数据
```

### 2.4 AI 能力层架构（新增）

```
┌──────────────────────────────────────────────┐
│            AI Gateway（统一 AI 网关）          │
│                                               │
│  功能:                                        │
│  ├── 模型路由: 按任务类型选择最优模型          │
│  │   ├── 文本生成 → DeepSeek/GPT-4o-mini     │
│  │   ├── 图像识别 → YOLO/SAM (自部署)        │
│  │   ├── 数据分析 → GPT-4o + Code Interpreter │
│  │   └── 向量检索 → pgvector + Embedding     │
│  │                                            │
│  ├── 用量计量: 按租户/应用统计 API 调用量      │
│  │   └── 计费基础: Token 数 / 次数 / 存储     │
│  │                                            │
│  ├── 成本控制:                                │
│  │   ├── 每租户每日 Token 上限                │
│  │   ├── 模型降级策略 (GPT-4o → DeepSeek)    │
│  │   └── 结果缓存 (相似查询复用)              │
│  │                                            │
│  └── 安全审计:                                │
│      ├── Prompt 注入检测                      │
│      ├── 输出内容过滤                         │
│      └── 完整请求日志                         │
│                                               │
│  部署: 独立微服务 /api/ai/*                   │
│  技术: Next.js API Route + BullMQ 异步队列    │
└──────────────────────────────────────────────┘
```

### 2.5 数据库扩展方案

在现有 Prisma Schema 基础上，需新增 AI 业务相关模型：

```prisma
// ============================================================
// AI 应用业务扩展
// ============================================================

/// AI 用量记录 - 计费基础
model AIUsageRecord {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String
  appId       String
  model       String   // gpt-4o / deepseek / yolo
  inputTokens Int      @default(0)
  outputTokens Int     @default(0)
  requestType String   // text_gen / image_recog / text2sql / rag
  costYuan    Decimal  @default(0) @db.Decimal(10, 4)
  createdAt   DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@index([tenantId, createdAt])
  @@index([appId, createdAt])
  @@map("ai_usage_records")
}

/// AI 会话记录 - 用于智能问数/数字人等对话类应用
model AIConversation {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String
  appId       String
  title       String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages AIMessage[]
  @@index([tenantId, userId])
  @@map("ai_conversations")
}

/// AI 消息
model AIMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user / assistant / system
  content        String   @db.Text
  metadata       Json?    // token usage, model, latency
  createdAt      DateTime @default(now())

  conversation AIConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId])
  @@map("ai_messages")
}

/// AI 模板 - 报告模板、演练场景等
model AITemplate {
  id          String   @id @default(cuid())
  tenantId    String?
  appId       String
  name        String
  type        String   // report / drill / training
  content     Json     // 模板结构化内容
  isPublic    Boolean  @default(false)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([appId, type])
  @@map("ai_templates")
}

/// 订阅计划
model Subscription {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  plan          String   // free / basic / pro / enterprise
  startDate     DateTime
  endDate       DateTime?
  monthlyTokenLimit Int  @default(100000)
  monthlyRequestLimit Int @default(1000)
  storageLimitGB Int     @default(5)
  status        String   @default("active") // active / expired / cancelled
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@map("subscriptions")
}
```

### 2.6 部署架构演进

```
Phase 1 (当前): 单机部署
  ECS (2C4G) → Docker Compose
  ├── PostgreSQL
  ├── HubForge Portal
  └── Nginx + SSL

Phase 2 (AI 应用上线): 分离部署
  ECS-1 (4C8G) → Portal 集群
  ├── HubForge Portal × 2-3
  ├── Redis
  └── Nginx LB

  ECS-2 (4C8G/8C16G) → AI 服务
  ├── AI Gateway
  ├── 异步任务队列 (BullMQ)
  ├── 模型推理 (YOLO/Embedding)
  └── PostgreSQL (读副本)

  OSS → 文件存储 (报告/PDF/图片)

Phase 3 (规模化): 弹性架构
  ├── 容器编排 (Docker Swarm / K8s)
  ├── 数据库集群 (主从 + 读写分离)
  ├── CDN 加速 (静态资源)
  └── 独立 GPU 实例 (图像识别)
```

---

## 三、商业模式

### 3.1 价值主张

| 客户画像 | 核心痛点 | HubForge 解决方案 | 付费意愿 |
|---------|---------|-----------------|---------|
| 检测机构 | 报告编写耗时 2-3 天 | AI 检测报告助手 → 30 分钟出报告 | ★★★★★ |
| 施工单位 | 巡检效率低、漏检多 | AI 智能巡检 → 图像识别缺陷 | ★★★★ |
| 安全管理部门 | 风险发现滞后 | AI 风险预警 → 趋势预测 | ★★★★ |
| 质量监管部门 | 合规审查工作量大 | AI 合规审查 → 自动检查 | ★★★ |
| 设备管理方 | 设备故障不可预测 | AI 设备健康管理 → 预测维护 | ★★★ |
| 管理层 | 数据分散、决策靠经验 | 智能问数 + 检测数据中台 | ★★★★ |
| 培训部门 | 培训效果难量化 | 数字人培训考核 → AI 陪练 | ★★★ |
| 应急管理部门 | 演练流于形式 | 桌面应急演练专家 → 沉浸推演 | ★★★ |

### 3.2 收入模型

#### 主模式: **SaaS 订阅制**（按租户按月/年）

| 计划 | 月费 | 年费 | 包含内容 | 目标客户 |
|------|------|------|---------|---------|
| **免费版** | ¥0 | ¥0 | 基础门户 + 1 个 AI 应用 + 10 用户 + 1 万 Token/月 | 体验/小微客户 |
| **基础版** | ¥1,980 | ¥19,800 | 3 个 AI 应用 + 50 用户 + 50 万 Token/月 + 10GB 存储 | 中小检测机构 |
| **专业版** | ¥5,980 | ¥59,800 | 全部 AI 应用 + 200 用户 + 200 万 Token/月 + 50GB 存储 | 中型检测企业 |
| **企业版** | 按需报价 | 按需报价 | 无限应用 + 无限用户 + 定制开发 + 专属部署 | 大型企业/集团 |

#### 辅助收入

| 收入来源 | 定价方式 | 说明 |
|---------|---------|------|
| **Token 超量包** | ¥0.05/千 Token | 超出订阅额度后按量计费 |
| **应用单独购买** | ¥500-2,000/月/应用 | 非订阅内的单个 AI 应用 |
| **定制开发** | ¥5,000-50,000/项目 | 行业定制、私有化部署 |
| **数据迁移/实施** | ¥3,000-10,000/次 | 历史数据导入、系统对接 |
| **培训服务** | ¥2,000/天 | 现场培训、远程指导 |

### 3.3 定价策略

#### AI 应用单独定价参考

| AI 产品 | 建议零售价 (月) | 成本构成 | 毛利率 |
|---------|---------------|---------|--------|
| AI 检测报告助手 | ¥800 | LLM Token ≈ ¥100 | 87% |
| AI 智能巡检 | ¥1,200 | 图像识别 ≈ ¥200 | 83% |
| AI 风险预警平台 | ¥1,500 | 数据处理 ≈ ¥150 | 90% |
| AI 合规审查 | ¥800 | RAG + LLM ≈ ¥120 | 85% |
| AI 设备健康管理 | ¥1,000 | 时序分析 ≈ ¥100 | 90% |
| 智能问数 | ¥600 | LLM Token ≈ ¥80 | 87% |
| 数字人培训考核 | ¥1,000 | TTS/LLM ≈ ¥200 | 80% |
| 桌面应急演练专家 | ¥800 | LLM Token ≈ ¥150 | 81% |
| 检测数据中台 | ¥1,500 | 存储+计算 ≈ ¥300 | 80% |

> 以上为单租户估算，基于 DeepSeek 等低成本模型。使用 GPT-4o 成本约为 3-5 倍。

### 3.4 GTM 策略 (Go-To-Market)

#### Phase 1: 种子客户 (Month 1-3)
- **目标**: 5-10 个免费/低价种子客户
- **策略**: 
  - 从华检科现有客户中选择 5 家检测机构免费试用
  - 聚焦 **AI 检测报告助手** 单点突破（最高频、最刚需）
  - 收集反馈，打磨产品
- **指标**: NPS ≥ 40, 周活跃率 ≥ 60%

#### Phase 2: 标杆客户 (Month 4-6)
- **目标**: 3-5 个付费客户
- **策略**:
  - 种子客户转付费（提供年付 5 折优惠）
  - 输出客户案例（XX 检测机构用 AI 报告助手效率提升 80%）
  - 参加行业展会（交通/建筑安全类）
- **指标**: MRR ≥ ¥15,000, 客户续费率 ≥ 80%

#### Phase 3: 规模增长 (Month 7-12)
- **目标**: 50+ 付费客户
- **策略**:
  - SEO: "AI 检测报告" "智能巡检" 等关键词
  - 行业 KOL 合作（检测行业公众号/论坛）
  - 渠道代理（检测设备供应商捆绑销售）
  - 行业解决方案白皮书
- **指标**: ARR ≥ ¥500,000, 月新增 ≥ 10 客户

### 3.5 单位经济模型

```
假设: 100 个付费客户（基础版为主）

收入侧:
  ├── 基础版客户 70 × ¥19,800/年 = ¥1,386,000
  ├── 专业版客户 20 × ¥59,800/年 = ¥1,196,000
  ├── 企业版客户 5 × ¥120,000/年 = ¥600,000
  ├── Token 超量收入 ≈ ¥200,000
  └── 实施/定制收入 ≈ ¥300,000
  年总收入 ≈ ¥3,682,000

成本侧:
  ├── 云服务器 (ECS + DB + OSS) ≈ ¥60,000/年
  ├── AI API 调用 (DeepSeek/自部署) ≈ ¥120,000/年
  ├── SSL/域名/CDN ≈ ¥5,000/年
  ├── 运维人力 (0.5 人) ≈ ¥120,000/年
  └── 合计 ≈ ¥305,000/年

毛利润 ≈ ¥3,377,000 → 毛利率 ≈ 91.7%

注: 不含研发人力成本（前期由团队承担）
```

---

## 四、产品上线路径

### 4.1 9 个 AI 产品的上线优先级

| 优先级 | 产品 | 理由 | MVP 工作量 | 上线时间 |
|--------|------|------|-----------|---------|
| **P0** | AI 检测报告助手 | 最高频、最刚需、LLM 成熟 | 2 周 | 第 1 月 |
| **P0** | 智能问数 | 通用性强、展示效果好 | 2 周 | 第 1 月 |
| **P1** | AI 合规审查 | 有标准库可复用 | 3 周 | 第 2 月 |
| **P1** | 数字人培训考核 | 差异化强、壁垒高 | 4 周 | 第 2 月 |
| **P2** | AI 智能巡检 | 需移动端配合 | 4 周 | 第 3 月 |
| **P2** | AI 风险预警平台 | 需要数据积累 | 3 周 | 第 3 月 |
| **P3** | AI 设备健康管理 | 需要设备数据接入 | 4 周 | 第 4 月 |
| **P3** | 桌面应急演练专家 | 场景复杂度高 | 4 周 | 第 4 月 |
| **P3** | 检测数据中台 | 基础设施类，需长期建设 | 6 周 | 第 5-6 月 |

### 4.2 各产品 MVP 规格

#### P0-1: AI 检测报告助手
```
输入: 检测数据 (Excel/表单) + 报告模板
处理: LLM 自动填充 + 格式化 + 校验
输出: Word/PDF 检测报告
HubForge 集成: iframe 嵌入, 通过 Token 获取用户+租户上下文
技术: Next.js + OpenAI/DeepSeek API + docxtemplater
数据: 标准库 (GB/T 33000 等) 作为 RAG 知识库
```

#### P0-2: 智能问数
```
输入: 自然语言问题 ("上个月桥检合格率多少?")
处理: Text-to-SQL → 执行 → 结果可视化
输出: 数据表格 + 图表 + 文字摘要
HubForge 集成: iframe 嵌入, 通过租户数据源配置连接业务 DB
技术: Next.js + GPT-4o (Text-to-SQL) + ECharts + pgvector (语义缓存)
数据: 租户业务数据库 (只读连接)
```

### 4.3 技术实施步骤

```
Step 1: AI Gateway 搭建 (1 周)
  ├── /api/ai/chat — 统一对话接口
  ├── /api/ai/generate — 文本生成接口
  ├── /api/ai/analyze — 数据分析接口
  ├── 用量计量中间件
  └── 模型路由配置

Step 2: 数据库 Schema 迁移 (0.5 周)
  ├── 新增 AIUsageRecord / AIConversation / AIMessage
  ├── 新增 AITemplate / Subscription
  └── prisma migrate deploy

Step 3: P0 应用开发 (3 周)
  ├── AI 检测报告助手 (独立 Next.js 项目)
  ├── 智能问数 (独立 Next.js 项目)
  └── 两个项目均集成 HubForge SDK

Step 4: HubForge 管理增强 (1 周)
  ├── 订阅管理页面 (/admin/subscription)
  ├── AI 用量统计页面 (/admin/ai-usage)
  └── 应用配置增强 (AI 参数配置)

Step 5: 部署上线 (0.5 周)
  ├── AI 服务独立部署 (ECS-2)
  ├── Portal 升级 (Nginx 路由增加)
  └── 监控告警配置
```

---

## 五、竞争壁垒

| 壁垒维度 | 具体内容 | 可持续性 |
|---------|---------|---------|
| **行业数据积累** | 检测报告模板、标准库、行业知识图谱 | ★★★★★ (越用越多) |
| **多租户网络效应** | 客户越多 → 数据越丰富 → AI 越准 | ★★★★ |
| **HubForge 平台锁定** | 用户/权限/数据在平台上，迁移成本高 | ★★★★ |
| **行业 Know-How** | 质量安全检测行业理解 + 标准解读 | ★★★★★ |
| **产品矩阵协同** | 9 个应用共享用户，交叉销售 | ★★★ |

---

## 六、风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| LLM API 成本上升 | 中 | 中 | DeepSeek 为主 + 自部署小模型降级 |
| 客户数据安全顾虑 | 高 | 高 | 私有化部署选项 + 数据不出租户 + 等保认证 |
| AI 输出质量不稳定 | 中 | 高 | 人工审核兜底 + 模板约束 + 多轮校验 |
| 竞品低代码平台集成 AI | 高 | 中 | 聚焦行业深度，不做通用平台 |
| 客户 IT 能力不足 | 中 | 中 | 白手套实施 + 培训服务 + 预置模板 |
| 行业政策变化 | 低 | 中 | 跟踪标准更新 + 快速迭代合规库 |

---

## 七、关键里程碑

| 里程碑 | 时间 | 交付物 | 决策点 |
|--------|------|--------|--------|
| M1: AI Gateway 上线 | Week 2 | 统一 AI 接口 + 用量计量 | 技术验证通过 |
| M2: P0 产品 MVP | Week 5 | AI 报告助手 + 智能问数 | 内部演示 OK |
| M3: 种子客户试用 | Week 8 | 5 家客户免费试用 | NPS ≥ 40 |
| M4: 首个付费客户 | Week 12 | 签约 + 收款 | 商业模式验证 |
| M5: P1 产品上线 | Week 14 | 合规审查 + 数字人培训 | 产品矩阵初成 |
| M6: 50 客户达成 | Month 9 | ARR ≥ ¥50 万 | 规模化可行 |

---

## 八、总结

HubForge 的 AI 解决方案战略可以概括为:

1. **平台为体** — HubForge 多租户门户提供统一入口、用户、权限
2. **AI 为用** — 9 大 AI 产品解决质量安全行业具体痛点
3. **SaaS 为模式** — 按订阅收费，低门槛获客，高毛利运营
4. **行业为壁垒** — 深耕质量安全检测领域，数据和 Know-How 构建护城河
5. **渐进式落地** — P0 先行验证，逐步扩展产品矩阵

**核心公式**: HubForge 门户 × AI 能力 × 行业场景 = 可规模化变现的 SaaS 平台
