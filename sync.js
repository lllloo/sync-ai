#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');


const REPO_ROOT = __dirname;
const HOME = os.homedir();
const CLAUDE_HOME = path.join(HOME, '.claude');
const AGENTS_HOME = path.join(HOME, '.agents');
const DEVICE_FIELDS = ['model', 'effortLevel'];

const mode = process.argv[2];
if (mode !== 'to-repo' && mode !== 'to-local') {
  console.error('用法: node sync.js to-repo|to-local');
  process.exit(1);
}

// ── Utilities ──────────────────────────────────────────────────────────────

function run(cmd) {
  return spawnSync(cmd, { shell: true, cwd: REPO_ROOT, encoding: 'utf8' });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  const srcContent = fs.readFileSync(src);
  if (fs.existsSync(dest) && srcContent.equals(fs.readFileSync(dest))) return false;
  fs.writeFileSync(dest, srcContent);
  return true;
}

// 取得目錄下所有檔案的相對路徑（正斜線）
function getFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...getFiles(path.join(dir, entry.name), rel));
    } else {
      result.push(rel);
    }
  }
  return result;
}

function matchExclude(rel, pattern) {
  if (pattern.endsWith('*')) return rel.startsWith(pattern.slice(0, -1));
  return rel === pattern;
}

// 整目錄鏡像：以 src 為準，dest 多餘的刪掉
function mirrorDir(src, dest, excludePatterns = []) {
  const changed = [];
  if (!fs.existsSync(src)) return changed;
  ensureDir(dest);

  const srcFiles = new Set(
    getFiles(src).filter(rel => !excludePatterns.some(p => matchExclude(rel, p)))
  );

  // 複製 src → dest（有變動才寫入）
  for (const rel of srcFiles) {
    const srcFile = path.join(src, rel);
    const destFile = path.join(dest, rel);
    ensureDir(path.dirname(destFile));
    const srcContent = fs.readFileSync(srcFile);
    const destExists = fs.existsSync(destFile);
    if (!destExists || !srcContent.equals(fs.readFileSync(destFile))) {
      fs.writeFileSync(destFile, srcContent);
      changed.push(rel);
    }
  }

  // 刪除 dest 多餘的檔案
  if (fs.existsSync(dest)) {
    for (const rel of getFiles(dest)) {
      if (!srcFiles.has(rel)) {
        fs.rmSync(path.join(dest, rel));
        changed.push(`[刪除] ${rel}`);
      }
    }
    // 清理空目錄
    cleanEmptyDirs(dest);
  }

  return changed;
}

function cleanEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      cleanEmptyDirs(sub);
      if (fs.readdirSync(sub).length === 0) fs.rmdirSync(sub);
    }
  }
}

// ── Settings.json ──────────────────────────────────────────────────────────

function mergeSettingsJson(mode) {
  const localPath = path.join(CLAUDE_HOME, 'settings.json');
  const repoPath = path.join(REPO_ROOT, 'claude', 'settings.json');

  if (mode === 'to-repo') {
    if (!fs.existsSync(localPath)) return false;
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    for (const field of DEVICE_FIELDS) delete local[field];
    ensureDir(path.dirname(repoPath));
    const content = JSON.stringify(local, null, 2) + '\n';
    if (fs.existsSync(repoPath) && fs.readFileSync(repoPath, 'utf8') === content) return false;
    fs.writeFileSync(repoPath, content);
    return true;
  } else {
    // to-local：repo 為基礎，保留本機裝置欄位
    if (!fs.existsSync(repoPath)) return false;
    const repo = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
    const deviceValues = {};
    if (fs.existsSync(localPath)) {
      const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      for (const field of DEVICE_FIELDS) {
        if (local[field] !== undefined) deviceValues[field] = local[field];
      }
    }
    const merged = { ...repo, ...deviceValues };
    ensureDir(path.dirname(localPath));
    fs.writeFileSync(localPath, JSON.stringify(merged, null, 2) + '\n');
    return true;
  }
}

// ── Skills ─────────────────────────────────────────────────────────────────

function syncSkills(mode) {
  const globalLockPath = path.join(AGENTS_HOME, '.skill-lock.json');
  const repoLockPath = path.join(REPO_ROOT, 'skills-lock.json');
  const changed = [];

  if (mode === 'to-repo') {
    if (!fs.existsSync(globalLockPath)) {
      console.log('  ⚠️  ~/.agents/.skill-lock.json 不存在，略過 skills 同步');
      return changed;
    }
    const global = JSON.parse(fs.readFileSync(globalLockPath, 'utf8'));
    const skills = {};
    for (const [name, info] of Object.entries(global.skills || {})) {
      skills[name] = { source: info.source, sourceType: info.sourceType };
    }
    const content = JSON.stringify({ version: 1, skills }, null, 2) + '\n';
    if (!fs.existsSync(repoLockPath) || fs.readFileSync(repoLockPath, 'utf8') !== content) {
      fs.writeFileSync(repoLockPath, content);
      changed.push(`skills-lock.json (${Object.keys(skills).length} skills)`);
    }
    return changed;
  } else {
    // to-local：找出 repo 有但本機沒裝的 skill
    if (!fs.existsSync(repoLockPath)) {
      console.log('  ⚠️  skills-lock.json 不存在，略過 skills 同步');
      return changed;
    }
    const repo = JSON.parse(fs.readFileSync(repoLockPath, 'utf8'));
    const localSkills = new Set();
    if (fs.existsSync(globalLockPath)) {
      const global = JSON.parse(fs.readFileSync(globalLockPath, 'utf8'));
      for (const name of Object.keys(global.skills || {})) localSkills.add(name);
    }
    for (const [name, info] of Object.entries(repo.skills || {})) {
      if (!localSkills.has(name)) {
        console.log(`  📦 安裝 skill: ${name} (${info.source})`);
        const result = run(`npx skills add -g ${info.source} -s ${name} -y`);
        if (result.status === 0) {
          changed.push(`skill: ${name}`);
          console.log(`  ✅ ${name} 安裝完成`);
        } else {
          console.error(`  ❌ ${name} 安裝失敗：${result.stderr || result.stdout}`);
        }
      }
    }
    return changed;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🔄 sync-ai ${mode === 'to-repo' ? '本機 → repo' : 'repo → 本機'}\n`);

  const changes = [];

  if (mode === 'to-repo') {
    if (copyFile(path.join(CLAUDE_HOME, 'CLAUDE.md'), path.join(REPO_ROOT, 'claude', 'CLAUDE.md')))
      changes.push('claude/CLAUDE.md');

    if (mergeSettingsJson('to-repo'))
      changes.push('claude/settings.json');

    if (copyFile(path.join(CLAUDE_HOME, 'statusline.sh'), path.join(REPO_ROOT, 'claude', 'statusline.sh')))
      changes.push('claude/statusline.sh');

    for (const f of mirrorDir(
      path.join(CLAUDE_HOME, 'agents'),
      path.join(REPO_ROOT, 'claude', 'agents'),
    )) changes.push(`claude/agents/${f}`);

    for (const f of mirrorDir(
      path.join(CLAUDE_HOME, 'commands'),
      path.join(REPO_ROOT, 'claude', 'commands'),
      ['sync-ai*'],
    )) changes.push(`claude/commands/${f}`);

    for (const f of syncSkills('to-repo')) changes.push(f);
  } else {
    if (copyFile(path.join(REPO_ROOT, 'claude', 'CLAUDE.md'), path.join(CLAUDE_HOME, 'CLAUDE.md')))
      changes.push('~/.claude/CLAUDE.md');

    if (mergeSettingsJson('to-local'))
      changes.push('~/.claude/settings.json');

    if (copyFile(path.join(REPO_ROOT, 'claude', 'statusline.sh'), path.join(CLAUDE_HOME, 'statusline.sh')))
      changes.push('~/.claude/statusline.sh');

    for (const f of mirrorDir(
      path.join(REPO_ROOT, 'claude', 'agents'),
      path.join(CLAUDE_HOME, 'agents'),
    )) changes.push(`~/.claude/agents/${f}`);

    for (const f of mirrorDir(
      path.join(REPO_ROOT, 'claude', 'commands'),
      path.join(CLAUDE_HOME, 'commands'),
    )) changes.push(`~/.claude/commands/${f}`);

    for (const f of syncSkills('to-local')) changes.push(f);
  }

  // 摘要
  console.log('\n📋 同步摘要：');
  if (changes.length === 0) {
    console.log('  ✅ 全部一致，無變動');
  } else {
    for (const c of changes) console.log(`  • ${c}`);
  }
  console.log('');
}

main();
