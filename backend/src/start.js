/**
 * start.js — dev-friendly launcher:
 *   1. pnpm install                          — picks up any new deps Claude added
 *   2. vite build --watch --mode development — builds frontend with source annotations,
 *                                              then watches for changes
 *                                              (waits for first build before starting Express)
 *   3. node --watch server                   — starts Express, auto-restarts on backend changes
 *
 * No Stop/Start needed after code edits:
 *   Frontend change → Vite rebuilds in background → refresh browser
 *   Backend  change → node --watch restarts Express automatically
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../');

// 1. Install deps (fast no-op when lockfile unchanged; picks up new packages)
// CI=true tells pnpm to proceed non-interactively (no TTY in container).
console.log('[start] Installing dependencies…');
execSync('pnpm install', { cwd: root, stdio: 'inherit', env: { ...process.env, CI: 'true' } });

// 2. Spawn vite build --watch --mode development; wait for first build before starting Express.
//    --mode development activates the AirForge source-annotation Babel plugin so that
//    data-af-file/line/component attributes are injected into the HTML output,
//    enabling precise element picking in the preview overlay.
//    vite build --watch emits "built in Xs" after each completed build.
console.log('[start] Building frontend…');
const viteWatch = spawn(
  'pnpm', ['--filter', 'frontend', 'exec', 'vite', 'build', '--watch', '--mode', 'development'],
  { cwd: root, stdio: ['inherit', 'pipe', 'pipe'] },
);

// Forward Vite output to parent stdout/stderr while also scanning for the
// "built in" signal that indicates the first build completed.
let firstBuildDone = false;
let firstBuildResolve;
const firstBuild = new Promise((resolve, reject) => {
  firstBuildResolve = resolve;
  viteWatch.on('exit', (code) => {
    if (!firstBuildDone) reject(new Error(`Vite exited early with code ${code}`));
  });
});

viteWatch.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!firstBuildDone && chunk.toString().includes('built in')) {
    firstBuildDone = true;
    firstBuildResolve();
  }
});
viteWatch.stderr.on('data', (chunk) => process.stderr.write(chunk));

await firstBuild;
console.log('[start] Frontend ready. Starting server…');

// 3. Start Express with --watch (auto-restarts on any imported .js change).
//    --import proxy-bootstrap.js routes Node.js fetch through the egress proxy
//    before any server code runs. This file is system-managed; do not remove it.
const backend = spawn(
  'node', ['--import', './backend/src/proxy-bootstrap.js', '--watch', 'backend/src/server.js'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[start] App running. Watching for changes…');

// Propagate shutdown to both children
const cleanup = (sig) => { viteWatch.kill(sig); backend.kill(sig); };
process.on('SIGTERM', () => { cleanup('SIGTERM'); process.exit(0); });
process.on('SIGINT',  () => { cleanup('SIGINT');  process.exit(0); });

// If either child crashes (non-zero exit), bring down the other and exit
viteWatch.on('exit', (code) => {
  if (code != null && code !== 0) { backend.kill(); process.exit(code); }
});
backend.on('exit', (code) => {
  if (code != null && code !== 0) { viteWatch.kill(); process.exit(code); }
});
