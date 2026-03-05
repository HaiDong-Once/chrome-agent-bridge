import * as http from 'node:http';
import type { CapturedElementData, CapturedElementSummary } from '@chrome-agent-bridge/shared';

/**
 * A DataStore implementation that proxies all reads to the remote HTTP Server.
 * Used when this process is in "client mode" (another process owns the HTTP Server).
 */
export class RemoteDataStore {
  constructor(private readonly port: number) {}

  private fetch(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port: this.port, path, method: 'GET', timeout: 3000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
              if (res.statusCode === 200) resolve(body);
              else resolve(null);
            } catch { resolve(null); }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  async getById(id: string): Promise<CapturedElementData | null> {
    return this.fetch(`/data/id/${id}`);
  }

  async getLatest(): Promise<CapturedElementData | null> {
    return this.fetch('/data/latest');
  }

  async list(): Promise<CapturedElementSummary[]> {
    return (await this.fetch('/data/list')) ?? [];
  }
}
