# Chrome-Agent Bridge — 开发任务计划

## 项目结构

```
chrome-agent-bridge/
├── packages/
│   ├── shared/                  # 共享类型定义
│   │   ├── src/
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp-server/              # MCP Server + HTTP Server
│   │   ├── src/
│   │   │   ├── index.ts         # 入口：启动 MCP + HTTP
│   │   │   ├── http-server.ts   # HTTP Server
│   │   │   ├── data-store.ts    # 内存数据缓存
│   │   │   └── mcp-tools.ts     # MCP 工具定义
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── chrome-extension/        # Chrome 扩展
│       ├── src/
│       │   ├── background.ts    # Service Worker
│       │   ├── content.ts       # Content Script
│       │   ├── popup/
│       │   │   ├── popup.html
│       │   │   ├── popup.css
│       │   │   └── popup.ts
│       │   └── utils/
│       │       ├── element-capture.ts   # 元素采集逻辑
│       │       ├── screenshot.ts        # 截图逻辑
│       │       └── style-extractor.ts   # CSS 样式提取
│       ├── manifest.json
│       ├── package.json
│       └── tsconfig.json
├── package.json                 # monorepo root
├── tsconfig.base.json
└── README.md
```

---

## 任务列表

### Phase 1: 项目基础设施

- [ ] **Task 1: Monorepo 初始化**
  - [ ] 1.1 创建根目录 package.json（workspaces 配置）
  - [ ] 1.2 创建 tsconfig.base.json（共享 TS 配置）
  - [ ] 1.3 配置构建脚本

- [ ] **Task 2: Shared 类型包**
  - [ ] 2.1 创建 packages/shared/package.json
  - [ ] 2.2 创建 packages/shared/tsconfig.json
  - [ ] 2.3 实现 packages/shared/src/types.ts（CapturedElementData、CSSRuleInfo、CapturedElementSummary、消息类型等）

### Phase 2: MCP Server

- [ ] **Task 3: Data Store 实现**
  - [ ] 3.1 实现 packages/mcp-server/src/data-store.ts
    - store() — 存储数据，生成唯一 ID，LRU 淘汰（最多 20 条）
    - getLatest() — 获取最新记录
    - getById() — 按 ID 查询
    - list() — 列出摘要
    - clear() — 清空
  - [ ] 3.2 编写 Data Store 单元测试

- [ ] **Task 4: HTTP Server 实现**
  - [ ] 4.1 实现 packages/mcp-server/src/http-server.ts
    - POST /capture — 接收元素数据，验证格式，存入 DataStore
    - GET /ping — 健康检查
    - CORS 头处理（允许 Chrome 扩展跨域请求）
  - [ ] 4.2 编写 HTTP Server 单元测试

- [ ] **Task 5: MCP Tools 实现**
  - [ ] 5.1 实现 packages/mcp-server/src/mcp-tools.ts
    - get_selected_element — 获取最近/指定 ID 的元素信息
    - get_element_screenshot — 获取截图
    - get_element_styles — 获取 CSS 样式
    - list_captured_elements — 列出历史记录
  - [ ] 5.2 编写 MCP Tools 单元测试

- [ ] **Task 6: MCP Server 入口**
  - [ ] 6.1 实现 packages/mcp-server/src/index.ts
    - 初始化 DataStore 实例
    - 启动 HTTP Server（端口 19816）
    - 启动 MCP Server（stdio 模式）
    - 共享 DataStore 实例
  - [ ] 6.2 配置 package.json 的 bin 入口和构建脚本
  - [ ] 6.3 端到端测试：HTTP 接收 → DataStore → MCP 工具读取

### Phase 3: Chrome 扩展

- [ ] **Task 7: 扩展基础配置**
  - [ ] 7.1 创建 manifest.json（Manifest V3，权限：activeTab、scripting）
  - [ ] 7.2 配置 package.json 和 tsconfig.json
  - [ ] 7.3 配置构建工具（将 TS 编译为 Chrome 扩展可用的 JS）

- [ ] **Task 8: Content Script — 元素采集**
  - [ ] 8.1 实现 element-capture.ts
    - captureElement() — 采集 HTML、文本、属性、DOM 路径
    - getElementMetadata() — 提取 class、id、data 属性
  - [ ] 8.2 实现 style-extractor.ts
    - getComputedStyles() — 获取计算样式
    - getMatchedCSSRules() — 获取匹配的 CSS 规则（含媒体查询）
  - [ ] 8.3 实现 screenshot.ts
    - captureScreenshot() — 使用 html2canvas 或 Chrome API 截图
  - [ ] 8.4 实现 content.ts
    - activateSelector() / deactivateSelector() — 选择器模式管理
    - highlightElement() — 鼠标悬停高亮
    - 点击事件 → captureElement → 发送给 Background SW

- [ ] **Task 9: Background Service Worker**
  - [ ] 9.1 实现 background.ts
    - handleMessage() — 消息路由
    - sendToServer() — HTTP POST 到 MCP Server
    - injectContentScript() — 按需注入 Content Script
    - updateBadge() — 更新图标状态

- [ ] **Task 10: Popup UI**
  - [ ] 10.1 实现 popup.html + popup.css（简洁 UI：状态指示 + 开始选择按钮）
  - [ ] 10.2 实现 popup.ts
    - checkServerStatus() — ping MCP Server
    - toggleSelector() — 激活/停用选择器
    - renderStatus() — 更新 UI 状态

### Phase 4: 集成与文档

- [ ] **Task 11: 端到端集成测试**
  - [ ] 11.1 手动测试流程：Chrome 扩展选中元素 → HTTP 发送 → MCP Server 接收 → Cursor Agent 调用 MCP 工具获取数据
  - [ ] 11.2 验证截图功能正常
  - [ ] 11.3 验证 CSS 规则采集完整性

- [ ] **Task 12: 文档与配置**
  - [ ] 12.1 编写 README.md（安装说明、使用方法、Cursor mcp.json 配置示例）
  - [ ] 12.2 提供 Cursor mcp.json 配置模板
  - [ ] 12.3 Chrome 扩展加载说明（开发者模式加载）
