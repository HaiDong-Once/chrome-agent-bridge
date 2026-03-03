/**
 * 属性 9: MCP 工具数据一致性
 * Feature: chrome-agent-bridge, Property 9: MCP 工具数据一致性
 *
 * For any DataStore state, data returned by get_selected_element,
 * get_element_screenshot, and get_element_styles MCP tools must match
 * the corresponding records in the DataStore.
 *
 * Validates: Requirements 6.2, 6.3, 6.4
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DataStore } from '../data-store';
import { registerTools } from '../mcp-tools';
import type { CapturedElementData } from '@chrome-agent-bridge/shared';

// --- Arbitraries ---

const cssRuleInfoArb = fc.record({
  selector: fc.string({ minLength: 1 }),
  properties: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
  mediaQuery: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  source: fc.string({ minLength: 1 }),
});

const capturedElementDataArb: fc.Arbitrary<CapturedElementData> = fc.record({
  id: fc.uuid(),
  timestamp: fc.nat(),
  url: fc.webUrl(),
  title: fc.string({ minLength: 1 }),
  element: fc.record({
    tagName: fc.constantFrom('div', 'span', 'p', 'section', 'article', 'main', 'header', 'footer'),
    html: fc.string({ minLength: 1 }),
    text: fc.string(),
    classes: fc.array(fc.string({ minLength: 1 })),
    id: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    attributes: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
    domPath: fc.string({ minLength: 1 }),
  }),
  styles: fc.record({
    computed: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
    matched: fc.array(cssRuleInfoArb),
  }),
  screenshot: fc.option(fc.base64String(), { nil: null }),
});

// --- Helper to call registered tool handlers directly ---

type ToolResult = { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> };

/**
 * Access the internal _registeredTools map on McpServer and invoke a tool handler.
 * Tools with inputSchema are called as handler(args, extra).
 * Tools without inputSchema are called as handler(extra).
 */
async function callTool(
  mcpServer: McpServer,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const tools = (mcpServer as any)._registeredTools;
  const tool = tools[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  // Provide a minimal extra object (tools don't use it in our implementation)
  const extra = {};
  if (tool.inputSchema) {
    return await tool.handler(args, extra);
  }
  return await tool.handler(extra);
}

// --- Tests ---

describe('Property 9: MCP tool data consistency', () => {
  /**
   * Requirement 6.2: get_selected_element returns full CapturedElementData
   * matching what is stored in DataStore, both via getLatest and getById.
   */
  it('get_selected_element returns data consistent with DataStore (by id)', async () => {
    await fc.assert(
      fc.asyncProperty(capturedElementDataArb, async (data) => {
        const dataStore = new DataStore();
        const mcpServer = new McpServer({ name: 'test', version: '0.0.0' });
        registerTools(mcpServer, dataStore);

        const id = dataStore.store(data);
        const stored = dataStore.getById(id)!;

        const result = await callTool(mcpServer, 'get_selected_element', { id });
        // First content block is text JSON (without screenshot)
        expect(result.content[0].type).toBe('text');
        const { screenshot: _s, ...expectedRest } = stored;
        const parsed = JSON.parse(result.content[0].text!);
        expect(parsed).toEqual(expectedRest);

        // If screenshot exists, second block is image
        if (stored.screenshot) {
          expect(result.content).toHaveLength(2);
          expect(result.content[1].type).toBe('image');
          expect(result.content[1].data).toBe(stored.screenshot);
          expect(result.content[1].mimeType).toBe('image/jpeg');
        } else {
          expect(result.content).toHaveLength(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('get_selected_element via getLatest matches last stored record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(capturedElementDataArb, { minLength: 1, maxLength: 10 }),
        async (items) => {
          const dataStore = new DataStore();
          const mcpServer = new McpServer({ name: 'test', version: '0.0.0' });
          registerTools(mcpServer, dataStore);

          let lastId = '';
          for (const item of items) {
            lastId = dataStore.store(item);
          }
          const stored = dataStore.getById(lastId)!;

          // Call without id → should use getLatest
          const result = await callTool(mcpServer, 'get_selected_element', {});
          const { screenshot: _s, ...expectedRest } = stored;
          const parsed = JSON.parse(result.content[0].text!);
          expect(parsed).toEqual(expectedRest);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Requirement 6.3: get_element_screenshot returns screenshot matching DataStore.
   */
  it('get_element_screenshot returns screenshot consistent with DataStore', async () => {
    await fc.assert(
      fc.asyncProperty(capturedElementDataArb, async (data) => {
        const dataStore = new DataStore();
        const mcpServer = new McpServer({ name: 'test', version: '0.0.0' });
        registerTools(mcpServer, dataStore);

        const id = dataStore.store(data);
        const stored = dataStore.getById(id)!;

        const result = await callTool(mcpServer, 'get_element_screenshot', { id });
        expect(result.content).toHaveLength(1);

        if (stored.screenshot) {
          // Should return image content with matching data
          expect(result.content[0].type).toBe('image');
          expect(result.content[0].data).toBe(stored.screenshot);
          expect(result.content[0].mimeType).toBe('image/jpeg');
        } else {
          // No screenshot → text message
          expect(result.content[0].type).toBe('text');
          expect(result.content[0].text).toBe('该元素没有截图数据');
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Requirement 6.4: get_element_styles returns styles matching DataStore.
   */
  it('get_element_styles returns styles consistent with DataStore', async () => {
    await fc.assert(
      fc.asyncProperty(capturedElementDataArb, async (data) => {
        const dataStore = new DataStore();
        const mcpServer = new McpServer({ name: 'test', version: '0.0.0' });
        registerTools(mcpServer, dataStore);

        const id = dataStore.store(data);
        const stored = dataStore.getById(id)!;

        const result = await callTool(mcpServer, 'get_element_styles', { id });
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');

        const parsed = JSON.parse(result.content[0].text!);
        expect(parsed).toEqual(stored.styles);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Combined: for any random DataStore state, all tools return consistent data.
   */
  it('all tools return data consistent with DataStore for random state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(capturedElementDataArb, { minLength: 1, maxLength: 15 }),
        fc.nat(),
        async (items, pickIndex) => {
          const dataStore = new DataStore();
          const mcpServer = new McpServer({ name: 'test', version: '0.0.0' });
          registerTools(mcpServer, dataStore);

          const ids: string[] = [];
          for (const item of items) {
            ids.push(dataStore.store(item));
          }

          // Pick a random stored element that still exists (capacity ≤ 20)
          const validIds = ids.filter((id) => dataStore.getById(id) !== null);
          const targetId = validIds[pickIndex % validIds.length];
          const stored = dataStore.getById(targetId)!;

          // get_selected_element (text block excludes screenshot)
          const elemResult = await callTool(mcpServer, 'get_selected_element', { id: targetId });
          const { screenshot: _s, ...expectedRest } = stored;
          expect(JSON.parse(elemResult.content[0].text!)).toEqual(expectedRest);

          // get_element_styles
          const stylesResult = await callTool(mcpServer, 'get_element_styles', { id: targetId });
          expect(JSON.parse(stylesResult.content[0].text!)).toEqual(stored.styles);

          // get_element_screenshot
          const ssResult = await callTool(mcpServer, 'get_element_screenshot', { id: targetId });
          if (stored.screenshot) {
            expect(ssResult.content[0].data).toBe(stored.screenshot);
          } else {
            expect(ssResult.content[0].text).toBe('该元素没有截图数据');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
