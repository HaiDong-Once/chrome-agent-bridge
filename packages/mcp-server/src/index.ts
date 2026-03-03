#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DataStore } from './data-store.js';
import { HttpServer } from './http-server.js';
import { registerTools } from './mcp-tools.js';

const HTTP_PORT = 19816;

async function main(): Promise<void> {
  // Shared DataStore instance used by both HTTP Server and MCP Tools
  const dataStore = new DataStore();

  // Start HTTP Server for receiving data from Chrome Extension
  const httpServer = new HttpServer(dataStore);
  try {
    await httpServer.start(HTTP_PORT);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE') {
      process.stderr.write(
        `错误: 端口 ${HTTP_PORT} 已被占用，请关闭占用该端口的进程后重试。\n`,
      );
      process.exit(1);
    }
    throw err;
  }

  // Initialize MCP Server with stdio transport
  const mcpServer = new McpServer({
    name: 'chrome-agent-bridge',
    version: '0.1.0',
  });

  registerTools(mcpServer, dataStore);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`启动失败: ${String(err)}\n`);
  process.exit(1);
});
