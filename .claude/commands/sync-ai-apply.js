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

// 完整 LCS diff（不過濾 context），回傳 { t: ' '|'-'|'+', l: string }[]
function computeFullLcsDiff(aLines, bLines) {
  const m = aLines.length, n = bLines.length;
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Uint32Array(n + 1);
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aLines[i - 1] === bLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      ops.push({ t: ' ', l: aLines[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ t: '+', l: bLines[j - 1] }); j--;
    } else {
      ops.push({ t: '-', l: aLines[i - 1] }); i--;
    }
  }
  ops.reverse();
  return ops;
}

// 以 LCS diff 產生含 git 衝突標記的文字
function buildConflictContent(repoLines, localLines, repoLabel, localLabel) {
  const ops = computeFullLcsDiff(repoLines, localLines);
  const output = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === ' ') {
      output.push(ops[i].l);
      i++;
    } else {
      const repoBlock = [], localBlock = [];
      while (i < ops.length && ops[i].t !== ' ') {
        if (ops[i].t === '-') repoBlock.push(ops[i].l);
        else                  localBlock.push(ops[i].l);
        i++;
      }
      output.push(`<<<<<<< ${repoLabel}`);
      output.push(...repoBlock);
      output.push('=======');
      output.push(...localBlock);
      output.push(`>>>>>>> ${localLabel}`);
    }
  }
  return output.join('\n');
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

// ─── conflict-markers ─────────────────────────────────────

function conflictMarkersSettings() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'settings.json');
  const localPath = path.join(HOME, '.claude', 'settings.json');

  let repoRaw = {}, localRaw = {};
  try { repoRaw  = JSON.parse(readFileSafe(repoPath)  ?? '{}'); } catch {}
  try { localRaw = JSON.parse(readFileSafe(localPath) ?? '{}'); } catch {}

  // 移除裝置特定欄位
  const strip = obj => Object.fromEntries(
    Object.entries(obj).filter(([k]) => !DEVICE_SPECIFIC_KEYS.includes(k))
  );

  const content = buildConflictContent(
    stableStringify(strip(repoRaw)).split('\n'),
    stableStringify(strip(localRaw)).split('\n'),
    'repo (claude/settings.json)',
    'local (~/.claude/settings.json)'
  );

  fs.writeFileSync(repoPath, content + '\n', 'utf8');
  return { success: true };
}

function conflictMarkersClaudeMd() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
  const localPath = path.join(HOME, '.claude', 'CLAUDE.md');

  const repoContent  = readFileSafe(repoPath)  ?? '';
  const localContent = readFileSafe(localPath) ?? '';

  const content = buildConflictContent(
    repoContent.split('\n'),
    localContent.split('\n'),
    'repo (claude/CLAUDE.md)',
    'local (~/.claude/CLAUDE.md)'
  );

  fs.writeFileSync(repoPath, content + '\n', 'utf8');
  return { success: true };
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

  const localClean = Object.fromEntries(
    Object.entries(localRaw).filter(([k]) => !DEVICE_SPECIFIC_KEYS.includes(k))
  );
  return { same: deepEqual(repoRaw, localClean) };
}

function checkSameClaudeMd() {
  const repoContent  = readFileSafe(path.join(REPO_ROOT, 'claude', 'CLAUDE.md')) ?? '';
  const localContent = readFileSafe(path.join(HOME, '.claude', 'CLAUDE.md'))     ?? '';
  return { same: repoContent === localContent };
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
  if (action === 'conflict-markers') {
    result = file === 'claude-md' ? conflictMarkersClaudeMd() : conflictMarkersSettings();
  } else if (action === 'check-same') {
    result = file === 'claude-md' ? checkSameClaudeMd() : checkSameSettings();
  } else if (action === 'write-local') {
    result = file === 'claude-md' ? writeLocalClaudeMd() : writeLocalSettings();
  } else {
    result = { error: `Unknown --action: ${action}. 可用值：conflict-markers | check-same | write-local` };
  }
} catch (e) {
  result = { success: false, error: e.message };
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
