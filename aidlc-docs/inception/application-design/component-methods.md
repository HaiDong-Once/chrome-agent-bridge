# Chrome-Agent Bridge — 组件方法签名

## C1: Popup UI

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `checkServerStatus()` | — | `Promise<boolean>` | 检查 MCP Server 是否在线（HTTP ping） |
| `toggleSelector()` | — | `void` | 激活/停用元素选择器模式 |
| `renderStatus(online: boolean)` | `boolean` | `void` | 更新 UI 显示连接状态 |

## C2: Content Script

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `activateSelector()` | — | `void` | 启动元素选择器模式，绑定鼠标事件 |
| `deactivateSelector()` | — | `void` | 停用选择器模式，移除事件监听和高亮 |
| `highlightElement(el: Element)` | `Element` | `void` | 为鼠标悬停的元素添加高亮边框 |
| `captureElement(el: Element)` | `Element` | `Promise<CapturedElementData>` | 采集元素的完整信息（HTML、CSS、截图、元数据） |
| `captureScreenshot(el: Element)` | `Element` | `Promise<string>` | 对选中元素区域截图，返回 Base64 PNG |
| `getComputedStyles(el: Element)` | `Element` | `CSSStyleMap` | 获取元素及子元素的计算样式 |
| `getMatchedCSSRules(el: Element)` | `Element` | `CSSRuleInfo[]` | 获取匹配的 CSS 规则（含媒体查询） |
| `getElementMetadata(el: Element)` | `Element` | `ElementMetadata` | 获取 DOM 路径、class、id、data 属性等 |

## C3: Background Service Worker

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `handleMessage(msg: ExtMessage)` | `ExtMessage` | `void` | 统一消息路由（Popup ↔ Content Script） |
| `sendToServer(data: CapturedElementData)` | `CapturedElementData` | `Promise<SendResult>` | HTTP POST 发送数据到 MCP Server |
| `injectContentScript(tabId: number)` | `number` | `Promise<void>` | 按需注入 Content Script 到目标页面 |
| `updateBadge(status: string)` | `string` | `void` | 更新扩展图标 badge 显示状态 |

## C4: HTTP Server

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `start(port: number)` | `number` | `Promise<void>` | 启动 HTTP Server 监听指定端口 |
| `handleCapture(req: CaptureRequest)` | `CaptureRequest` | `CaptureResponse` | 处理 POST /capture 请求，验证并存储数据 |
| `handlePing()` | — | `PingResponse` | 处理 GET /ping 健康检查 |

## C5: Data Store

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `store(data: CapturedElementData)` | `CapturedElementData` | `string` | 存储数据，返回唯一 ID，超出 20 条淘汰最旧 |
| `getLatest()` | — | `CapturedElementData \| null` | 获取最近一次采集的数据 |
| `getById(id: string)` | `string` | `CapturedElementData \| null` | 按 ID 查询 |
| `list()` | — | `CapturedElementSummary[]` | 列出所有缓存记录的摘要信息 |
| `clear()` | — | `void` | 清空所有缓存 |

## C6: MCP Tools

| 工具名 | 参数 | 返回 | 说明 |
|--------|------|------|------|
| `get_selected_element` | `{ id?: string }` | `CapturedElementData` | 获取最近/指定 ID 的元素完整信息 |
| `get_element_screenshot` | `{ id?: string }` | `{ screenshot: string }` | 获取元素截图（Base64 PNG） |
| `get_element_styles` | `{ id?: string }` | `{ styles: CSSRuleInfo[] }` | 获取元素 CSS 样式详情 |
| `list_captured_elements` | — | `CapturedElementSummary[]` | 列出历史采集记录 |
