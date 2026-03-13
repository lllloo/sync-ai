'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const REPO_ROOT          = path.resolve(__dirname, '..', '..');
const HOME               = os.homedir();
const DEVICE_SPECIFIC_KEYS = ['model', 'effortLevel', 'statusLine'];

// ─── 工具函式 ─────────────────────────────────────────────

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

// key 排序 JSON stringify
function stableStringify(obj) {
  return JSON.stringify(obj, (key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const s = {};
      for (const k of Object.keys(val).sort()) s[k] = val[k];
      return s;
    }
    return val;
  }, 2);
}

// Deep equal（key 順序無關、陣列以 set 方式比較）
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const setA = new Set(a.map(x => JSON.stringify(x)));
    const setB = new Set(b.map(x => JSON.stringify(x)));
    if (setA.size !== setB.size) return false;
    for (const x of setA) if (!setB.has(x)) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join('\0') !== kb.join('\0')) return false;
    return ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// ─── check-same ───────────────────────────────────────────

function checkSameSettings() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'settings.json');
  const localPath = path.join(HOME, '.claude', 'settings.json');

  let repoRaw = {}, localRaw = {};
  try { repoRaw  = JSON.parse(readFileSafe(repoPath)  ?? '{}'); }
  catch { return { same: false, error: 'repo parse error' }; }
  try { localRaw = JSON.parse(readFileSafe(localPath) ?? '{}'); }
  catch { return { same: false, error: 'local parse error' }; }

  const strip = obj => Object.fromEntries(
    Object.entries(obj).filter(([k]) => !DEVICE_SPECIFIC_KEYS.includes(k))
  );
  return { same: deepEqual(strip(repoRaw), strip(localRaw)) };
}

function checkSameClaudeMd() {
  const repoContent  = readFileSafe(path.join(REPO_ROOT, 'claude', 'CLAUDE.md')) ?? '';
  const localContent = readFileSafe(path.join(HOME, '.claude', 'CLAUDE.md'))     ?? '';
  return { same: repoContent.replace(/\r\n/g, '\n') === localContent.replace(/\r\n/g, '\n') };
}

// ─── write-local ──────────────────────────────────────────

function writeLocalSettings() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'settings.json');
  const localPath = path.join(HOME, '.claude', 'settings.json');

  let merged = {}, localRaw = {};
  try { merged  = JSON.parse(readFileSafe(repoPath)  ?? '{}'); }
  catch { return { success: false, error: 'repo parse error' }; }
  try { localRaw = JSON.parse(readFileSafe(localPath) ?? '{}'); } catch {}

  // 將本機裝置特定欄位注入合併結果
  for (const k of DEVICE_SPECIFIC_KEYS) {
    if (localRaw[k] !== undefined) merged[k] = localRaw[k];
  }

  fs.writeFileSync(localPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return { success: true };
}

function writeLocalClaudeMd() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
  const localPath = path.join(HOME, '.claude', 'CLAUDE.md');
  const content   = readFileSafe(repoPath);
  if (content === null) return { success: false, error: 'repo file not found' };
  fs.writeFileSync(localPath, content, 'utf8');
  return { success: true };
}

// ─── 主程式 ───────────────────────────────────────────────

const args   = process.argv.slice(2);
const getArg = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const action = getArg('--action');
const file   = getArg('--file') ?? 'settings-json'; // 預設 settings-json

let result;
try {
  if (action === 'check-same') {
    result = file === 'claude-md' ? checkSameClaudeMd() : checkSameSettings();
  } else if (action === 'write-local') {
    result = file === 'claude-md' ? writeLocalClaudeMd() : writeLocalSettings();
  } else {
    result = { error: `Unknown --action: ${action}. 可用值：check-same | write-local` };
  }
} catch (e) {
  result = { success: false, error: e.message };
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
