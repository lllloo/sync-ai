'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOME = os.homedir();
const DEVICE_SPECIFIC_KEYS = ['model', 'effortLevel', 'statusLine'];

// ─── 工具函式 ─────────────────────────────────────────────

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
}

// LCS DP diff，回傳行陣列，每行前綴 '  '（context）、'- '（a only）、'+ '（b only）
function computeLcsDiff(aLines, bLines) {
  const m = aLines.length, n = bLines.length;
  // 建立 DP 表
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Uint32Array(n + 1);
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aLines[i - 1] === bLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // 回溯
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

  // 加入 context（前後各 3 行），只輸出 diff 附近的行
  const CONTEXT = 3;
  const result = [];
  const isDiff = ops.map(o => o.t !== ' ');

  for (let k = 0; k < ops.length; k++) {
    const nearby = isDiff.slice(Math.max(0, k - CONTEXT), Math.min(ops.length, k + CONTEXT + 1)).some(Boolean);
    if (nearby) result.push((ops[k].t === ' ' ? '  ' : ops[k].t + ' ') + ops[k].l);
  }
  return result;
}

// key 排序 JSON stringify，使比對不受 key 順序影響
function stableStringify(obj, indent = 2) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj))
    return JSON.stringify(obj, null, indent);
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  // 遞迴處理值（對巢狀物件也排序 key）
  const replacer = (key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const s = {};
      for (const k of Object.keys(val).sort()) s[k] = val[k];
      return s;
    }
    return val;
  };
  return JSON.stringify(sorted, replacer, indent);
}

// Deep equal（key 順序無關、陣列以 set 方式比較）
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // Set 比較（JSON stringify 作為 key）
    const setA = new Set(a.map(x => JSON.stringify(x)));
    const setB = new Set(b.map(x => JSON.stringify(x)));
    if (setA.size !== setB.size) return false;
    for (const x of setA) if (!setB.has(x)) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join('\0') !== kb.join('\0')) return false;
    return ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// 遞迴掃描 agents 目錄，回傳 Map<relPath, content>
function scanAgents(dir) {
  const result = new Map();
  if (!fs.existsSync(dir)) return result;

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        const rel = path.relative(dir, full).replace(/\\/g, '/');
        result.set(rel, fs.readFileSync(full, 'utf8'));
      }
    }
  }
  walk(dir);
  return result;
}

// agents 群組化：某 package 下所有差異同類型且無衝突 → package 單位
function groupAgents(repoOnly, localOnly, conflicts) {
  const pkgOf = p => p.includes('/') ? p.split('/')[0] : '';

  // 收集所有涉及的 package
  const pkgs = new Set([
    ...repoOnly.map(pkgOf),
    ...localOnly.map(pkgOf),
    ...conflicts.map(c => pkgOf(c.path)),
  ]);

  const groups = [];
  const processed = new Set();

  for (const pkg of pkgs) {
    if (pkg === '') continue; // 根目錄直接放的檔案，逐檔處理

    const pRepo = repoOnly.filter(p => pkgOf(p) === pkg);
    const pLocal = localOnly.filter(p => pkgOf(p) === pkg);
    const pConflicts = conflicts.filter(c => pkgOf(c.path) === pkg);

    const canGroup = pConflicts.length === 0 &&
      (pRepo.length === 0 || pLocal.length === 0);

    if (canGroup && (pRepo.length > 0 || pLocal.length > 0)) {
      const type = pRepo.length > 0 ? 'repoOnly' : 'localOnly';
      const files = type === 'repoOnly' ? pRepo : pLocal;
      groups.push({ level: 'package', package: pkg, type, files });
      files.forEach(f => processed.add(f));
      pConflicts.forEach(c => processed.add(c.path));
    } else {
      // 逐檔
      for (const f of pRepo) {
        if (!processed.has(f)) groups.push({ level: 'file', path: f, type: 'repoOnly' });
        processed.add(f);
      }
      for (const f of pLocal) {
        if (!processed.has(f)) groups.push({ level: 'file', path: f, type: 'localOnly' });
        processed.add(f);
      }
      for (const c of pConflicts) {
        if (!processed.has(c.path)) groups.push({ level: 'file', path: c.path, type: 'conflict', diff: c.diff });
        processed.add(c.path);
      }
    }
  }

  // 根目錄直接放的檔案（沒有 package 子目錄）
  for (const f of repoOnly) {
    if (!processed.has(f)) { groups.push({ level: 'file', path: f, type: 'repoOnly' }); processed.add(f); }
  }
  for (const f of localOnly) {
    if (!processed.has(f)) { groups.push({ level: 'file', path: f, type: 'localOnly' }); processed.add(f); }
  }
  for (const c of conflicts) {
    if (!processed.has(c.path)) { groups.push({ level: 'file', path: c.path, type: 'conflict', diff: c.diff }); processed.add(c.path); }
  }

  return groups;
}

// ─── 比對函式 ─────────────────────────────────────────────

async function diffClaudeMd() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
  const localPath = path.join(HOME, '.claude', 'CLAUDE.md');

  const repoContent  = readFileSafe(repoPath)  ?? '';
  const localContent = readFileSafe(localPath) ?? '';
  const same = repoContent === localContent;

  let diff = '';
  if (!same) {
    const lines = computeLcsDiff(repoContent.split('\n'), localContent.split('\n'));
    diff = lines.join('\n');
  }

  return { same, diff, repoContent, localContent };
}

async function diffSettingsJson() {
  const repoPath  = path.join(REPO_ROOT, 'claude', 'settings.json');
  const localPath = path.join(HOME, '.claude', 'settings.json');

  let repoRaw = {}, localRaw = {};
  try { repoRaw  = JSON.parse(readFileSafe(repoPath)  ?? '{}'); } catch {}
  try { localRaw = JSON.parse(readFileSafe(localPath) ?? '{}'); } catch {}

  // 保存裝置特定欄位
  const deviceKeys = {};
  for (const k of DEVICE_SPECIFIC_KEYS) deviceKeys[k] = localRaw[k] ?? null;

  // 移除裝置特定欄位後比對
  const repoClean  = Object.fromEntries(Object.entries(repoRaw).filter(([k]) => !DEVICE_SPECIFIC_KEYS.includes(k)));
  const localClean = Object.fromEntries(Object.entries(localRaw).filter(([k]) => !DEVICE_SPECIFIC_KEYS.includes(k)));

  const same = deepEqual(repoClean, localClean);

  let diff = '';
  if (!same) {
    const repoLines  = stableStringify(repoClean).split('\n');
    const localLines = stableStringify(localClean).split('\n');
    diff = computeLcsDiff(repoLines, localLines).join('\n');
  }

  return { same, diff, deviceKeys };
}

async function diffSkills() {
  const lockPath = path.join(REPO_ROOT, 'skills-lock.json');
  let lockData = { version: 1, skills: {} };
  try { lockData = JSON.parse(readFileSafe(lockPath) ?? '{}'); } catch {}
  if (!lockData.skills) lockData.skills = {};

  let installedSet = new Set();
  let warning = null;
  try {
    const out = execSync('npx skills list -g --agent claude-code', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const clean = stripAnsi(out);
    for (const line of clean.split('\n')) {
      // 2 spaces indent + skill-name + whitespace + path
      const m = line.match(/^  ([a-z][a-z0-9-]+)\s+/);
      if (m) installedSet.add(m[1]);
    }
  } catch (e) {
    warning = `無法執行 npx skills list：${e.message.split('\n')[0]}`;
  }

  const lockOnly  = Object.keys(lockData.skills).filter(k => !installedSet.has(k));
  const localOnly = [...installedSet].filter(k => !lockData.skills[k]);

  return {
    same: lockOnly.length === 0 && localOnly.length === 0,
    lockOnly,
    localOnly,
    lockData,
    ...(warning ? { warning } : {}),
  };
}

async function diffAgents() {
  const repoDir  = path.join(REPO_ROOT, 'claude', 'agents');
  const localDir = path.join(HOME, '.claude', 'agents');

  const repoAgents  = scanAgents(repoDir);
  const localAgents = scanAgents(localDir);

  const repoOnly = [], localOnly = [], conflicts = [];

  for (const [rel, content] of repoAgents) {
    if (!localAgents.has(rel)) {
      repoOnly.push(rel);
    } else if (localAgents.get(rel) !== content) {
      const diffLines = computeLcsDiff(content.split('\n'), localAgents.get(rel).split('\n'));
      const changedCount = diffLines.filter(l => l.startsWith('- ') || l.startsWith('+ ')).length;
      let diffText = diffLines.slice(0, 10).join('\n');
      if (changedCount > 10) diffText += `\n...共 ${changedCount} 行差異`;
      conflicts.push({ path: rel, diff: diffText });
    }
  }
  for (const [rel] of localAgents) {
    if (!repoAgents.has(rel)) localOnly.push(rel);
  }

  const groups = groupAgents(repoOnly, localOnly, conflicts);

  return {
    same: repoOnly.length === 0 && localOnly.length === 0 && conflicts.length === 0,
    repoOnly,
    localOnly,
    conflicts,
    groups,
  };
}

// ─── 主程式 ───────────────────────────────────────────────

async function main() {
  const [r1, r2, r3, r4] = await Promise.allSettled([
    diffClaudeMd(),
    diffSettingsJson(),
    diffSkills(),
    diffAgents(),
  ]);

  const pick = r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? String(r.reason) };

  const result = {
    claudeMd:     pick(r1),
    settingsJson: pick(r2),
    skills:       pick(r3),
    agents:       pick(r4),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ fatalError: err.message }) + '\n');
});
