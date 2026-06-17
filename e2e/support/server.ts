import { spawn, type ChildProcess } from 'node:child_process';
import { LIVE, PROD_WORKER_URL } from './config.js';

// Boots the Vite dev server once for the whole test run and tears it down at
// the end. We use a dedicated, strict port so we never collide with a dev
// server the developer already has running on 5173.
const HOST = '127.0.0.1';
const PORT = Number(process.env.E2E_PORT ?? 5174);

export const BASE_URL = `http://${HOST}:${PORT}`;

let proc: ChildProcess | null = null;

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Dev server did not come up at ${BASE_URL} within ${timeoutMs}ms`);
}

export async function startServer(): Promise<void> {
  // Reuse an already-running server (e.g. a developer ran `npm run dev` on this
  // port) instead of spawning a duplicate.
  if (await isUp()) return;

  // In live mode the frontend talks to the deployed Worker (real Gemini/Azure)
  // and exposes the E2E cleanup seam. In the hermetic (mocked) profile there is
  // no real Firestore membership, so VITE_E2E_MOCK tells useMember to derive
  // membership from the seeded local record instead of the live listener.
  // Vite picks up VITE_-prefixed vars from the process environment.
  const env = LIVE
    ? { ...process.env, VITE_API_BASE: PROD_WORKER_URL, VITE_E2E: '1' }
    : { ...process.env, VITE_E2E_MOCK: '1' };

  proc = spawn(
    'npm',
    ['run', 'dev', '--', '--host', HOST, '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], env },
  );

  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', (d: Buffer) => {
    const text = d.toString();
    if (/error/i.test(text)) process.stderr.write(`[vite] ${text}`);
  });

  await waitForServer();
}

export async function stopServer(): Promise<void> {
  if (!proc) return;
  const p = proc;
  proc = null;
  await new Promise<void>((resolve) => {
    p.once('exit', () => resolve());
    p.kill('SIGTERM');
    // Hard kill if it lingers.
    setTimeout(() => {
      p.kill('SIGKILL');
      resolve();
    }, 4000);
  });
}
