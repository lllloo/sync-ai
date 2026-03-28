#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawnSync } = require('child_process');

const REPO_ROOT = __dirname;
const HOME = os.homedir();
const CLAUDE_HOME = path.join(HOME, '.claude');
const AGENTS_HOME = path.join(HOME, '.agents');
const DEVICE_FIELDS = ['model', 'effortLevel'];

// ANSI 顏色（只有 TTY 才輸出顏色）
const isTTY = process.stdout.isTTY;
const col = {
  red:    t => isTTY ? `\x1b[31m${t}\x1b[0m` : t,
  green:  t => isTTY ? `\x1b[32m${t}\x1b[0m` : t,
  yellow: t => isTTY ? `\x1b[33m${t}\x1b[0m` : t,
  cyan:   t => isTTY ? `\x1b[36m${t}\x1b[0m` : t,
  bold:   t => isTTY ? `\x1b[1m${t}\x1b[0m`  : t,
  dim:    t => isTTY ? `\x1b[2m${t}\x1b[0m`  : t,
};

const mode = process.argv[2];
if (!['to-repo', 'to-local', 'diff', 'skills:diff'].includes(mode)) {
  console.error('用法: node sync.js to-repo|to-local|diff|skills:diff');
  process.exit(1);
}

// ── Utilities ──────────────────────────────────────────────────────────────

function run(cmd, args = []) {
  return spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(col.red(`  ✖ 無法解析 JSON：${filePath}`));
    console.error(col.dim(`    ${e.message}`));
    process.exit(1);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, force = false) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  const srcContent = fs.readFileSync(src);
  if (!force && fs.existsSync(dest) && srcContent.equals(fs.readFileSync(dest))) return false;
  fs.writeFileSync(dest, srcContent);
  return true;
}

function getFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (GLOBAL_EXCLUDE.includes(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...getFiles(path.join(dir, entry.name), rel));
    } else {
      result.push(rel);
    }
  }
  return result;
}

// 永遠排除的檔案
const GLOBAL_EXCLUDE = ['.DS_Store'];

function matchExclude(rel, pattern) {
  if (pattern.endsWith('*')) return rel.startsWith(pattern.slice(0, -1));
  return rel === pattern;
}


// 整目錄鏡像：以 src 為準，dest 多餘的刪掉
function mirrorDir(src, dest, excludePatterns = [], force = false) {
  const changed = [];
  if (!fs.existsSync(src)) return changed;
  ensureDir(dest);

  const srcFiles = new Set(
    getFiles(src).filter(rel => !excludePatterns.some(p => matchExclude(rel, p)))
  );

  for (const rel of srcFiles) {
    const srcFile = path.join(src, rel);
    const destFile = path.join(dest, rel);
    ensureDir(path.dirname(destFile));
    const srcContent = fs.readFileSync(srcFile);
    const destExists = fs.existsSync(destFile);
    if (force || !destExists || !srcContent.equals(fs.readFileSync(destFile))) {
      fs.writeFileSync(destFile, srcContent);
      changed.push(rel);
    }
  }

  if (fs.existsSync(dest)) {
    for (const rel of getFiles(dest)) {
      if (!srcFiles.has(rel) && !excludePatterns.some(p => matchExclude(rel, p))) {
        fs.rmSync(path.join(dest, rel));
        changed.push(`[刪除] ${rel}`);
      }
    }
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

// ── Diff utilities（純比較，不寫檔）──────────────────────────────────────

// 比較單一檔案，回傳 'new' | 'changed' | null
function diffFile(src, dest) {
  if (!fs.existsSync(src)) return null;
  if (!fs.existsSync(dest)) return 'new';
  return fs.readFileSync(src).equals(fs.readFileSync(dest)) ? null : 'changed';
}

// 比較兩個目錄，回傳 [{ rel, status: 'new'|'changed'|'deleted' }]
function diffDir(src, dest, excludePatterns = []) {
  const result = [];
  if (!fs.existsSync(src)) return result;

  const srcFiles = new Set(
    getFiles(src).filter(rel => !excludePatterns.some(p => matchExclude(rel, p)))
  );
  const destFiles = new Set(fs.existsSync(dest) ? getFiles(dest) : []);

  for (const rel of srcFiles) {
    if (!destFiles.has(rel)) {
      result.push({ rel, status: 'new' });
    } else {
      const same = fs.readFileSync(path.join(src, rel))
        .equals(fs.readFileSync(path.join(dest, rel)));
      if (!same) result.push({ rel, status: 'changed' });
    }
  }
  for (const rel of destFiles) {
    if (!srcFiles.has(rel)) result.push({ rel, status: 'deleted' });
  }
  return result;
}

// 顯示兩個檔案的 unified diff（srcPath 為新版）
function printFileDiff(srcPath, destPath, label) {
  const result = spawnSync('diff', ['-u', destPath, srcPath], { encoding: 'utf8' });
  if (!result.stdout.trim()) return;
  console.log(col.bold(`\n  ── ${label}`));
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      console.log(col.dim('  ' + line));
    } else if (line.startsWith('-')) {
      console.log(col.red('  ' + line));
    } else if (line.startsWith('+')) {
      console.log(col.green('  ' + line));
    } else if (line.startsWith('@@')) {
      console.log(col.cyan('  ' + line));
    } else {
      console.log('  ' + line);
    }
  }
}

// ── Settings.json ──────────────────────────────────────────────────────────

function mergeSettingsJson(m) {
  const localPath = path.join(CLAUDE_HOME, 'settings.json');
  const repoPath = path.join(REPO_ROOT, 'claude', 'settings.json');

  if (m === 'to-repo') {
    if (!fs.existsSync(localPath)) return false;
    const local = readJson(localPath);
    for (const field of DEVICE_FIELDS) delete local[field];
    ensureDir(path.dirname(repoPath));
    fs.writeFileSync(repoPath, JSON.stringify(local, null, 2) + '\n');
    return true;
  } else {
    if (!fs.existsSync(repoPath)) return false;
    const repo = readJson(repoPath);
    const deviceValues = {};
    if (fs.existsSync(localPath)) {
      const local = readJson(localPath);
      for (const field of DEVICE_FIELDS) {
        if (local[field] !== undefined) deviceValues[field] = local[field];
      }
    }
    ensureDir(path.dirname(localPath));
    fs.writeFileSync(localPath, JSON.stringify({ ...repo, ...deviceValues }, null, 2) + '\n');
    return true;
  }
}

// ── skills:diff mode ───────────────────────────────────────────────────────

function runSkillsDiff() {
  console.log(col.bold('\n📦 Skills 差異比對\n'));

  const repoLockPath = path.join(REPO_ROOT, 'skills-lock.json');
  const localLockPath = path.join(AGENTS_HOME, '.skill-lock.json');

  const repoSkills = fs.existsSync(repoLockPath)
    ? readJson(repoLockPath).skills || {}
    : {};
  const localSkills = fs.existsSync(localLockPath)
    ? readJson(localLockPath).skills || {}
    : {};

  const onlyInRepo  = Object.keys(repoSkills).filter(n => !localSkills[n]);
  const onlyInLocal = Object.keys(localSkills).filter(n => !repoSkills[n]);
  const inBoth      = Object.keys(repoSkills).filter(n =>  localSkills[n]);

  if (inBoth.length === 0 && onlyInRepo.length === 0 && onlyInLocal.length === 0) {
    console.log(col.green('  ✅ 本機與 repo 完全一致\n'));
    return;
  }

  // 一致的
  for (const name of inBoth) {
    console.log(`  ${col.dim('✅')}  ${col.dim(name)}`);
  }

  // repo 有、本機沒裝
  for (const name of onlyInRepo) {
    console.log(`  ${col.yellow('⬇️ ')}  ${name}  ${col.yellow('← repo 有、本機未安裝')}`);
  }

  // 本機有、repo 沒記錄
  for (const name of onlyInLocal) {
    console.log(`  ${col.cyan('⬆️ ')}  ${name}  ${col.cyan('← 本機有、repo 未記錄')}`);
  }

  // 建議指令
  if (onlyInRepo.length > 0) {
    console.log(col.bold('\n── 安裝缺少的 skills ─────────────────────────────'));
    for (const name of onlyInRepo) {
      const { source } = repoSkills[name];
      console.log(`  npx skills add ${source} -g -y --skill ${name} --agent claude-code`);
    }
  }

  if (onlyInLocal.length > 0) {
    console.log(col.bold('\n── 本機多裝的 skills（自行決定是否移除）──────────'));
    for (const name of onlyInLocal) {
      console.log(`  npx skills remove ${name} -g -y`);
    }
  }

  console.log('');
}

// ── diff mode ──────────────────────────────────────────────────────────────

function runDiff() {
  console.log(col.bold('\n📊 本機 vs repo 差異比對\n'));

  // 追蹤臨時檔案，確保事後清理
  let tmpSrc = null;

  try {

  // 收集所有要比較的項目
  // [{ label, status, srcPath, destPath }]
  const items = [];

  // CLAUDE.md
  {
    const src = path.join(CLAUDE_HOME, 'CLAUDE.md');
    const dest = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
    items.push({ label: 'CLAUDE.md', src, dest, status: diffFile(src, dest) });
  }

  // settings.json（去掉裝置欄位再比較）
  {
    const localPath = path.join(CLAUDE_HOME, 'settings.json');
    const dest = path.join(REPO_ROOT, 'claude', 'settings.json');
    let status = null;
    if (fs.existsSync(localPath)) {
      const local = readJson(localPath);
      for (const field of DEVICE_FIELDS) delete local[field];
      const stripped = JSON.stringify(local, null, 2) + '\n';
      tmpSrc = path.join(os.tmpdir(), `sync-ai-settings-diff-${process.pid}.json`);
      fs.writeFileSync(tmpSrc, stripped);
      if (!fs.existsSync(dest)) {
        status = 'new';
      } else if (fs.readFileSync(dest, 'utf8') !== stripped) {
        status = 'changed';
      }
    }
    items.push({ label: 'settings.json', src: tmpSrc, dest, status });
  }

  // statusline.sh
  {
    const src = path.join(CLAUDE_HOME, 'statusline.sh');
    const dest = path.join(REPO_ROOT, 'claude', 'statusline.sh');
    items.push({ label: 'statusline.sh', src, dest, status: diffFile(src, dest) });
  }

  // agents/
  const agentDiffs = diffDir(
    path.join(CLAUDE_HOME, 'agents'),
    path.join(REPO_ROOT, 'claude', 'agents'),
  );

  // commands/
  const commandDiffs = diffDir(
    path.join(CLAUDE_HOME, 'commands'),
    path.join(REPO_ROOT, 'claude', 'commands'),
  );

  const allDiffItems = [
    ...items.map(i => ({ label: `claude/${i.label}`, status: i.status, src: i.src, dest: i.dest })),
    ...agentDiffs.map(d => ({
      label: `claude/agents/${d.rel}`,
      status: d.status,
      src: path.join(CLAUDE_HOME, 'agents', d.rel),
      dest: path.join(REPO_ROOT, 'claude', 'agents', d.rel),
    })),
    ...commandDiffs.map(d => ({
      label: `claude/commands/${d.rel}`,
      status: d.status,
      src: path.join(CLAUDE_HOME, 'commands', d.rel),
      dest: path.join(REPO_ROOT, 'claude', 'commands', d.rel),
    })),
  ];

  let hasDiff = false;
  for (const item of allDiffItems) {
    if (item.status === null) {
      console.log(`  ${col.dim('✅')}  ${col.dim(item.label)}`);
    } else if (item.status === 'new') {
      console.log(`  ${col.green('➕')}  ${item.label}  ${col.green('← 本機有、repo 沒有')}`);
      hasDiff = true;
    } else if (item.status === 'changed') {
      console.log(`  ${col.yellow('✏️')}   ${item.label}  ${col.yellow('← 有差異')}`);
      hasDiff = true;
    } else if (item.status === 'deleted') {
      console.log(`  ${col.red('➖')}  ${item.label}  ${col.red('← repo 有、本機沒有')}`);
      hasDiff = true;
    }
  }

  if (!hasDiff) {
    console.log(col.green('\n  ✅ 本機與 repo 完全一致\n'));
    return;
  }

  // ── 詳細 diff ──
  console.log(col.bold('\n── 詳細差異 ──────────────────────────────────────────'));

  for (const item of allDiffItems) {
    if (item.status === 'changed' && item.src && item.dest) {
      printFileDiff(item.src, item.dest, item.label);
    } else if (item.status === 'new' && item.src && fs.existsSync(item.src)) {
      console.log(col.bold(`\n  ── ${item.label}  ${col.green('（新增）')}`));
      const lines = fs.readFileSync(item.src, 'utf8').split('\n');
      for (const line of lines.slice(0, 30)) console.log(col.green('  +' + line));
      if (lines.length > 30) console.log(col.dim(`  ... 共 ${lines.length} 行`));
    }
  }

  console.log(col.bold('\n💡 下一步：'));
  console.log(`   npm run to-repo   ${col.dim('# 將本機內容寫入 repo，再用 git diff 確認')}`);
  console.log('');

  } finally {
    if (tmpSrc) {
      try { fs.unlinkSync(tmpSrc); } catch (_) {}
    }
  }
}

// ── 互動確認 ───────────────────────────────────────────────────────────────

function askConfirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {

  if (mode === 'diff') {
    runDiff();
    return;
  }

  if (mode === 'skills:diff') {
    runSkillsDiff();
    return;
  }

  // ── to-repo ──
  if (mode === 'to-repo') {
    console.log(col.bold('\n🔄 sync-ai 本機 → repo\n'));

    // 預覽：收集差異，讓使用者確認後再執行
    const preview = [];

    const claudeStatus = diffFile(
      path.join(CLAUDE_HOME, 'CLAUDE.md'),
      path.join(REPO_ROOT, 'claude', 'CLAUDE.md'),
    );
    if (claudeStatus) preview.push({ label: 'claude/CLAUDE.md', status: claudeStatus });

    {
      const localPath = path.join(CLAUDE_HOME, 'settings.json');
      const dest = path.join(REPO_ROOT, 'claude', 'settings.json');
      if (fs.existsSync(localPath)) {
        const local = readJson(localPath);
        for (const field of DEVICE_FIELDS) delete local[field];
        const stripped = JSON.stringify(local, null, 2) + '\n';
        if (!fs.existsSync(dest)) {
          preview.push({ label: 'claude/settings.json', status: 'new' });
        } else if (fs.readFileSync(dest, 'utf8') !== stripped) {
          preview.push({ label: 'claude/settings.json', status: 'changed' });
        }
      }
    }

    const statuslineStatus = diffFile(
      path.join(CLAUDE_HOME, 'statusline.sh'),
      path.join(REPO_ROOT, 'claude', 'statusline.sh'),
    );
    if (statuslineStatus) preview.push({ label: 'claude/statusline.sh', status: statuslineStatus });

    for (const d of diffDir(
      path.join(CLAUDE_HOME, 'agents'),
      path.join(REPO_ROOT, 'claude', 'agents'),
    )) preview.push({ label: `claude/agents/${d.rel}`, status: d.status });

    for (const d of diffDir(
      path.join(CLAUDE_HOME, 'commands'),
      path.join(REPO_ROOT, 'claude', 'commands'),
    )) preview.push({ label: `claude/commands/${d.rel}`, status: d.status });

    if (preview.length === 0) {
      console.log(col.green('  ✅ 與 repo 完全一致，無需同步\n'));
      return;
    }

    console.log('📋 預覽（尚未寫入 repo）：\n');
    for (const p of preview) {
      const icon =
        p.status === 'new'     ? col.green('➕') :
        p.status === 'deleted' ? col.red('➖')   :
                                 col.yellow('✏️ ');
      console.log(`  ${icon}  ${p.label}`);
    }

    console.log('');
    const confirmed = await askConfirm(col.bold('將以上變更寫入 repo？(y/N) '));
    if (!confirmed) {
      console.log('\n  已取消\n');
      return;
    }
    console.log('');

    // 執行同步
    const changes = [];

    if (copyFile(path.join(CLAUDE_HOME, 'CLAUDE.md'), path.join(REPO_ROOT, 'claude', 'CLAUDE.md'), true))
      changes.push('claude/CLAUDE.md');

    if (mergeSettingsJson('to-repo'))
      changes.push('claude/settings.json');

    if (copyFile(path.join(CLAUDE_HOME, 'statusline.sh'), path.join(REPO_ROOT, 'claude', 'statusline.sh'), true))
      changes.push('claude/statusline.sh');

    for (const f of mirrorDir(
      path.join(CLAUDE_HOME, 'agents'),
      path.join(REPO_ROOT, 'claude', 'agents'),
      [],
      true,
    )) changes.push(`claude/agents/${f}`);

    for (const f of mirrorDir(
      path.join(CLAUDE_HOME, 'commands'),
      path.join(REPO_ROOT, 'claude', 'commands'),
      [],
      true,
    )) changes.push(`claude/commands/${f}`);

    // git diff
    const gitStatus = run('git', ['status', '--short']);
    if (gitStatus.error || gitStatus.status !== 0) {
      console.log(col.yellow('  ⚠️ 無法取得 git 狀態'));
    } else if (gitStatus.stdout.trim()) {
      console.log(col.bold('📋 Git 變動：\n'));
      for (const line of gitStatus.stdout.trim().split('\n')) {
        console.log('  ' + col.yellow(line));
      }
      const gitDiff = run('git', ['diff', '--stat']);
      if (!gitDiff.error && gitDiff.stdout.trim()) {
        console.log('');
        for (const line of gitDiff.stdout.trim().split('\n')) {
          console.log('  ' + col.dim(line));
        }
      }
      console.log('');
      console.log(col.bold('💡 下一步：'));
      console.log(col.dim('   git add -A && git commit -m "sync: from <hostname>" && git push'));
    } else {
      console.log(col.green('  ✅ 與 repo 完全一致，無變動'));
    }
    console.log('');
    return;
  }

  // ── to-local ──
  console.log(col.bold('\n🔄 sync-ai repo → 本機\n'));
  console.log('📋 預覽（尚未套用）：\n');

  const preview = [];

  const claudeStatus = diffFile(
    path.join(REPO_ROOT, 'claude', 'CLAUDE.md'),
    path.join(CLAUDE_HOME, 'CLAUDE.md'),
  );
  if (claudeStatus) preview.push({ label: '~/.claude/CLAUDE.md', status: claudeStatus });

  // settings.json：比較去掉裝置欄位後的內容
  {
    const repoPath = path.join(REPO_ROOT, 'claude', 'settings.json');
    const localPath = path.join(CLAUDE_HOME, 'settings.json');
    if (fs.existsSync(repoPath)) {
      const repo = readJson(repoPath);
      const local = fs.existsSync(localPath)
        ? readJson(localPath)
        : {};
      for (const field of DEVICE_FIELDS) delete local[field];
      const repoStr = JSON.stringify(repo, null, 2);
      const localStr = JSON.stringify(local, null, 2);
      if (repoStr !== localStr)
        preview.push({ label: '~/.claude/settings.json', status: localPath && fs.existsSync(localPath) ? 'changed' : 'new' });
    }
  }

  const statuslineStatus = diffFile(
    path.join(REPO_ROOT, 'claude', 'statusline.sh'),
    path.join(CLAUDE_HOME, 'statusline.sh'),
  );
  if (statuslineStatus) preview.push({ label: '~/.claude/statusline.sh', status: statuslineStatus });

  for (const d of diffDir(
    path.join(REPO_ROOT, 'claude', 'agents'),
    path.join(CLAUDE_HOME, 'agents'),
  )) preview.push({ label: `~/.claude/agents/${d.rel}`, status: d.status });

  for (const d of diffDir(
    path.join(REPO_ROOT, 'claude', 'commands'),
    path.join(CLAUDE_HOME, 'commands'),
  )) preview.push({ label: `~/.claude/commands/${d.rel}`, status: d.status });

  if (preview.length === 0) {
    console.log(col.green('  ✅ 本機與 repo 完全一致，無需套用\n'));
    return;
  }

  for (const p of preview) {
    const icon =
      p.status === 'new'     ? col.green('➕') :
      p.status === 'deleted' ? col.red('➖')   :
                               col.yellow('✏️ ');
    console.log(`  ${icon}  ${p.label}`);
  }

  console.log('');
  const confirmed = await askConfirm(col.bold('套用以上變更？(y/N) '));
  if (!confirmed) {
    console.log('\n  已取消\n');
    return;
  }
  console.log('');

  // 套用
  const changes = [];

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

  console.log('📋 同步完成：\n');
  if (changes.length === 0) {
    console.log('  ✅ 全部一致，無變動');
  } else {
    for (const ch of changes) console.log(`  • ${ch}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('錯誤：', err.message);
  process.exit(1);
});
