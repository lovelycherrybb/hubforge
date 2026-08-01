# HubForge — 项目上下文

## 项目简介
Vibecoding 统一应用门户框架。为传统企业业务人员的 vibecoding 应用提供统一入口、统一用户/权限管理、多租户隔离。

## 当前状态
🟡 构建阶段 — 核心框架已开发，安全修复进行中

## 技术栈
- 前端：Next.js 14 + React 18 + Tailwind CSS
- 后端：Next.js API Routes + Prisma ORM
- 数据库：PostgreSQL（RLS 行级安全隔离）
- 认证：jose（JWT）+ bcrypt
- 测试：Vitest
- 部署：Docker + Nginx（standalone/cluster/split 三种模式）

## 关键文件
- `01-验证/方案策划.md` — 方案策划文档（why/how/what）
- `02-设计/PRD.md` — 产品需求文档（注：部分内容滞后于代码实现，以代码为准）
- `03-开发/` — 源代码（Next.js 全栈项目）
- `03-开发/docs/dev-process.md` — 开发流程规范
- `03-开发/TODO.md` — 进行中的任务跟踪
- `deploy/` — 部署配置

## 开发流程
遵循《开发流程规范》（`03-开发/docs/dev-process.md`），核心要点：
- 任务分 S/M/L 三级，不同流程
- CEO 只参与 L 级节点和部署确认
- 新会话启动时先读 `03-开发/TODO.md` 获取上下文

## 环境约束
- 无邮箱系统：临时密码通过 API 返回，不发邮件
- PRD 滞后于代码：设计与实现不一致时以代码为准

## 历史决策
- 2026-07-23: 项目启动，方案策划完成，CEO 决策"做"
- 2026-07-23: PRD 评审通过，进入开发
- 2026-07-29: 代码安全审查，发现 RLS/JWT_SECRET/权限检查等问题，修复中
