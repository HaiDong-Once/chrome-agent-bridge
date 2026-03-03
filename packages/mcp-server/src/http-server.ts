import * as http from 'node:http';
import type { CaptureResponse, CaptureErrorResponse, PingResponse } from '@chrome-agent-bridge/shared';
import type { DataStore } from './data-store.js';
import { validateCapturedElementData } from './validator.js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export class HttpServer {
  private server: http.Server | null = null;

  constructor(private readonly dataStore: DataStore) {}

  /**
   * Start the HTTP server listening on localhost at the given port.
   */
  start(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      this.sendJson(res, 204, null);
      return;
    }

    const url = req.url ?? '/';

    if (req.method === 'GET' && url === '/ping') {
      const response = this.handlePing();
      this.sendJson(res, 200, response);
      return;
    }

    if (req.method === 'POST' && url === '/capture') {
      this.readBody(req)
        .then((body) => this.handleCapture(body))
        .then(({ status, body }) => {
          this.sendJson(res, status, body);
        })
        .catch(() => {
          const errorResponse: CaptureErrorResponse = { success: false, error: 'Invalid JSON' };
          this.sendJson(res, 400, errorResponse);
        });
      return;
    }

    // Unknown route
    this.sendJson(res, 404, { error: 'Not found' });
  }

  /**
   * Handle GET /ping — health check endpoint.
   */
  handlePing(): PingResponse {
    return { status: 'ok', timestamp: Date.now() };
  }

  /**
   * Handle POST /capture — validate and store captured element data.
   */
  handleCapture(body: unknown): { status: number; body: CaptureResponse | CaptureErrorResponse } {
    const validation = validateCapturedElementData(body);

    if (!validation.valid) {
      return {
        status: 400,
        body: { success: false, error: validation.errors.join('; ') },
      };
    }

    const id = this.dataStore.store(body as any);
    return {
      status: 200,
      body: { success: true, id },
    };
  }

  private readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      res.setHeader(key, value);
    }

    if (body === null) {
      res.writeHead(statusCode);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(body));
  }
}
