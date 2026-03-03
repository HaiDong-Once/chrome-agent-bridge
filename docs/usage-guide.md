# Chrome-Agent Bridge 使用指引

## 简介

Chrome-Agent Bridge 是一个开发者工具，用于打通 Chrome 浏览器与 Agent IDE（如 Cursor、Kiro）之间的交互。它允许你在浏览器中选中任意网页元素，自动采集该元素的 HTML 结构、CSS 样式和截图信息，并通过 MCP 协议将这些结构化数据暴露给 Agent IDE，让 AI 助手直接利用真实的 UI 信息进行开发，消除手动复制粘贴的低效流程。

### 典型使用场景

- 在第三方网站上看到满意的 UI 组件，一键采集后让 Agent 帮你实现类似效果
- 采集竞品页面的布局和样式，作为开发参考
- 快速获取页面元素的完整 CSS 信息用于调试

### 项目架构

```
chrome-agent-bridge/
├── packages/
│   ├── shared/              # 共享 TypeScript 类型定义
│   ├── mcp-server/          # MCP Server（HTTP 接收 + MCP 协议暴露）
│   └── chrome-extension/    # Chrome 扩展（Manifest V3）
├── vitest.config.ts         # 测试配置
├── pnpm-workspace.yaml      # pnpm monorepo 配置
└── mcp.json                 # MCP Server 注册配置
```

系统由两个独立进程组成：

1. **Chrome 扩展** — 运行在浏览器中，负责元素选择、信息采集和数据发送
2. **MCP Server** — 运行在本地的 Node.js 进程，接收采集数据并通过 MCP 协议暴露给 Agent IDE

两者通过 HTTP 通信（localhost:19816），MCP Server 通过 stdio 与 Agent IDE 交互。

## 前置条件

- Node.js >= 18
- pnpm >= 8
- Chrome 或基于 Chromium 的浏览器（Edge、Brave 等）
- 支持 MCP 协议的 Agent IDE（Cursor、Kiro 等）

## 安装与构建

### 1. 克隆项目并安装依赖

```bash
git clone <repo-url>
cd chrome-agent-bridge
pnpm install
```

### 2. 构建所有包

```bash
pnpm build
```

构建产物：
- `packages/shared/dist/` — 共享类型定义编译输出
- `packages/mcp-server/dist/` — MCP Server 可执行文件
- `packages/chrome-extension/dist/` — Chrome 扩展文件（含 manifest.json、popup.html 等）

## 配置 MCP Server

MCP Server 由 Agent IDE 自动管理进程生命周期，无需手动启动或后台运行。你只需在 IDE 的 MCP 配置中注册即可。

> **不需要复制构建产物。** 构建产物保留在 chrome-agent-bridge 项目原位，其他项目通过绝对路径引用即可。只要构建过一次（`pnpm build`），任何项目都能直接使用。

### 配置方式一：项目级配置（仅当前项目可用）

在需要使用的项目中创建 MCP 配置文件，用绝对路径指向 chrome-agent-bridge 的构建产物：

**Kiro** — 在项目根目录创建 `.kiro/settings/mcp.json`：

```json
{
  "mcpServers": {
    "chrome-agent-bridge": {
      "command": "node",
      "args": ["/Users/你的用户名/path/to/chrome-agent-bridge/packages/mcp-server/dist/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Cursor** — 在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "chrome-agent-bridge": {
      "command": "node",
      "args": ["/Users/你的用户名/path/to/chrome-agent-bridge/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 配置方式二：用户级全局配置（所有项目可用，推荐）

如果你希望在所有项目中都能使用 Chrome-Agent Bridge，可以将配置写到用户级别的全局 MCP 配置文件中，这样就不用每个项目都配一遍：

**Kiro** — 编辑 `~/.kiro/settings/mcp.json`：

```json
{
  "mcpServers": {
    "chrome-agent-bridge": {
      "command": "node",
      "args": ["/Users/你的用户名/path/to/chrome-agent-bridge/packages/mcp-server/dist/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Cursor** — 编辑 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "chrome-agent-bridge": {
      "command": "node",
      "args": ["/Users/你的用户名/path/to/chrome-agent-bridge/packages/mcp-server/dist/index.js"]
    }
  }
}
```

> **注意**: `args` 中的路径必须是绝对路径，指向构建后的 `packages/mcp-server/dist/index.js` 文件。将示例中的 `/Users/你的用户名/path/to/chrome-agent-bridge` 替换为你本机的实际项目路径。

### 配置生效

配置保存后，IDE 会自动检测变更并启动 MCP Server。启动后会同时初始化两个服务：
- **MCP 协议接口**（stdio 模式）— 供 Agent IDE 调用工具查询采集数据
- **HTTP Server**（localhost:19816）— 供 Chrome 扩展发送采集数据

## 分发给其他人使用

如果你需要让团队成员或其他开发者使用 Chrome-Agent Bridge，有以下几种方式：

### MCP Server：发布到 npm（推荐）

将 MCP Server 发布到 npm 后，其他人无需克隆仓库、安装依赖或构建，直接通过 `npx` 即可使用：

```bash
# 构建并发布（需要 npm 账号和 @chrome-agent-bridge scope 的发布权限）
pnpm build
pnpm --filter @chrome-agent-bridge/shared publish --access public
pnpm --filter @chrome-agent-bridge/mcp-server publish --access public
```

发布后，其他人只需在 MCP 配置中写：

```json
{
  "mcpServers": {
    "chrome-agent-bridge": {
      "command": "npx",
      "args": ["-y", "@chrome-agent-bridge/mcp-server"]
    }
  }
}
```

不需要安装任何东西，`npx` 会自动下载并运行。

### MCP Server：源码方式

如果不方便发布到 npm，也可以让对方直接克隆仓库：

```bash
git clone <repo-url>
cd chrome-agent-bridge
pnpm install
pnpm build
```

然后在 MCP 配置中用绝对路径指向构建产物（参考上面的配置说明）。

### Chrome 扩展：开发者模式加载

目前 Chrome 扩展需要以开发者模式加载：

1. 将 `packages/chrome-extension/dist/` 目录打包为 zip 发给对方
2. 对方解压后，在 `chrome://extensions/` 中开启开发者模式并加载该目录

### Chrome 扩展：发布到 Chrome Web Store

如果需要更广泛的分发，可以将扩展发布到 Chrome Web Store，用户直接从商店安装，无需开发者模式。发布流程参考 [Chrome Web Store 开发者文档](https://developer.chrome.com/docs/webstore/publish)。

## 安装 Chrome 扩展（本地开发）

1. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
2. 开启右上角的「开发者模式」开关
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `packages/chrome-extension/dist/` 目录
5. 扩展图标将出现在浏览器工具栏中

> 如果使用 Edge 浏览器，访问 `edge://extensions/` 执行相同操作。

## 使用流程

### 第一步：确认 MCP Server 在线

点击浏览器工具栏中的 Chrome-Agent Bridge 扩展图标，弹出窗口会自动检测 MCP Server 连接状态：

- 🟢 绿色指示器 + "MCP Server 在线" — 服务就绪，可以开始使用
- ⚪ 灰色指示器 + "MCP Server 离线" — 请确认 IDE 已启动并正确加载了 MCP 配置

### 第二步：选择并采集元素

1. 在弹出窗口中点击「开始选择」按钮（按钮变为红色的「停止选择」）
2. 将鼠标移到目标网页上，悬停的元素会显示蓝色高亮边框
3. 点击目标元素，系统自动完成采集并发送

采集完成后，弹出窗口会显示操作结果：
- ✓ 发送成功 — 数据已存入 MCP Server，Agent 可以查询
- ✗ 发送失败 — 显示具体错误原因

每次采集的信息包括：

| 数据类型 | 说明 |
|----------|------|
| HTML 结构 | 元素及其子元素的完整 outerHTML |
| 计算样式 | 浏览器计算后的所有 CSS 属性值 |
| 匹配规则 | 命中的 CSS 规则（含选择器、媒体查询、来源） |
| 元素截图 | 元素区域的 PNG 截图（Base64 编码） |
| 元数据 | DOM 路径、class 列表、id、所有属性、标签名 |
| 页面信息 | 来源页面 URL 和标题 |

### 第三步：在 Agent IDE 中使用采集数据

数据发送成功后，你可以在 Agent IDE 的对话中直接引用采集的元素信息。Agent 会通过 MCP 工具自动查询数据。

**可用的 MCP 工具：**

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `get_selected_element` | `id?` (可选) | 获取最近一次或指定 ID 的元素完整信息 |
| `get_element_screenshot` | `id?` (可选) | 获取元素截图（Base64 PNG） |
| `get_element_styles` | `id?` (可选) | 获取元素 CSS 样式详情（计算样式 + 匹配规则） |
| `list_captured_elements` | 无 | 列出所有历史采集记录的摘要 |

**示例对话：**

```
你: 请参考我刚才在浏览器中选中的元素，帮我用 React + Tailwind 实现一个类似的卡片组件

Agent: (自动调用 get_selected_element 获取完整 HTML/CSS 信息)
       根据采集到的元素信息，这是一个带阴影的圆角卡片...
```

```
你: 帮我看看刚才选中的按钮用了哪些 CSS 样式

Agent: (自动调用 get_element_styles 获取样式详情)
       这个按钮的主要样式包括...
```

```
你: 列出我之前采集的所有元素

Agent: (自动调用 list_captured_elements)
       你一共采集了 3 个元素...
```

## 数据流说明

```
用户点击元素
    ↓
Content Script 采集 HTML/CSS/截图/元数据
    ↓ (Chrome Extension Message API)
Background Service Worker
    ↓ (HTTP POST localhost:19816/capture)
MCP Server → HTTP Server 接收并验证
    ↓
Data Store 内存缓存（最多 20 条）
    ↓ (MCP 协议 stdio)
Agent IDE 通过 MCP 工具查询
```

## 开发指南

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式（开发时使用）
pnpm test:watch
```

项目包含单元测试和属性测试（基于 fast-check），覆盖数据存储、HTTP 接口、MCP 工具、序列化一致性等核心逻辑。

### 单独构建某个包

```bash
# 仅构建 shared 包
pnpm --filter @chrome-agent-bridge/shared build

# 仅构建 MCP Server
pnpm --filter @chrome-agent-bridge/mcp-server build

# 仅构建 Chrome 扩展
pnpm --filter @chrome-agent-bridge/chrome-extension build
```

### 本地调试 MCP Server

如果需要脱离 IDE 单独运行 MCP Server 进行调试：

```bash
node packages/mcp-server/dist/index.js
```

此时 HTTP Server 会在 `localhost:19816` 上监听，你可以手动测试接口：

```bash
# 健康检查
curl http://localhost:19816/ping

# 发送测试数据
curl -X POST http://localhost:19816/capture \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test","element":{"tagName":"div","html":"<div>test</div>","text":"test","classes":[],"id":null,"attributes":{},"domPath":"body > div"},"styles":{"computed":{},"matched":[]},"screenshot":null}'
```

## 常见问题

**Q: 弹出窗口显示 "MCP Server 离线"？**

确认 Agent IDE 已启动且 MCP 配置正确。MCP Server 由 IDE 自动管理生命周期，不需要手动启动。检查 IDE 的 MCP 面板确认 chrome-agent-bridge 服务状态。

**Q: 端口 19816 被占用？**

MCP Server 启动时会检测端口冲突并输出错误提示。找到并关闭占用该端口的进程后重启 IDE 即可：

```bash
# macOS/Linux 查找占用端口的进程
lsof -i :19816

# 终止进程
kill <PID>
```

**Q: 元素截图为空？**

部分受限页面（如 `chrome://` 开头的系统页面）不支持截图 API。截图失败时，其他信息（HTML、CSS、元数据）仍会正常采集和发送，不影响使用。

**Q: 数据会持久化保存吗？**

不会。所有采集数据仅存储在 MCP Server 进程的内存中，进程退出后自动清空。内存缓存最多保留最近 20 条记录，超出后自动淘汰最早的记录。

**Q: 支持哪些浏览器？**

支持所有基于 Chromium 的浏览器，包括 Chrome、Edge、Brave 等。扩展基于 Manifest V3 规范，要求 Chrome 116 或更高版本。

**Q: 扩展需要哪些权限？**

扩展遵循最小权限原则，仅申请两个权限：
- `activeTab` — 访问当前活动标签页
- `scripting` — 向目标页面注入 Content Script

**Q: 如何更新扩展？**

代码修改后重新执行 `pnpm build`，然后在 `chrome://extensions/` 页面点击扩展卡片上的刷新按钮即可。
