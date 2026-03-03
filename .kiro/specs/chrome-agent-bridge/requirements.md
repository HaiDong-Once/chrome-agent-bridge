# 需求文档

## 简介

Chrome-Agent Bridge 是一个开发者工具，用于打通 Chrome 浏览器与 Agent IDE（如 Cursor/Kiro）之间的交互。该工具由 Chrome 扩展和本地 MCP Server 两部分组成，允许开发者在浏览器中选中页面元素，自动采集元素的 HTML 结构、CSS 样式和截图信息，并通过 MCP 协议将这些信息暴露给 Agent IDE，消除手动复制粘贴的低效流程。

MVP 阶段聚焦于第三方网站样式抓取场景：开发者在浏览器中看到满意的 UI 元素，通过 Chrome-Agent Bridge 一键采集并发送给 Agent，由 Agent 直接利用这些结构化信息进行开发。

## 术语表

- **Chrome_Extension**: Chrome 浏览器扩展程序，包含 Popup UI、Content Script 和 Background Service Worker 三个子组件，负责元素选择、信息采集和数据传输
- **MCP_Server**: 本地 Node.js 进程，同时提供 HTTP 接口（接收 Chrome 扩展数据）和 MCP 协议接口（暴露工具给 Agent IDE）
- **Content_Script**: 注入到目标网页的脚本，负责元素选择器交互（高亮、点击捕获）和元素信息采集
- **Background_Service_Worker**: Chrome 扩展的核心协调组件，管理扩展状态，转发采集数据到 MCP_Server
- **Popup_UI**: Chrome 扩展的弹出界面，提供连接状态展示和元素选择器控制
- **Data_Store**: MCP_Server 进程内的内存缓存模块，存储采集的元素数据
- **MCP_Tools**: 通过 MCP 协议向 Agent IDE 暴露的工具接口集合
- **HTTP_Server**: MCP_Server 进程内的 HTTP 服务模块，监听本地端口接收 Chrome_Extension 发送的数据
- **Element_Selector_Mode**: 元素选择器模式，激活后用户可在网页上通过鼠标悬停高亮和点击来选中目标元素
- **CapturedElementData**: 采集的元素完整数据结构，包含 HTML、CSS、截图和元数据
- **Agent_IDE**: 支持 MCP 协议的 AI 开发工具（如 Cursor、Kiro）

## 需求

### 需求 1: 元素选择器模式激活

**用户故事:** 作为开发者，我希望在浏览器中激活元素选择器模式，以便在任意网页上选中目标元素进行信息采集。

#### 验收标准

1. WHEN 用户点击 Popup_UI 中的"开始选择"按钮, THE Content_Script SHALL 激活 Element_Selector_Mode 并在当前活动标签页中启用鼠标交互事件监听
2. WHILE Element_Selector_Mode 处于激活状态, THE Content_Script SHALL 为鼠标悬停的元素显示可视化高亮边框
3. WHEN 用户再次点击 Popup_UI 中的"开始选择"按钮, THE Content_Script SHALL 停用 Element_Selector_Mode 并移除所有事件监听和高亮效果
4. WHEN Element_Selector_Mode 激活且目标页面尚未注入 Content_Script, THE Background_Service_Worker SHALL 自动注入 Content_Script 到目标标签页

### 需求 2: 元素信息采集

**用户故事:** 作为开发者，我希望点击选中的元素后自动采集其完整信息（HTML、CSS、截图），以便 Agent 获得足够的上下文进行开发。

#### 验收标准

1. WHEN 用户在 Element_Selector_Mode 下点击一个元素, THE Content_Script SHALL 采集该元素及其子元素的完整 HTML 结构（outerHTML）
2. WHEN 用户在 Element_Selector_Mode 下点击一个元素, THE Content_Script SHALL 采集该元素的计算后 CSS 样式（computed styles）和匹配的 CSS 规则（包括媒体查询和伪类）
3. WHEN 用户在 Element_Selector_Mode 下点击一个元素, THE Content_Script SHALL 采集该元素区域的截图并编码为 Base64 PNG 格式
4. WHEN 用户在 Element_Selector_Mode 下点击一个元素, THE Content_Script SHALL 采集该元素的元数据，包括 DOM 路径、class 列表、id、data 属性和标签名
5. WHEN 元素信息采集完成, THE Content_Script SHALL 将所有采集数据组装为 CapturedElementData 结构并通过 Chrome Extension Message API 发送给 Background_Service_Worker
6. THE Content_Script SHALL 在 500 毫秒内完成单个元素的全部信息采集（含截图）

### 需求 3: 数据自动传输

**用户故事:** 作为开发者，我希望选中元素后数据自动发送到 MCP_Server，无需额外确认步骤，以获得最流畅的操作体验。

#### 验收标准

1. WHEN Background_Service_Worker 接收到 Content_Script 发送的 CapturedElementData, THE Background_Service_Worker SHALL 通过 HTTP POST 将数据发送到 HTTP_Server 的 /capture 端点
2. THE Background_Service_Worker SHALL 以 application/json 格式发送结构化的 CapturedElementData 数据
3. WHEN HTTP POST 发送成功, THE Background_Service_Worker SHALL 通知 Content_Script 和 Popup_UI 显示发送成功提示
4. IF HTTP POST 发送失败（MCP_Server 离线或网络错误）, THEN THE Background_Service_Worker SHALL 通知 Content_Script 和 Popup_UI 显示发送失败提示及错误原因

### 需求 4: HTTP Server 数据接收

**用户故事:** 作为开发者，我希望 MCP_Server 能可靠地接收和存储 Chrome 扩展发送的元素数据，以便 Agent 随时查询。

#### 验收标准

1. THE HTTP_Server SHALL 在本地端口 19816 上监听 HTTP 请求，仅绑定 localhost 地址
2. WHEN HTTP_Server 接收到 POST /capture 请求, THE HTTP_Server SHALL 验证请求体的 JSON 数据格式是否符合 CapturedElementData 结构
3. WHEN 数据格式验证通过, THE HTTP_Server SHALL 将 CapturedElementData 存入 Data_Store 并返回 HTTP 200 响应（包含生成的唯一 ID）
4. IF 数据格式验证失败, THEN THE HTTP_Server SHALL 返回 HTTP 400 响应并包含描述性错误信息
5. WHEN HTTP_Server 接收到 GET /ping 请求, THE HTTP_Server SHALL 返回 HTTP 200 响应表示服务在线
6. THE HTTP_Server SHALL 在响应中设置 CORS 头，允许 Chrome_Extension 的跨域请求

### 需求 5: 内存数据缓存

**用户故事:** 作为开发者，我希望采集的元素数据被缓存在内存中，支持历史记录查询，以便 Agent 可以访问多次采集的结果。

#### 验收标准

1. WHEN Data_Store 接收到新的 CapturedElementData, THE Data_Store SHALL 为其生成唯一 ID 并存储到内存缓存中
2. WHEN 缓存记录数量超过 20 条, THE Data_Store SHALL 淘汰最早的记录以保持缓存容量不超过 20 条
3. THE Data_Store SHALL 支持按唯一 ID 查询单条 CapturedElementData 记录
4. THE Data_Store SHALL 支持获取最近一次存储的 CapturedElementData 记录
5. THE Data_Store SHALL 支持列出所有缓存记录的摘要信息（CapturedElementSummary）
6. THE Data_Store SHALL 仅在内存中存储数据，MCP_Server 进程退出时所有数据清空

### 需求 6: MCP 工具暴露

**用户故事:** 作为开发者，我希望 Agent IDE 能通过 MCP 协议调用工具获取采集的元素信息，以便 Agent 直接利用这些信息进行开发。

#### 验收标准

1. THE MCP_Server SHALL 通过 stdio 模式提供 MCP 协议接口，由 Agent_IDE 管理进程生命周期
2. THE MCP_Tools SHALL 提供 get_selected_element 工具，返回最近一次或指定 ID 的元素完整信息（CapturedElementData）
3. THE MCP_Tools SHALL 提供 get_element_screenshot 工具，返回最近一次或指定 ID 的元素截图（Base64 PNG）
4. THE MCP_Tools SHALL 提供 get_element_styles 工具，返回最近一次或指定 ID 的元素 CSS 样式详情
5. THE MCP_Tools SHALL 提供 list_captured_elements 工具，返回所有缓存记录的摘要列表（CapturedElementSummary）
6. IF MCP_Tools 被调用时 Data_Store 中无对应数据, THEN THE MCP_Tools SHALL 返回描述性提示信息告知 Agent 当前无可用数据

### 需求 7: Popup UI 状态展示与控制

**用户故事:** 作为开发者，我希望通过 Chrome 扩展的弹出界面查看连接状态并控制元素选择器，以便了解系统是否就绪。

#### 验收标准

1. WHEN 用户点击 Chrome_Extension 图标, THE Popup_UI SHALL 显示弹出界面，包含 MCP_Server 连接状态指示和"开始选择"按钮
2. WHEN Popup_UI 打开时, THE Popup_UI SHALL 通过 HTTP GET /ping 请求检查 MCP_Server 是否在线，并显示对应的在线或离线状态
3. WHILE MCP_Server 处于离线状态, THE Popup_UI SHALL 以视觉方式区分显示离线状态（如灰色指示器）
4. WHEN 元素采集数据发送成功或失败, THE Popup_UI SHALL 更新界面显示最近一次操作的结果状态

### 需求 8: MCP Server 进程管理

**用户故事:** 作为开发者，我希望 MCP_Server 由 Agent IDE 自动管理生命周期，无需手动启动或停止服务。

#### 验收标准

1. WHEN MCP_Server 进程启动时, THE MCP_Server SHALL 同时初始化 HTTP_Server 和 MCP 协议接口，共享同一个 Data_Store 实例
2. THE MCP_Server SHALL 支持通过 Agent_IDE 的 mcp.json 配置文件进行声明式注册
3. THE MCP_Server SHALL 在进程内存占用不超过 50MB 的范围内运行

### 需求 9: Chrome 扩展权限与兼容性

**用户故事:** 作为开发者，我希望 Chrome 扩展遵循最小权限原则并兼容主流 Chromium 浏览器，以确保安全性和广泛适用性。

#### 验收标准

1. THE Chrome_Extension SHALL 遵循 Manifest V3 规范，仅申请 activeTab 和 scripting 权限
2. THE Chrome_Extension SHALL 兼容 Chrome 及基于 Chromium 的浏览器（包括 Edge 和 Brave）
3. THE Chrome_Extension SHALL 支持在 macOS、Windows 和 Linux 操作系统上运行

### 需求 10: 共享类型定义

**用户故事:** 作为开发者，我希望 Chrome 扩展和 MCP Server 共享统一的 TypeScript 类型定义，以确保数据结构一致性和类型安全。

#### 验收标准

1. THE Chrome_Extension 和 MCP_Server SHALL 通过 monorepo 中的共享包引用统一的 TypeScript 类型定义
2. THE 共享类型定义 SHALL 包含 CapturedElementData、CSSRuleInfo 和 CapturedElementSummary 接口
3. THE 共享类型定义 SHALL 包含 Chrome Extension 内部消息通信的消息类型定义

### 需求 11: 数据传输格式序列化

**用户故事:** 作为开发者，我希望采集的元素数据在传输过程中保持结构完整，序列化和反序列化后数据一致。

#### 验收标准

1. THE Background_Service_Worker SHALL 将 CapturedElementData 序列化为 JSON 格式进行 HTTP 传输
2. THE HTTP_Server SHALL 将接收到的 JSON 数据反序列化为 CapturedElementData 结构
3. 对于所有合法的 CapturedElementData 对象，序列化为 JSON 后再反序列化 SHALL 产生与原始对象等价的结果（往返一致性）
