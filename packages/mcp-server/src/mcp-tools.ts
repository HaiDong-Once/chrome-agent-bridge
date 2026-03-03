import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DataStore } from './data-store.js';

const NO_DATA_MSG = '当前无已采集的元素数据，请先在浏览器中选择元素';

function notFoundMsg(id: string): string {
  return `未找到 ID 为 ${id} 的元素数据`;
}

/**
 * Register all MCP tools on the given McpServer instance.
 * Tools read from the shared DataStore.
 */
export function registerTools(server: McpServer, dataStore: DataStore): void {
  // get_selected_element: return full CapturedElementData + screenshot as image
  server.tool(
    'get_selected_element',
    '获取最近一次或指定 ID 的已采集元素完整信息（HTML、CSS、元数据），同时返回元素截图',
    { id: z.optional(z.string()) },
    async ({ id }) => {
      const data = id ? dataStore.getById(id) : dataStore.getLatest();
      if (!data) {
        return {
          content: [{ type: 'text' as const, text: id ? notFoundMsg(id) : NO_DATA_MSG }],
        };
      }

      const { screenshot, ...rest } = data;
      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [
        { type: 'text' as const, text: JSON.stringify(rest, null, 2) },
      ];

      if (screenshot) {
        content.push({
          type: 'image' as const,
          data: screenshot,
          mimeType: 'image/jpeg',
        });
      }

      return { content };
    },
  );

  // get_element_screenshot: return Base64 JPEG screenshot
  server.tool(
    'get_element_screenshot',
    '获取最近一次或指定 ID 的元素截图（Base64 JPEG）',
    { id: z.optional(z.string()) },
    async ({ id }) => {
      const data = id ? dataStore.getById(id) : dataStore.getLatest();
      if (!data) {
        return {
          content: [{ type: 'text' as const, text: id ? notFoundMsg(id) : NO_DATA_MSG }],
        };
      }
      if (!data.screenshot) {
        return {
          content: [{ type: 'text' as const, text: '该元素没有截图数据' }],
        };
      }
      return {
        content: [{ type: 'image' as const, data: data.screenshot, mimeType: 'image/jpeg' }],
      };
    },
  );

  // get_element_styles: return CSS style details
  server.tool(
    'get_element_styles',
    '获取最近一次或指定 ID 的元素 CSS 样式详情（计算样式和匹配规则）',
    { id: z.optional(z.string()) },
    async ({ id }) => {
      const data = id ? dataStore.getById(id) : dataStore.getLatest();
      if (!data) {
        return {
          content: [{ type: 'text' as const, text: id ? notFoundMsg(id) : NO_DATA_MSG }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data.styles, null, 2) }],
      };
    },
  );

  // list_captured_elements: return all cached summaries
  server.tool(
    'list_captured_elements',
    '列出所有已采集元素的摘要列表',
    async () => {
      const summaries = dataStore.list();
      if (summaries.length === 0) {
        return {
          content: [{ type: 'text' as const, text: NO_DATA_MSG }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summaries, null, 2) }],
      };
    },
  );
}
