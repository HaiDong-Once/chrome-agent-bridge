# Chrome-Agent Bridge — 组件依赖关系

## 依赖矩阵

| 组件 | 依赖 | 通信方式 | 说明 |
|------|------|----------|------|
| Popup UI → Background SW | Background Service Worker | Chrome Extension Message API | 查询状态、发送控制指令 |
| Popup UI → HTTP Server | HTTP Server | HTTP GET /ping | 检查 Server 在线状态 |
| Content Script → Background SW | Background Service Worker | Chrome Extension Message API | 发送采集数据 |
| Background SW → HTTP Server | HTTP Server | HTTP POST /capture | 转发采集数据 |
| HTTP Server → Data Store | Data Store | 函数调用（同进程） | 存储采集数据 |
| MCP Tools → Data Store | Data Store | 函数调用（同进程） | 读取采集数据 |
| Cursor Agent → MCP Tools | MCP Tools | MCP Protocol (stdio) | 调用工具获取数据 |

## 依赖图

```
Chrome Extension 进程                    MCP Server 进程
┌─────────────────────────┐         ┌─────────────────────────┐
│                         │         │                         │
│  ┌─────────┐            │         │  ┌──────────┐           │
│  │Popup UI │──msg──┐    │         │  │HTTP Server│           │
│  └────┬────┘       │    │         │  └─────┬────┘           │
│       │            ▼    │  HTTP   │        │                │
│  HTTP ping   ┌─────────┐├────────>│        ▼                │
│       │      │Background││        │  ┌──────────┐           │
│       │      │   SW     ││        │  │Data Store│           │
│       │      └─────────┘│        │  └─────┬────┘           │
│       │            ▲    │         │        │                │
│  ┌────┴────┐       │    │         │        ▼                │
│  │ Content │──msg──┘    │         │  ┌──────────┐  stdio    │
│  │ Script  │            │         │  │MCP Tools │◄─────────── Cursor
│  └─────────┘            │         │  └──────────┘           │
│                         │         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

## 通信协议

### Chrome Extension 内部通信
- **方式**: `chrome.runtime.sendMessage()` / `chrome.runtime.onMessage`
- **格式**: `{ type: string, payload: any }`
- **消息类型**:
  - `ACTIVATE_SELECTOR` — Popup → Background → Content Script
  - `DEACTIVATE_SELECTOR` — Popup → Background → Content Script
  - `ELEMENT_CAPTURED` — Content Script → Background
  - `SEND_RESULT` — Background → Content Script / Popup
  - `STATUS_REQUEST` — Popup → Background

### Chrome Extension → MCP Server
- **方式**: HTTP POST
- **端点**: `http://localhost:19816/capture`
- **Content-Type**: `application/json`
- **请求体**: `CapturedElementData` JSON

### MCP Server → Cursor
- **方式**: MCP Protocol over stdio
- **工具**: `get_selected_element`, `get_element_screenshot`, `get_element_styles`, `list_captured_elements`

---

## 共享类型定义

Chrome 扩展和 MCP Server 共享以下核心类型（monorepo 中的 shared package）：

```typescript
interface CapturedElementData {
  id: string;
  timestamp: number;
  url: string;
  title: string;
  element: {
    tagName: string;
    html: string;        // outerHTML（含子元素）
    text: string;        // textContent
    classes: string[];
    id: string | null;
    attributes: Record<string, string>;
    domPath: string;     // 如 "body > div.app > main > section.hero"
  };
  styles: {
    computed: Record<string, string>;   // 计算样式
    matched: CSSRuleInfo[];             // 匹配的 CSS 规则
  };
  screenshot: string | null;  // Base64 PNG
}

interface CSSRuleInfo {
  selector: string;
  properties: Record<string, string>;
  mediaQuery: string | null;
  source: string;       // stylesheet URL 或 inline
}

interface CapturedElementSummary {
  id: string;
  timestamp: number;
  url: string;
  tagName: string;
  classes: string[];
  text: string;         // 截断的 textContent
}
```
