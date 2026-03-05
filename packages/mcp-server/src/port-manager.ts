import * as http from 'node:http';
import { execSync } from 'node:child_process';

const PING_TIMEOUT = 2000;

interface PingResult {
  alive: boolean;
  isOurs: boolean;
}

/**
 * Ping the local HTTP server to check if it's our chrome-agent-bridge service.
 */
export function pingServer(port: number): Promise<PingResult> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/ping', method: 'GET', timeout: PING_TIMEOUT },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            // Our server responds with { status: 'ok', timestamp: number }
            resolve({ alive: true, isOurs: body?.status === 'ok' && typeof body?.timestamp === 'number' });
          } catch {
            resolve({ alive: true, isOurs: false });
          }
        });
      },
    );
    req.on('error', () => resolve({ alive: false, isOurs: false }));
    req.on('timeout', () => { req.destroy(); resolve({ alive: false, isOurs: false }); });
    req.end();
  });
}

/**
 * Kill the process occupying the given port.
 * Returns true if a process was found and killed.
 */
export function killProcessOnPort(port: number): boolean {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
      const pid = output.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) {
        execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
        return true;
      }
    } else {
      // macOS / Linux
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try { process.kill(Number(pid), 'SIGTERM'); } catch { /* already dead */ }
      }
      return pids.length > 0;
    }
  } catch {
    // No process found or command failed
  }
  return false;
}
