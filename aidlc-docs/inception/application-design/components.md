# Chrome-Agent Bridge — 组件设计

## 系统架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Browser                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Popup UI   │  │Content Script│  │  Background    │ │
│  │  (状态/控制)  │  │ (元素采集)    │  │  Service Worker│ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
└─────────┼─────────────────┼───────────────────┼─────────┘
          │                 │                   │
          │    Chrome Extension Message Passing  │
          │                 │                   │
          └─────────────────┼───────────────────┘
                            │ HTTP POST (localhost:19816)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   MCP Server (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  HTTP Server  │  │  Data Store  │  │  MCP Tools    │ │
│  │  (接收数据)   │  │  (内存缓存)   │  │  (暴露给Agent)│ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
│                                              │          │
└──────────────────────────────────────────────┼──────────┘
                                               │ stdio (MCP Protocol)
                                               ▼
┌─────────────────────────────────────────────────────────┐
│                   Cursor IDE                             │
│  Agent 通过 MCP 工具获取元素信息                           │
└─────────────────────────────────────────────────────────┘
```

---

## 组件定义

### C1: Popup UI

- **职责**: 提供用户控制界面，展示连接状态，激活/停用元素选择器
- **技术**: HTML + CSS + TypeScript（Chrome Extension Popup）
- **生命周期**: 用户点击扩展图标时创建，关闭 popup 时销毁

### C2: Content Script

- **职责**: 注入到目标网页，负责元素选择器交互（高亮、点击捕获）和元素信息采集（HTML、CSS、截图）
- **技术**: TypeScript，运行在网页上下文中
- **生命周期**: 由 Background Service Worker 按需注入

### C3: Background Service Worker

- **职责**: Chrome 扩展的核心协调者。管理扩展状态，转发 Content Script 采集的数据到 MCP Server（HTTP POST），处理 Popup 和 Content Script 之间的消息路由
- **技术**: TypeScript（Manifest V3 Service Worker）
- **生命周期**: 由 Chrome 管理，事件驱动

### C4: HTTP Server

- **职责**: 监听 localhost 端口，接收 Chrome 扩展发送的元素数据，验证数据格式，转存到 Data Store
- **技术**: Node.js HTTP（无框架依赖，轻量实现）
- **生命周期**: 随 MCP Server 进程启动/停止

### C5: Data Store

- **职责**: 内存中缓存采集的元素数据，支持按 ID 查询、列表查询，管理缓存容量（最近 20 条）
- **技术**: TypeScript Map/Array，纯内存
- **生命周期**: 随进程存在，进程退出数据清空

### C6: MCP Tools

- **职责**: 通过 MCP 协议向 Cursor Agent 暴露工具接口，从 Data Store 读取数据并返回给 Agent
- **技术**: MCP SDK（@modelcontextprotocol/sdk）
- **生命周期**: 随 MCP Server 进程，由 Cursor 通过 stdio 管理
