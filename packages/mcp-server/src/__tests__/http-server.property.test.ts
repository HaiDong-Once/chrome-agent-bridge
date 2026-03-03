/**
 * HTTP Server Property Tests
 * Properties 7, 8
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as http from 'node:http';
import { HttpServer } from '../http-server';
import { DataStore } from '../data-store';
import type { CapturedElementData } from '@chrome-agent-bridge/shared';

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
    classes: fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }),
    id: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    attributes: fc.dictionary(fc.string({ minLength: 1 }), fc.string(), { maxKeys: 3 }),
    domPath: fc.string({ minLength: 1 }),
  }),
  styles: fc.record({
    computed: fc.dictionary(fc.string({ minLength: 1 }), fc.string(), { maxKeys: 3 }),
    matched: fc.array(cssRuleInfoArb, { maxLength: 3 }),
  }),
  screenshot: fc.option(fc.base64String({ maxLength: 50 }), { nil: null }),
});

function httpRequest(
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

describe('Property 7: HTTP /capture data validation correctness', () => {
  /**
   * Validates: Requirements 4.2, 4.3
   * Valid CapturedElementData → 200; invalid data → 400
   */
  let server: HttpServer;
  let dataStore: DataStore;
  let port: number;

  beforeEach(async () => {
    dataStore = new DataStore();
    server = new HttpServer(dataStore);
    await server.start(0);
    port = (server as any).server.address().port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should return 200 for valid CapturedElementData', () => {
    return fc.assert(
      fc.asyncProperty(capturedElementDataArb, async (data) => {
        const res = await httpRequest(port, 'POST', '/capture', data);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.id).toBe('string');
      }),
      { numRuns: 100 },
    );
  });

  it('should return 400 for invalid data', () => {
    // Generate objects that are missing required fields
    const invalidDataArb = fc.oneof(
      fc.record({ bad: fc.string() }),
      fc.constant({}),
      fc.constant({ url: 'test' }), // missing most fields
      fc.record({
        url: fc.string(),
        title: fc.string(),
        // missing element and styles
      }),
    );

    return fc.assert(
      fc.asyncProperty(invalidDataArb, async (data) => {
        const res = await httpRequest(port, 'POST', '/capture', data);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(typeof res.body.error).toBe('string');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 8: HTTP response CORS header invariant', () => {
  /**
   * Validates: Requirements 4.6
   * All responses should have Access-Control-Allow-Origin: *
   */
  let server: HttpServer;
  let dataStore: DataStore;
  let port: number;

  beforeEach(async () => {
    dataStore = new DataStore();
    server = new HttpServer(dataStore);
    await server.start(0);
    port = (server as any).server.address().port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should include CORS headers on all responses', () => {
    const requestArb = fc.oneof(
      fc.constant({ method: 'GET', path: '/ping', body: undefined }),
      fc.constant({ method: 'OPTIONS', path: '/capture', body: undefined }),
      capturedElementDataArb.map((data) => ({
        method: 'POST',
        path: '/capture',
        body: data,
      })),
      fc.constant({ method: 'POST', path: '/capture', body: { invalid: true } }),
    );

    return fc.assert(
      fc.asyncProperty(requestArb, async ({ method, path, body }) => {
        const res = await httpRequest(port, method, path, body);
        expect(res.headers['access-control-allow-origin']).toBe('*');
      }),
      { numRuns: 100 },
    );
  });
});
