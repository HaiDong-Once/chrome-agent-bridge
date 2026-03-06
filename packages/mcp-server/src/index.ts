#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DataStore } from './data-store.js';
import { HttpServer } from './http-server.js';
import { RemoteDataStore } from './remote-data-store.js';
import { registerTools } from './mcp-tools.js';
import type { DataReader } from './mcp-tools.js';
import { pingServer } from './port-manager.js';

const HTTP_PORT = 19816;

/**
 * Try to start the HTTP Server. Returns the DataReader to use for MCP tools.
 *
 * Strategy:
 * 1. Try to bind the port directly → become the "server" instance.
 * 2. If EADDRINUSE, ping the existing server:
 *    - If it's our service (alive & ours) → enter client mode, use RemoteDataStore.
 *    - If it's not ours → report error.
 *
 * This allows multiple IDE windows to share a single HTTP Server.
 * The first window owns the server; subsequent windows proxy reads through it.
 */
async function startHttpServer(): Promise<{ dataReader: DataReader; httpServer: HttpServer | null }> {
  const dataStore = new DataStore();
  const httpServer = new HttpServer(dataStore);

  // First attempt — try to own the port
  try {
    await httpServer.start(HTTP_PORT);
    process.stderr.write(`[chrome-agent-bridge] HTTP Server 启动成功，端口 ${HTTP_PORT}\n`);
    return { dataReader: dataStore, httpServer };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
  }

  // Port is in use — check who's there
  process.stderr.write(`[chrome-agent-bridge] 端口 ${HTTP_PORT} 已被占用，正在检测...\n`);
  const ping = await pingServer(HTTP_PORT);

  if (ping.alive && ping.isOurs) {
    // Another instance of our service is running — enter client mode
    process.stderr.write(
      `[chrome-agent-bridge] 检测到已有实例运行，进入客户端模式（共享 HTTP Server）\n`,
    );
    return { dataReader: new RemoteDataStore(HTTP_PORT), httpServer: null };
  }

  // Not our service or not responding — can't proceed
  process.stderr.write(
    `[chrome-agent-bridge] 错误: 端口 ${HTTP_PORT} 被其他程序占用，请手动释放后重试。\n`,
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const { dataReader, httpServer } = await startHttpServer();

  // Initialize MCP Server with stdio transport
  const mcpServer = new McpServer({
    name: 'chrome-agent-bridge',
    version: '0.1.2',
  });

  registerTools(mcpServer, dataReader);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  // Graceful shutdown — release port when process exits
  const shutdown = () => {
    if (httpServer) {
      httpServer.stop().catch(() => {});
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGHUP', shutdown);
}

main().catch((err) => {
  process.stderr.write(`[chrome-agent-bridge] 启动失败: ${String(err)}\n`);
  process.exit(1);
});
