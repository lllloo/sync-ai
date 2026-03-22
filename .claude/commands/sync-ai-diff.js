'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOME = os.homedir();


// ─── 工具函式 ─────────────────────────────────────────────

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
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
function scanMdFiles(dir) {
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

  const same = deepEqual(repoRaw, localRaw);

  let diff = '';
  if (!same) {
    const repoLines  = stableStringify(repoRaw).split('\n');
    const localLines = stableStringify(localRaw).split('\n');
    diff = computeLcsDiff(repoLines, localLines).join('\n');
  }

  return { same, diff };
}

async function diffSkills() {
  const lockPath = path.join(REPO_ROOT, 'skills-lock.json');
  let lockData = { version: 1, skills: {} };
  try { lockData = JSON.parse(readFileSafe(lockPath) ?? '{}'); } catch {}
  if (!lockData.skills) lockData.skills = {};

  let installedSet = new Set();
  let warning = null;
  try {
    const out = execSync('npx skills list -g --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const skills = JSON.parse(out);
    for (const skill of skills) {
      // 只計入套件型 skill（路徑在 .agents/ 下），排除自行建立的（.claude/skills/）
      if (skill.path && skill.path.includes('.agents')) installedSet.add(skill.name);
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

// 通用目錄比對：repoSubdir 為 claude/ 下的子目錄名（如 'agents'、'commands'）
function diffDirectory(repoSubdir) {
  const repoDir  = path.join(REPO_ROOT, 'claude', repoSubdir);
  const localDir = path.join(HOME, '.claude', repoSubdir);

  const repoFiles  = scanMdFiles(repoDir);
  const localFiles = scanMdFiles(localDir);

  const repoOnly = [], localOnly = [], conflicts = [];

  for (const [rel, content] of repoFiles) {
    if (!localFiles.has(rel)) {
      repoOnly.push(rel);
    } else if (localFiles.get(rel) !== content) {
      const diffLines = computeLcsDiff(content.split('\n'), localFiles.get(rel).split('\n'));
      const changedCount = diffLines.filter(l => l.startsWith('- ') || l.startsWith('+ ')).length;
      let diffText = diffLines.slice(0, 10).join('\n');
      if (changedCount > 10) diffText += `\n...共 ${changedCount} 行差異`;
      conflicts.push({ path: rel, diff: diffText });
    }
  }
  for (const [rel] of localFiles) {
    if (!repoFiles.has(rel)) localOnly.push(rel);
  }

  const result = {
    same: repoOnly.length === 0 && localOnly.length === 0 && conflicts.length === 0,
    repoOnly,
    localOnly,
    conflicts,
  };

  return result;
}

// ─── 主程式 ───────────────────────────────────────────────

async function main() {
  const [r1, r2, r3] = await Promise.allSettled([
    diffClaudeMd(),
    diffSettingsJson(),
    diffSkills(),
  ]);

  const pick = r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? String(r.reason) };

  const result = {
    claudeMd:     pick(r1),
    settingsJson: pick(r2),
    skills:       pick(r3),
    agents:       diffDirectory('agents'),
    commands:     diffDirectory('commands'),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ fatalError: err.message }) + '\n');
});
