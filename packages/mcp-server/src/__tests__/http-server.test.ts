import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { HttpServer } from '../http-server';
import { DataStore } from '../data-store';

function makeValidCaptureBody() {
  return {
    id: '',
    timestamp: Date.now(),
    url: 'https://example.com',
    title: 'Example Page',
    element: {
      tagName: 'div',
      html: '<div>hello</div>',
      text: 'hello',
      classes: ['test'],
      id: null,
      attributes: {},
      domPath: 'body > div',
    },
    styles: {
      computed: { color: 'red' },
      matched: [],
    },
    screenshot: null,
  };
}

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            body: raw ? JSON.parse(raw) : null,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('HttpServer', () => {
  let server: HttpServer;
  let dataStore: DataStore;
  const TEST_PORT = 0; // Use random available port
  let actualPort: number;

  beforeEach(async () => {
    dataStore = new DataStore();
    server = new HttpServer(dataStore);
    // Start on port 0 to get a random available port
    await server.start(0);
    // Get the actual port assigned
    actualPort = (server as any).server.address().port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('GET /ping should return 200 with status ok', async () => {
    const res = await request(actualPort, 'GET', '/ping');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('number');
  });

  it('GET /ping should include CORS headers', async () => {
    const res = await request(actualPort, 'GET', '/ping');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('OPTIONS should return 204 with CORS headers', async () => {
    const res = await request(actualPort, 'OPTIONS', '/capture');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('POST /capture with valid data should return 200 with id', async () => {
    const res = await request(actualPort, 'POST', '/capture', makeValidCaptureBody());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /capture should store data in DataStore', async () => {
    const res = await request(actualPort, 'POST', '/capture', makeValidCaptureBody());
    expect(res.body.success).toBe(true);
    const stored = dataStore.getById(res.body.id);
    expect(stored).not.toBeNull();
    expect(stored!.url).toBe('https://example.com');
  });

  it('POST /capture with invalid data should return 400', async () => {
    const res = await request(actualPort, 'POST', '/capture', { bad: 'data' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  it('POST /capture with invalid JSON should return 400', async () => {
    // Send raw invalid JSON
    const res = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: actualPort,
          path: '/capture',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (chunk: Buffer) => chunks.push(chunk));
          r.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            resolve({ status: r.statusCode!, body: JSON.parse(raw) });
          });
        },
      );
      req.on('error', reject);
      req.write('not valid json{{{');
      req.end();
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid JSON');
  });

  it('POST /capture response should include CORS headers', async () => {
    const res = await request(actualPort, 'POST', '/capture', makeValidCaptureBody());
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('unknown route should return 404', async () => {
    const res = await request(actualPort, 'GET', '/unknown');
    expect(res.status).toBe(404);
  });

  it('should bind to localhost (127.0.0.1)', async () => {
    const addr = (server as any).server.address();
    expect(addr.address).toBe('127.0.0.1');
  });
});
