# Chrome-Agent Bridge — 服务设计

## 服务总览

本项目不采用传统的微服务架构，而是两个独立进程（Chrome 扩展 + MCP Server）通过 HTTP 通信。服务层设计聚焦于进程内的模块编排。

---

## S1: Element Capture Service（元素采集服务）

- **所在进程**: Chrome 扩展（Content Script）
- **职责**: 编排元素信息的完整采集流程
- **流程**:
  1. 用户点击元素 → 触发 captureElement
  2. 并行采集：HTML 结构、计算样式、匹配 CSS 规则、元素元数据
  3. 异步采集：元素区域截图
  4. 组装为 CapturedElementData 结构
  5. 通过 Chrome Message 发送给 Background Service Worker

## S2: Data Transport Service（数据传输服务）

- **所在进程**: Chrome 扩展（Background Service Worker）
- **职责**: 将采集数据可靠地传输到 MCP Server
- **流程**:
  1. 接收 Content Script 的采集数据
  2. HTTP POST 到 localhost:19816/capture
  3. 处理响应（成功/失败/Server 离线）
  4. 通知 Content Script 和 Popup 发送结果
- **容错**: Server 离线时缓存数据，Server 上线后重试（MVP 可简化为直接报错）

## S3: MCP Bridge Service（MCP 桥接服务）

- **所在进程**: MCP Server（Node.js）
- **职责**: 桥接 HTTP 接收和 MCP 工具暴露
- **流程**:
  1. 进程启动 → 同时初始化 HTTP Server 和 MCP Server
  2. HTTP Server 接收数据 → 存入 Data Store
  3. MCP 工具被调用 → 从 Data Store 读取数据 → 返回给 Agent
- **关键点**: HTTP Server 和 MCP Server 共享同一个 Data Store 实例

---

## 数据流序列图

```
用户(浏览器)          Content Script       Background SW        MCP Server         Cursor Agent
    │                     │                    │                   │                    │
    │  点击元素            │                    │                   │                    │
    ├────────────────────>│                    │                   │                    │
    │                     │ 采集HTML/CSS/截图   │                   │                    │
    │                     │───────────┐        │                   │                    │
    │                     │           │        │                   │                    │
    │                     │<──────────┘        │                   │                    │
    │                     │ chrome.runtime     │                   │                    │
    │                     │  .sendMessage()    │                   │                    │
    │                     ├───────────────────>│                   │                    │
    │                     │                    │ HTTP POST /capture│                    │
    │                     │                    ├──────────────────>│                    │
    │                     │                    │                   │ 存入 DataStore     │
    │                     │                    │    200 OK         │                    │
    │                     │                    │<──────────────────┤                    │
    │  显示成功提示        │                    │                   │                    │
    │<────────────────────┤                    │                   │                    │
    │                     │                    │                   │                    │
    │                     │                    │                   │  MCP: get_selected │
    │                     │                    │                   │  _element          │
    │                     │                    │                   │<───────────────────┤
    │                     │                    │                   │ 从DataStore读取     │
    │                     │                    │                   │───────────────────>│
    │                     │                    │                   │                    │
```
