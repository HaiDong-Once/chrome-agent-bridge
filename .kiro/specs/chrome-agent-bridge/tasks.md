# 实施计划: Chrome-Agent Bridge

## 概述

基于 TypeScript monorepo 架构，按自底向上的顺序实现：先搭建项目结构和共享类型，再实现 MCP Server 核心（Data Store → HTTP Server → MCP Tools），然后实现 Chrome 扩展（Content Script → Background SW → Popup UI），最后集成联调。每个阶段通过属性测试和单元测试验证正确性。

## 任务

- [x] 1. 搭建 monorepo 项目结构与共享类型包
  - [x] 1.1 初始化 monorepo 项目结构
    - 创建根目录 `package.json`（workspaces 配置）和 `tsconfig.base.json`
    - 创建 `packages/shared/`、`packages/mcp-server/`、`packages/chrome-extension/` 三个子包
    - 每个子包配置 `package.json` 和 `tsconfig.json`（继承 base）
    - 安装开发依赖：`typescript`、`vitest`、`fast-check`
    - _需求: 10.1_

  - [x] 1.2 实现共享类型定义
    - 在 `packages/shared/src/types.ts` 中定义 `CapturedElementData`、`CSSRuleInfo`、`CapturedElementSummary` 接口
    - 定义 `ExtMessage` 联合类型（ACTIVATE_SELECTOR、DEACTIVATE_SELECTOR、ELEMENT_CAPTURED、SEND_RESULT、STATUS_REQUEST）
    - 定义 HTTP 接口类型：`CaptureRequest`、`CaptureResponse`、`CaptureErrorResponse`、`PingResponse`
    - 配置 `packages/shared/src/index.ts` 导出所有类型
    - _需求: 10.1, 10.2, 10.3_

  - [x] 1.3 编写属性测试：CapturedElementData JSON 序列化往返一致性
    - **属性 10: CapturedElementData JSON 序列化往返一致性**
    - 使用 fast-check 生成随机合法 CapturedElementData 对象
    - 验证 `JSON.parse(JSON.stringify(data))` 与原始对象深度相等
    - 测试文件: `packages/shared/src/__tests__/serialization.property.test.ts`
    - **验证需求: 11.1, 11.2, 11.3**

- [x] 2. 实现 Data Store 内存缓存模块
  - [x] 2.1 实现 DataStore 类
    - 在 `packages/mcp-server/src/data-store.ts` 中实现 `DataStore` 类
    - 实现 `store(data)` 方法：生成 UUID v4 作为唯一 ID，存入 Map，维护有序 ID 列表，超过 20 条时淘汰最早记录
    - 实现 `getById(id)` 方法：按 ID 查询完整记录
    - 实现 `getLatest()` 方法：返回最近一条记录
    - 实现 `list()` 方法：返回所有记录的 `CapturedElementSummary` 摘要
    - 实现 `clear()` 方法：清空缓存
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 2.2 编写属性测试：store/getById 往返一致性
    - **属性 3: Data Store 存储/查询往返一致性**
    - 使用 fast-check 生成随机 CapturedElementData，验证 store 后 getById 返回等价对象
    - 测试文件: `packages/mcp-server/src/__tests__/data-store.property.test.ts`
    - **验证需求: 5.1, 5.3**

  - [x] 2.3 编写属性测试：容量不变量
    - **属性 4: Data Store 容量不变量**
    - 使用 fast-check 生成 1-50 条随机数据的存储序列，验证记录数始终 ≤ 20 且淘汰最早记录
    - 测试文件: `packages/mcp-server/src/__tests__/data-store.property.test.ts`
    - **验证需求: 5.2**

  - [x] 2.4 编写属性测试：getLatest 正确性
    - **属性 5: Data Store getLatest 正确性**
    - 使用 fast-check 生成随机长度的存储序列，验证 getLatest 返回最后一次 store 的记录
    - 测试文件: `packages/mcp-server/src/__tests__/data-store.property.test.ts`
    - **验证需求: 5.4**

  - [x] 2.5 编写属性测试：列表摘要一致性
    - **属性 6: Data Store 列表摘要一致性**
    - 使用 fast-check 生成随机 Data Store 状态，验证 list() 摘要数量和字段与完整记录一致
    - 测试文件: `packages/mcp-server/src/__tests__/data-store.property.test.ts`
    - **验证需求: 5.5, 6.5**

  - [x] 2.6 编写 Data Store 单元测试
    - 测试空 store 查询返回 null
    - 测试 clear 后记录为空
    - 测试边界情况（恰好 20 条、21 条时淘汰行为）
    - 测试文件: `packages/mcp-server/src/__tests__/data-store.test.ts`
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. 实现 HTTP Server 模块
  - [x] 3.1 实现 HTTP Server
    - 在 `packages/mcp-server/src/http-server.ts` 中使用 Node.js 原生 `http` 模块实现
    - 实现 `start(port)` 方法：绑定 localhost:19816 监听
    - 实现 `handleCapture(req)` 方法：解析 JSON 请求体，验证 CapturedElementData 结构，调用 DataStore.store()，返回 200 + ID 或 400 + 错误信息
    - 实现 `handlePing()` 方法：返回 `{ status: 'ok', timestamp }` 
    - 所有响应设置 CORS 头（Access-Control-Allow-Origin: *）
    - 处理 OPTIONS 预检请求
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.2 实现请求体验证函数
    - 在 `packages/mcp-server/src/validator.ts` 中实现 `validateCapturedElementData(data)` 函数
    - 验证所有必需字段存在且类型正确
    - 返回验证结果和具体错误信息
    - _需求: 4.2, 4.4_

  - [x] 3.3 编写属性测试：HTTP /capture 数据验证正确性
    - **属性 7: HTTP /capture 数据验证正确性**
    - 使用 fast-check 生成合法和非法的 JSON 请求体，验证合法数据返回 200、非法数据返回 400
    - 测试文件: `packages/mcp-server/src/__tests__/http-server.property.test.ts`
    - **验证需求: 4.2, 4.3**

  - [x] 3.4 编写属性测试：CORS 头不变量
    - **属性 8: HTTP 响应 CORS 头不变量**
    - 使用 fast-check 生成随机 HTTP 请求，验证所有响应都包含正确的 CORS 头
    - 测试文件: `packages/mcp-server/src/__tests__/http-server.property.test.ts`
    - **验证需求: 4.6**

  - [x] 3.5 编写 HTTP Server 单元测试
    - 测试 GET /ping 返回 200 和正确格式
    - 测试端口绑定 localhost
    - 测试无效 JSON 返回 400
    - 测试缺少必需字段返回 400
    - 测试文件: `packages/mcp-server/src/__tests__/http-server.test.ts`
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. 实现 MCP Tools 模块
  - [x] 4.1 实现 MCP Tools
    - 在 `packages/mcp-server/src/mcp-tools.ts` 中使用 `@modelcontextprotocol/sdk` 实现
    - 注册 `get_selected_element` 工具：接受可选 `id` 参数，返回完整 CapturedElementData
    - 注册 `get_element_screenshot` 工具：接受可选 `id` 参数，返回截图 Base64 PNG
    - 注册 `get_element_styles` 工具：接受可选 `id` 参数，返回 CSS 样式详情
    - 注册 `list_captured_elements` 工具：返回所有缓存摘要列表
    - 无数据时返回描述性提示信息
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.2 实现 MCP Server 入口文件
    - 在 `packages/mcp-server/src/index.ts` 中实现主入口
    - 初始化共享 DataStore 实例
    - 启动 HTTP Server（端口 19816）
    - 启动 MCP 协议接口（stdio 模式）
    - 处理端口冲突错误（输出提示后退出）
    - _需求: 8.1, 8.2_

  - [x] 4.3 编写属性测试：MCP 工具数据一致性
    - **属性 9: MCP 工具数据一致性**
    - 使用 fast-check 生成随机 Data Store 状态，验证各 MCP 工具返回的数据与 Data Store 中对应记录一致
    - 测试文件: `packages/mcp-server/src/__tests__/mcp-tools.property.test.ts`
    - **验证需求: 6.2, 6.3, 6.4**

  - [ ]* 4.4 编写 MCP Tools 单元测试
    - 测试无数据时各工具返回提示信息
    - 测试指定不存在 ID 时返回错误提示
    - 测试文件: `packages/mcp-server/src/__tests__/mcp-tools.test.ts`
    - _需求: 6.6_

- [x] 5. 检查点 - MCP Server 侧验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. 实现 Chrome 扩展 - Content Script
  - [x] 6.1 创建 Chrome 扩展基础结构
    - 在 `packages/chrome-extension/` 中创建 `manifest.json`（Manifest V3）
    - 配置权限：`activeTab`、`scripting`
    - 配置 Service Worker 入口和 Popup 页面
    - _需求: 9.1, 9.2, 9.3_

  - [x] 6.2 实现 Content Script 元素选择器
    - 在 `packages/chrome-extension/src/content.ts` 中实现
    - 实现 `activateSelector()`：绑定 mouseover/mouseout/click 事件监听
    - 实现 `deactivateSelector()`：移除所有事件监听，清除高亮效果
    - 实现 `highlightElement(el)`：为悬停元素添加 outline 高亮边框
    - 监听来自 Background SW 的 ACTIVATE_SELECTOR / DEACTIVATE_SELECTOR 消息
    - _需求: 1.1, 1.2, 1.3_

  - [x] 6.3 实现 Content Script 元素信息采集
    - 实现 `captureElement(el)`：编排完整采集流程
    - 实现 `getComputedStyles(el)`：获取计算后 CSS 样式
    - 实现 `getMatchedCSSRules(el)`：获取匹配的 CSS 规则（含媒体查询和来源）
    - 实现 `getElementMetadata(el)`：获取 DOM 路径、class、id、属性等元数据
    - 实现 `captureScreenshot(el)`：通过 Background SW 调用 `chrome.tabs.captureVisibleTab` 获取截图并裁剪
    - 采集完成后组装 CapturedElementData 并通过 `chrome.runtime.sendMessage` 发送 ELEMENT_CAPTURED 消息
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 6.4 编写属性测试：选择器模式 Toggle 往返一致性
    - **属性 1: 选择器模式 Toggle 往返一致性**
    - 模拟 Content Script 环境，验证激活后停用恢复初始状态
    - 测试文件: `packages/chrome-extension/src/__tests__/selector.property.test.ts`
    - **验证需求: 1.1, 1.3**

  - [ ]* 6.5 编写属性测试：元素采集数据完整性
    - **属性 2: 元素采集数据完整性**
    - 使用 fast-check 生成随机 CapturedElementData，验证所有必需字段存在
    - 测试文件: `packages/chrome-extension/src/__tests__/capture.property.test.ts`
    - **验证需求: 2.4, 2.5**

- [x] 7. 实现 Chrome 扩展 - Background Service Worker
  - [x] 7.1 实现 Background Service Worker
    - 在 `packages/chrome-extension/src/background.ts` 中实现
    - 实现 `handleMessage(msg)`：统一消息路由，处理 ACTIVATE_SELECTOR、DEACTIVATE_SELECTOR、ELEMENT_CAPTURED、STATUS_REQUEST
    - 实现 `sendToServer(data)`：HTTP POST 到 `http://localhost:19816/capture`，返回成功/失败结果
    - 实现 `injectContentScript(tabId)`：使用 `chrome.scripting.executeScript` 按需注入 Content Script
    - 发送成功/失败后通过 SEND_RESULT 消息通知 Content Script 和 Popup UI
    - _需求: 1.4, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 7.2 编写属性测试：发送结果通知一致性
    - **属性 11: 发送结果通知一致性**
    - 使用 fast-check 生成随机成功/失败场景，验证 SEND_RESULT 消息格式正确
    - 测试文件: `packages/chrome-extension/src/__tests__/transport.property.test.ts`
    - **验证需求: 3.1, 3.2, 3.3, 3.4**

- [x] 8. 实现 Chrome 扩展 - Popup UI
  - [x] 8.1 实现 Popup UI
    - 创建 `packages/chrome-extension/src/popup.html`：包含连接状态指示器和"开始选择"按钮
    - 创建 `packages/chrome-extension/src/popup.css`：样式定义，在线/离线状态视觉区分（绿色/灰色）
    - 创建 `packages/chrome-extension/src/popup.ts`：
      - 实现 `checkServerStatus()`：HTTP GET /ping 检查 MCP Server 在线状态
      - 实现 `toggleSelector()`：发送 ACTIVATE/DEACTIVATE_SELECTOR 消息
      - 实现 `renderStatus(online)`：更新连接状态指示器
      - 监听 SEND_RESULT 消息更新最近操作结果
    - _需求: 7.1, 7.2, 7.3, 7.4_

- [x] 9. 集成与联调
  - [x] 9.1 创建 MCP Server 配置文件
    - 创建 `mcp.json` 示例配置文件，声明 MCP Server 的 stdio 启动命令
    - 确保 `packages/mcp-server/package.json` 中配置正确的 `bin` 入口
    - _需求: 8.2_

  - [x] 9.2 配置构建脚本
    - 配置 `packages/mcp-server` 的 TypeScript 编译和启动脚本
    - 配置 `packages/chrome-extension` 的构建脚本（输出到 dist 目录供 Chrome 加载）
    - 配置根目录的统一构建和测试脚本
    - _需求: 8.1, 8.3_

- [x] 10. 最终检查点 - 全部验证
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务用于阶段性验证，确保增量开发的正确性
- 属性测试验证系统的通用正确性属性，单元测试验证具体边界情况
