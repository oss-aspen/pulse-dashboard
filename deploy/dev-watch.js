// Polling file watcher for dev containers where bind-mount file events don't propagate
// (e.g. macOS + Podman). Zero dependencies. Restarts `node server/index.js` on change.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXT = new Set(['.js', '.cjs', '.mjs', '.json']);
const SKIP = new Set(['node_modules', 'data', 'client']);
const INTERVAL = 1000;

function roots() {
  const r = ['server', 'platform', 'shared/server'];
  try {
    for (const m of fs.readdirSync(path.join(ROOT, 'modules'))) r.push(path.join('modules', m, 'server'), path.join('modules', m, 'module.json'));
  } catch { /* no modules dir */ }
  return r.map((p) => path.join(ROOT, p));
}

function scan(dir, out, seen) {
  try {
    const st = fs.statSync(dir);
    if (st.isFile()) { out.set(dir, st.mtimeMs); return; }
  } catch { return; }
  let real;
  try { real = fs.realpathSync(dir); } catch { return; }
  if (seen.has(real)) return;
  seen.add(real);
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) scan(p, out, seen);
    else if (EXT.has(path.extname(name))) out.set(p, st.mtimeMs);
  }
}

function snapshot() {
  const out = new Map();
  const seen = new Set();
  for (const r of roots()) scan(r, out, seen);
  return out;
}

let child = null;
let stoppingChild = null;
function start() {
  child = spawn(process.execPath, ['server/index.js'], { stdio: 'inherit' });
  const me = child;
  me.on('exit', (code, sig) => {
    if (child === me) {
      child = null;
      console.log(`[dev-watch] server exited (${sig || code}); waiting for a change`);
    }
  });
}

function stop(cb) {
  if (!child) return cb();
  const me = child;
  child = null;
  stoppingChild = me;
  const timer = setTimeout(() => me.kill('SIGKILL'), 5000);
  me.once('exit', () => { clearTimeout(timer); stoppingChild = null; cb(); });
  me.kill('SIGTERM');
}

let restarting = false;
let stopping = false;
let prev = snapshot();
start();
setInterval(() => {
  if (restarting) return;
  const cur = snapshot();
  let changed = null;
  for (const [p, m] of cur) if (prev.get(p) !== m) { changed = p; break; }
  if (!changed) for (const p of prev.keys()) if (!cur.has(p)) { changed = p; break; }
  prev = cur;
  if (changed) {
    restarting = true;
    console.log(`[dev-watch] change: ${path.relative(ROOT, changed)}, restarting`);
    stop(() => { restarting = false; if (!stopping) start(); });
  }
}, INTERVAL);

for (const s of ['SIGTERM', 'SIGINT']) {
  process.on(s, () => {
    if (stopping) return;
    stopping = true;
    // child is null while a restart is in flight; wait for the stopping child instead.
    if (stoppingChild) { stoppingChild.once('exit', () => process.exit(0)); return; }
    stop(() => process.exit(0));
  });
}
