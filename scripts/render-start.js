import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'backend');
const backendPort = process.env.BACKEND_PORT || '4000';
const externalUrl = process.env.RENDER_EXTERNAL_URL;
let externalOrigin;
try {
  const parsedUrl = externalUrl ? new URL(externalUrl) : undefined;
  if (parsedUrl?.protocol === 'https:') externalOrigin = parsedUrl.origin;
} catch {
  externalOrigin = undefined;
}
const backendEnv = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: backendPort
};

if (process.env.NODE_ENV !== 'production') {
  console.error('Render launcher requires NODE_ENV=production.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured before starting the Render service.');
  process.exit(1);
}

if (!externalOrigin) {
  console.error('Render must provide a valid HTTPS RENDER_EXTERNAL_URL.');
  process.exit(1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const migration = spawnSync(npm, ['run', 'prisma:migrate:deploy'], {
  cwd: backendDir,
  env: backendEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (migration.error) {
  console.error('Could not run database migrations:', migration.error.message);
  process.exit(1);
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

let stopping = false;
let backend;
let frontend;

function stop(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of [backend, frontend]) {
    if (child && child.exitCode === null) child.kill(signal);
  }
  const pending = [backend, frontend].filter((child) => child && child.exitCode === null);
  if (pending.length === 0) process.exit(exitCode);
  let remaining = pending.length;
  for (const child of pending) {
    child.once('exit', () => {
      remaining -= 1;
      if (remaining === 0) process.exit(exitCode);
    });
  }
  setTimeout(() => process.exit(exitCode || 1), 10_000).unref();
}

function monitor(child, name) {
  child.once('error', (error) => {
    console.error(`${name} failed to start:`, error.message);
    stop('SIGTERM', 1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(`${name} exited (code=${code}, signal=${signal}). Stopping the service.`);
    stop('SIGTERM', 1);
  });
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

backend = spawn(process.execPath, [path.join(backendDir, 'dist', 'index.js')], {
  cwd: backendDir,
  env: backendEnv,
  stdio: 'inherit'
});
monitor(backend, 'Backend API');

frontend = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root,
  env: {
    ...process.env,
    PORT: process.env.PORT || '10000',
    BACKEND_PORT: backendPort,
    BACKEND_HOST: '127.0.0.1'
  },
  stdio: 'inherit'
});
monitor(frontend, 'Frontend server');
