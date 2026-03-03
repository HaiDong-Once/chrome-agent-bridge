# Chrome-Agent Bridge 需求文档

## 意图分析

- **用户需求**: 开发一个工具，打通 Chrome 浏览器与 Agent IDE 工具（Cursor/Kiro）之间的交互，消除手动复制粘贴的低效流程
- **请求类型**: 新项目（New Project）
- **范围**: 跨系统（Chrome 浏览器 ↔ Agent IDE）
- **复杂度**: 中等（Chrome 扩展 + MCP Server + HTTP 通信）

---

## 1. 项目概述

### 1.1 问题背景

开发者在使用 AI Agent 工具（如 Cursor）时，与浏览器之间的交互存在明显断层：

- **场景 A（本地调试）**: 发现浏览器中的样式问题 → 需手动打开 DevTools → 复制 class/文本 → 切到 IDE 搜索 → 找到文件 → 告诉 Agent 修改。流程繁琐，上下文频繁切换。
- **场景 B（样式参考）**: 看到第三方网站满意的 UI → 需手动复制 HTML/CSS → 粘贴到 Agent 聊天窗 → 描述需求。信息丢失，操作低效。

### 1.2 解决方案概述

开发 Chrome-Agent Bridge 工具，由两部分组成：
1. **Chrome 扩展** — 在浏览器中采集选中元素的完整信息（HTML、CSS、截图）
2. **MCP Server** — 本地 Node.js 进程，同时提供 HTTP 接口（接收 Chrome 扩展数据）和 MCP 协议接口（暴露工具给 Cursor）

---

## 2. 功能需求

### 2.1 MVP（第一阶段）— 第三方网站样式抓取

#### FR-1: 元素选择与采集
- FR-1.1: Chrome 扩展提供元素选择器模式，用户激活后可在任意网页上选中元素
- FR-1.2: 选中元素后自动采集以下信息：
  - 元素及其子元素的完整 HTML 结构
  - 计算后的 CSS 样式（computed styles）
  - 相关 CSS 规则（包括媒体查询、伪类等）
  - 选中区域的截图（PNG/Base64）
  - 元素的 DOM 路径、class、id、data 属性
- FR-1.3: 选中即自动发送，无需额外确认步骤

#### FR-2: 数据传输
- FR-2.1: Chrome 扩展通过 HTTP POST 将采集的元素信息发送到本地 MCP Server
- FR-2.2: MCP Server 在本地监听固定端口（如 localhost:19816），接收并缓存元素数据
- FR-2.3: 数据格式为结构化 JSON，包含 HTML、CSS、截图、元数据等字段

#### FR-3: MCP 工具暴露
- FR-3.1: MCP Server 通过 stdio 模式被 Cursor 管理（自动启动/停止）
- FR-3.2: 提供 `get_selected_element` 工具 — 获取最近一次选中的元素信息
- FR-3.3: 提供 `get_element_screenshot` 工具 — 获取选中元素的截图
- FR-3.4: 提供 `get_element_styles` 工具 — 获取选中元素的 CSS 样式详情
- FR-3.5: 提供 `list_captured_elements` 工具 — 列出历史采集记录

#### FR-4: Chrome 扩展 UI
- FR-4.1: 扩展图标点击后显示 popup，展示连接状态（MCP Server 是否在线）
- FR-4.2: 提供"开始选择"按钮，激活元素选择器模式
- FR-4.3: 选择器模式下，鼠标悬停元素时显示高亮边框
- FR-4.4: 点击元素后采集信息并自动发送，显示发送成功/失败提示

### 2.2 第二阶段 — 本地项目元素定位

#### FR-5: 本地项目元素采集
- FR-5.1: 与场景 B 相同的元素选择和采集能力
- FR-5.2: 额外采集 source map 信息（如果可用）
- FR-5.3: 采集 data-* 属性、React/Vue 组件标识等框架特有信息

#### FR-6: Agent 自主定位
- FR-6.1: 将丰富的元素信息传递给 Agent，由 Agent 模型利用代码搜索能力自主定位源文件
- FR-6.2: 工具侧不做源码定位逻辑，保持轻量

---

## 3. 非功能需求

### NFR-1: 易用性
- 用户安装步骤不超过 2 步：安装 Chrome 扩展 + 配置 Cursor mcp.json
- MCP Server 由 Cursor 自动管理生命周期，用户无需手动启动服务
- 元素选择到 Agent 可用的端到端延迟 < 2 秒

### NFR-2: 兼容性
- Chrome 扩展支持 Chrome 及基于 Chromium 的浏览器（Edge、Brave 等）
- MCP Server 优先支持 Cursor，架构上预留扩展到 Kiro 等其他 MCP 客户端的能力
- 支持 macOS、Windows、Linux

### NFR-3: 安全性
- HTTP Server 仅监听 localhost，不暴露到网络
- 采集的数据仅存储在内存中，不持久化到磁盘（除非用户主动保存）
- Chrome 扩展权限最小化，仅申请必要的 activeTab、scripting 权限

### NFR-4: 性能
- 元素采集（含截图）耗时 < 500ms
- MCP Server 内存占用 < 50MB
- 支持缓存最近 20 条采集记录

### NFR-5: 可维护性
- TypeScript 全栈，统一类型定义
- Chrome 扩展和 MCP Server 共享数据类型（monorepo 结构）
- 代码结构清晰，便于后续扩展新的 Agent 工具支持

---

## 4. 技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 通信机制 | HTTP Server + MCP Server 混合 | Chrome 扩展可直接 fetch，Cursor 自动管理进程 |
| 源码定位 | Agent 模型自主定位 | 工具保持轻量，利用 Agent 的代码搜索能力 |
| 技术栈 | TypeScript 全栈 | 类型安全，Chrome 扩展和 Server 共享类型 |
| 目标 Agent | 先 Cursor，后扩展 | 降低 MVP 复杂度 |
| MVP 范围 | 先场景2（第三方样式抓取） | 相对简单，快速验证核心流程 |
| 交互方式 | 自动发送（选中即发送） | 最少操作步骤，最流畅体验 |
| 抓取深度 | 截图 + HTML + CSS 全量 | 给 Agent 最丰富的上下文信息 |

---

## 5. 约束与假设

### 约束
- Chrome 扩展 Manifest V3 规范限制
- MCP 协议当前版本的能力边界
- Cursor 的 MCP Server 管理方式（stdio 模式）

### 假设
- 用户已安装 Node.js 运行环境
- 用户使用 Cursor 作为主要开发工具
- 目标网页允许 content script 注入（非 chrome:// 等受限页面）
