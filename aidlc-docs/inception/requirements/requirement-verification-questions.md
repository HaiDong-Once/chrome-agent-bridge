# 需求澄清问题

请在每个问题的 `[Answer]:` 后面填写你的回答。

---

## Q1: 目标 Agent 工具优先级

你提到了 Kiro 和 Cursor，我们需要确定优先支持哪个：

A) 仅 Kiro（通过 MCP Server 协议接入）
B) 仅 Cursor（通过 MCP Server 协议接入）
C) 同时支持 Kiro 和 Cursor（两者都支持 MCP 协议）
D) 先支持一个，后续扩展另一个
X) 其他（请描述）

[Answer]: D — 先支持 Cursor，后续再扩展其他

---

## Q2: 通信机制偏好

Chrome 扩展和 Agent 工具之间的通信方式：

A) MCP Server 方案 — Chrome 扩展将数据写入本地，Agent 通过 MCP Server 读取（最简单，Kiro/Cursor 原生支持）
B) WebSocket 方案 — Chrome 扩展和本地服务通过 WebSocket 实时通信
C) 本地 HTTP Server 方案 — Chrome 扩展调用本地 HTTP API
D) 剪贴板 + 文件监听方案 — 最简单但功能有限
X) 其他（请描述）

[Answer]: C — 本地 HTTP Server 方案，同时作为 MCP Server（Cursor 自动管理进程生命周期，Chrome 扩展通过 HTTP POST 发送数据）

---

## Q3: 源代码定位能力

对于场景1（本地开发调试），你期望如何实现"自动定位到源代码"？

A) 依赖 Source Map — 通过浏览器 DevTools 协议获取 source map 映射回源文件
B) 依赖 data 属性注入 — 构建时注入 data-source-file 等属性到 DOM 元素
C) 依赖文本/类名搜索 — 通过元素的 class、文本内容在项目中搜索定位
D) 组合方案 — 优先 source map，降级到搜索
X) 其他（请描述）

[Answer]: X — 不在工具侧做源码定位，直接将选中元素的丰富信息（class、id、文本、data属性、DOM路径、计算样式等）结构化传递给 Agent，由 Agent 模型利用自身代码搜索能力自主定位源代码。工具只负责采集+传输。

---

## Q4: 用户交互方式

在浏览器中选中元素后，你期望的交互流程是：

A) 右键菜单 — 选中元素后右键选择"发送到 Agent"
B) 快捷键 — 选中元素后按快捷键直接发送
C) 浮动面板 — 选中元素后弹出小面板，可以输入提示词后发送
D) 自动发送 — 使用 DevTools 的元素选择器，选中即发送
X) 其他（请描述）

[Answer]: D — 自动发送，使用 DevTools 的元素选择器，选中即发送

---

## Q5: 第三方网站抓取深度

对于场景2（第三方网站样式参考），你需要抓取哪些信息？

A) 仅选中元素的 HTML + 计算后的 CSS 样式
B) 选中元素及其子元素的完整 HTML + CSS
C) 选中元素 + 父级上下文 + 相关 CSS 规则（包括媒体查询等）
D) 完整组件区域截图 + HTML + CSS
X) 其他（请描述）

[Answer]: D — 完整组件区域截图 + HTML + CSS

---

## Q6: 技术栈偏好

你对这个工具的技术栈有偏好吗？

A) TypeScript 全栈（Chrome 扩展 + Node.js MCP Server）
B) JavaScript 全栈
C) 无偏好，由方案决定
X) 其他（请描述）

[Answer]: A — TypeScript 全栈（Chrome 扩展 + Node.js MCP Server）

---

## Q7: MVP 范围

你希望第一个版本（MVP）包含哪些功能？

A) 仅场景1 — 本地项目元素选中 → 源代码定位 → Agent 修改
B) 仅场景2 — 第三方网站元素/样式抓取 → 发送给 Agent
C) 两个场景都包含，但功能精简
D) 先做场景2（相对简单），再扩展场景1
X) 其他（请描述）

[Answer]: D — 先做场景2（第三方网站元素/样式抓取 → 发送给 Agent），再扩展场景1

---
