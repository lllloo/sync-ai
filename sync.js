#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// sync-ai — 跨裝置 Claude Code 設定同步工具
// 單檔架構，零外部相依
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawnSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Constants — 全域常數與設定
// 集中管理所有 magic values，方便查閱與修改
// ═══════════════════════════════════════════════════════════════════════════════

/** Process exit codes（語義化，可用於 CI 判斷） */
const EXIT_OK = 0;
const EXIT_DIFF = 1;
const EXIT_ERROR = 2;

/** 路徑常數 */
const REPO_ROOT = __dirname;
const HOME = os.homedir();
const CLAUDE_HOME = path.join(HOME, '.claude');
const AGENTS_HOME = path.join(HOME, '.agents');
const SYNC_HISTORY_LOG = path.join(REPO_ROOT, '.sync-history.log');

/** settings.json 中各裝置獨立的欄位，同步時排除 */
const DEVICE_FIELDS = ['model', 'effortLevel'];

/** 永遠排除的檔案名稱 */
const GLOBAL_EXCLUDE = ['.DS_Store'];

/** 統一的狀態圖示映射表，確保語義一致與對齊 */
const STATUS_ICONS = {
  ok:      { icon: '✓', color: 'dim'    },  // 一致
  added:   { icon: '+', color: 'green'  },  // 新增
  changed: { icon: '~', color: 'yellow' },  // 變更
  deleted: { icon: '-', color: 'red'    },  // 刪除
  up:      { icon: '↑', color: 'cyan'   },  // 本機有、repo 沒有
  down:    { icon: '↓', color: 'yellow' },  // repo 有、本機沒有
};

/** 指令別名對應 */
const COMMAND_ALIASES = {
  d:   'diff',
  tr:  'to-repo',
  tl:  'to-local',
  sd:  'skills:diff',
  sa:  'skills:add',
};

/** 所有可用指令 */
const VALID_COMMANDS = ['to-repo', 'to-local', 'diff', 'skills:diff', 'skills:add', 'help'];

// ═══════════════════════════════════════════════════════════════════════════════
// Section: ANSI Colors — 終端機色碼處理
// 只在 TTY 環境下輸出 ANSI 色碼，否則輸出純文字
// ═══════════════════════════════════════════════════════════════════════════════

const isTTY = process.stdout.isTTY;
const col = {
  red:    (/** @type {string} */ t) => isTTY ? `\x1b[31m${t}\x1b[0m` : t,
  green:  (/** @type {string} */ t) => isTTY ? `\x1b[32m${t}\x1b[0m` : t,
  yellow: (/** @type {string} */ t) => isTTY ? `\x1b[33m${t}\x1b[0m` : t,
  cyan:   (/** @type {string} */ t) => isTTY ? `\x1b[36m${t}\x1b[0m` : t,
  bold:   (/** @type {string} */ t) => isTTY ? `\x1b[1m${t}\x1b[0m`  : t,
  dim:    (/** @type {string} */ t) => isTTY ? `\x1b[2m${t}\x1b[0m`  : t,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Errors — 統一錯誤處理框架
// 定義 SyncError class，所有錯誤統一經過此 class 拋出
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 統一錯誤類型，包含錯誤代碼與上下文資訊
 * @extends Error
 */
class SyncError extends Error {
  /**
   * @param {string} message - 使用者友善的錯誤訊息
   * @param {string} code - 錯誤代碼（FILE_NOT_FOUND, JSON_PARSE, GIT_ERROR, PERMISSION, INVALID_ARGS）
   * @param {Record<string, unknown>} [context] - 額外上下文
   */
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.context = context;
  }
}

/** 錯誤代碼常數 */
const ERR = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  JSON_PARSE:     'JSON_PARSE',
  GIT_ERROR:      'GIT_ERROR',
  PERMISSION:     'PERMISSION',
  INVALID_ARGS:   'INVALID_ARGS',
  IO_ERROR:       'IO_ERROR',
};

/**
 * 根據 SyncError 的 code 輸出友善錯誤訊息（含修復建議）
 * @param {SyncError|Error} err
 */
function formatError(err) {
  if (!(err instanceof SyncError)) {
    console.error(col.red(`  [!] 未預期的錯誤：${err.message}`));
    return;
  }

  const hints = {
    [ERR.FILE_NOT_FOUND]: '請確認檔案路徑是否正確，或先執行一次同步',
    [ERR.JSON_PARSE]:     '請檢查 JSON 檔案格式是否正確（可用 jsonlint 驗證）',
    [ERR.GIT_ERROR]:      '請確認 git 已安裝且目前在 git repository 內',
    [ERR.PERMISSION]:     '請檢查檔案權限，或以適當權限重新執行',
    [ERR.INVALID_ARGS]:   '請參閱 node sync.js help 查看可用指令',
    [ERR.IO_ERROR]:       '請確認磁碟空間充足且檔案未被其他程式鎖定',
  };

  console.error(col.red(`  [!] ${err.message}`));
  if (err.context && err.context.path) {
    console.error(col.dim(`      路徑：${err.context.path}`));
  }
  const hint = hints[err.code];
  if (hint) {
    console.error(col.dim(`      提示：${hint}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Tempfile Registry — 暫存檔管理
// 確保暫存檔在任何退出路徑（含 SIGINT）都被清理
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Set<string>} 追蹤所有待清理的暫存檔路徑 */
const tempFiles = new Set();

/**
 * 註冊暫存檔路徑，會在 process exit 時自動清理
 * @param {string} filePath - 暫存檔路徑
 */
function registerTempFile(filePath) {
  tempFiles.add(filePath);
}

/**
 * 清理所有已註冊的暫存檔
 */
function cleanupTempFiles() {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch (_) { /* 忽略清理錯誤 */ }
  }
  tempFiles.clear();
}

// 註冊 exit 與 signal handler，確保暫存檔必定清理
process.on('exit', cleanupTempFiles);

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Signal Handling — 中斷訊號處理
// 攔截 SIGINT/SIGTERM，在同步中斷時給出警告
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {boolean} 是否正在執行寫入操作 */
let isWriting = false;

/**
 * 處理中斷訊號
 * @param {string} signal
 */
function handleSignal(signal) {
  cleanupTempFiles();
  if (isWriting) {
    console.error(col.yellow('\n  [!] 同步中斷，部分檔案可能未更新'));
  }
  process.exit(EXIT_ERROR);
}

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

// ═══════════════════════════════════════════════════════════════════════════════
// Section: FS Utilities — 檔案系統工具函式
// 封裝檔案讀寫操作，加入防禦性檢查與錯誤處理
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 檢查檔案讀取權限
 * @param {string} filePath - 要檢查的檔案路徑
 * @throws {SyncError} 當檔案無法讀取時
 */
function checkReadAccess(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new SyncError(`檔案不存在：${filePath}`, ERR.FILE_NOT_FOUND, { path: filePath });
    }
    throw new SyncError(`無法讀取檔案：${filePath}`, ERR.PERMISSION, { path: filePath });
  }
}

/**
 * 檢查檔案寫入權限（若檔案已存在）
 * @param {string} filePath - 要檢查的檔案路徑
 * @throws {SyncError} 當檔案無法寫入時
 */
function checkWriteAccess(filePath) {
  if (!fs.existsSync(filePath)) return; // 新檔案不需要檢查
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
  } catch (_) {
    throw new SyncError(`無法寫入檔案（唯讀或權限不足）：${filePath}`, ERR.PERMISSION, { path: filePath });
  }
}

/**
 * 讀取並解析 JSON 檔案，區分「檔案不存在」與「JSON 解析失敗」
 * @param {string} filePath - JSON 檔案路徑
 * @returns {Record<string, unknown>} 解析後的物件
 * @throws {SyncError} FILE_NOT_FOUND 或 JSON_PARSE
 */
function readJson(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new SyncError(`JSON 檔案不存在：${filePath}`, ERR.FILE_NOT_FOUND, { path: filePath });
    }
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      throw new SyncError(`無法讀取 JSON 檔案（權限不足）：${filePath}`, ERR.PERMISSION, { path: filePath });
    }
    throw new SyncError(`無法讀取檔案：${e.message}`, ERR.IO_ERROR, { path: filePath });
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new SyncError(
      `JSON 解析失敗：${filePath}`,
      ERR.JSON_PARSE,
      { path: filePath, parseError: e.message },
    );
  }
}

/**
 * 安全寫入 JSON 檔案（write-to-tmp + rename，防止寫入中途斷電損壞）
 * @param {string} filePath - 目標檔案路徑
 * @param {unknown} data - 要序列化的資料
 */
function writeJsonSafe(filePath, data) {
  checkWriteAccess(filePath);
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmpPath = filePath + `.tmp.${process.pid}`;
  registerTempFile(tmpPath);
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    // rename 跨磁碟可能失敗，fallback 為直接寫入
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    if (e.code === 'EXDEV') {
      fs.writeFileSync(filePath, content);
    } else {
      throw new SyncError(`寫入 JSON 失敗：${e.message}`, ERR.IO_ERROR, { path: filePath });
    }
  } finally {
    tempFiles.delete(tmpPath);
  }
}

/**
 * 確保目錄存在（遞迴建立）
 * @param {string} dir - 目錄路徑
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 複製單一檔案，回傳是否有實際寫入
 * @param {string} src - 來源路徑
 * @param {string} dest - 目的路徑
 * @param {boolean} [force=false] - 是否強制覆寫
 * @param {boolean} [dryRun=false] - 若為 true 則只判斷不寫入
 * @returns {boolean} 是否有寫入（或將會寫入）
 */
function copyFile(src, dest, force = false, dryRun = false) {
  if (!fs.existsSync(src)) return false;
  checkReadAccess(src);
  const srcContent = fs.readFileSync(src);
  if (!force && fs.existsSync(dest) && srcContent.equals(fs.readFileSync(dest))) return false;
  if (dryRun) return true;
  checkWriteAccess(dest);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, srcContent);
  return true;
}

/**
 * 遞迴列出目錄下所有檔案的相對路徑
 * @param {string} dir - 目錄路徑
 * @param {string} [base=''] - 基底路徑（遞迴用）
 * @returns {string[]} 相對路徑陣列
 */
function getFiles(dir, base = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
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

/**
 * 檢查相對路徑是否符合排除模式
 * @param {string} rel - 相對路徑
 * @param {string} pattern - 排除模式（支援尾部 * 萬用字元）
 * @returns {boolean}
 */
function matchExclude(rel, pattern) {
  if (pattern.endsWith('*')) return rel.startsWith(pattern.slice(0, -1));
  return rel === pattern;
}

/**
 * 整目錄鏡像：以 src 為準同步到 dest，dest 多餘的刪掉
 * @param {string} src - 來源目錄
 * @param {string} dest - 目的目錄
 * @param {string[]} [excludePatterns=[]] - 排除模式列表
 * @param {boolean} [force=false] - 是否強制覆寫
 * @param {boolean} [dryRun=false] - 若為 true 則只判斷不寫入
 * @returns {Array<{rel: string, action: string}>} 變更清單
 */
function mirrorDir(src, dest, excludePatterns = [], force = false, dryRun = false) {
  const changed = [];
  if (!fs.existsSync(src)) return changed;
  if (!dryRun) ensureDir(dest);

  const srcFiles = new Set(
    getFiles(src).filter(rel => !excludePatterns.some(p => matchExclude(rel, p)))
  );

  for (const rel of srcFiles) {
    const srcFile = path.join(src, rel);
    const destFile = path.join(dest, rel);
    const srcContent = fs.readFileSync(srcFile);
    const destExists = fs.existsSync(destFile);
    if (force || !destExists || !srcContent.equals(fs.readFileSync(destFile))) {
      if (!dryRun) {
        ensureDir(path.dirname(destFile));
        fs.writeFileSync(destFile, srcContent);
      }
      changed.push({ rel, action: destExists ? 'updated' : 'added' });
    }
  }

  if (fs.existsSync(dest)) {
    for (const rel of getFiles(dest)) {
      if (!srcFiles.has(rel) && !excludePatterns.some(p => matchExclude(rel, p))) {
        if (!dryRun) fs.rmSync(path.join(dest, rel));
        changed.push({ rel, action: 'deleted' });
      }
    }
    if (!dryRun) cleanEmptyDirs(dest);
  }

  return changed;
}

/**
 * 遞迴清除空目錄
 * @param {string} dir - 起始目錄
 */
function cleanEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      cleanEmptyDirs(sub);
      try {
        if (fs.readdirSync(sub).length === 0) fs.rmdirSync(sub);
      } catch (_) { /* ignore */ }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Git Utilities — Git 操作封裝
// 封裝 git 指令執行，含 stderr 處理與可用性檢查
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 執行 git 指令
 * @param {string[]} args - git 子指令與參數
 * @returns {{stdout: string, stderr: string, status: number|null, ok: boolean}}
 */
function git(args = []) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.error) {
    return { stdout: '', stderr: result.error.message, status: null, ok: false };
  }
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    ok: result.status === 0,
  };
}

/**
 * 檢查是否在 git repo 內
 * @returns {boolean}
 */
function isInsideGitRepo() {
  const result = git(['rev-parse', '--is-inside-work-tree']);
  return result.ok && result.stdout.trim() === 'true';
}

/**
 * 檢查 git 是否可用
 * @returns {boolean}
 */
function isGitAvailable() {
  const result = git(['--version']);
  return result.ok;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Diff Engine — 差異比較引擎
// 純比較邏輯，不寫入任何檔案
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 比較單一檔案差異
 * @param {string} src - 來源檔案路徑
 * @param {string} dest - 目的檔案路徑
 * @returns {'new'|'changed'|null} 差異狀態
 */
function diffFile(src, dest) {
  if (!fs.existsSync(src)) return null;
  if (!fs.existsSync(dest)) return 'new';
  return fs.readFileSync(src).equals(fs.readFileSync(dest)) ? null : 'changed';
}

/**
 * 比較兩個目錄的差異
 * @param {string} src - 來源目錄
 * @param {string} dest - 目的目錄
 * @param {string[]} [excludePatterns=[]] - 排除模式列表
 * @returns {Array<{rel: string, status: 'new'|'changed'|'deleted'}>}
 */
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

/**
 * 純 JS 實作的簡易 line diff（不依賴外部 diff 指令）
 * 逐行比較兩個字串，輸出新增/刪除的行
 * @param {string} oldText - 舊版文字
 * @param {string} newText - 新版文字
 * @returns {Array<{type: '+'|'-'|' ', line: string}>}
 */
function computeLineDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result = [];

  // LCS-based diff for better quality
  const m = oldLines.length;
  const n = newLines.length;

  // 使用簡化的 O(ND) diff：先建立 LCS 表
  // 對於小檔案用完整 LCS，大檔案用簡易逐行比對
  if (m + n > 2000) {
    // 大檔案：簡易逐行比對
    return computeSimpleLineDiff(oldLines, newLines);
  }

  // 標準 LCS DP
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // 回溯產生 diff
  let i = m, j = n;
  const ops = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: ' ', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: '+', line: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: '-', line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

/**
 * 簡易逐行比對（大檔案用）
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @returns {Array<{type: '+'|'-'|' ', line: string}>}
 */
function computeSimpleLineDiff(oldLines, newLines) {
  const result = [];
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  for (const line of oldLines) {
    if (!newSet.has(line)) {
      result.push({ type: '-', line });
    } else {
      result.push({ type: ' ', line });
    }
  }
  for (const line of newLines) {
    if (!oldSet.has(line)) {
      result.push({ type: '+', line });
    }
  }
  return result;
}

/**
 * 顯示兩個檔案的 diff（優先使用外部 diff，fallback 為純 JS 實作）
 * @param {string} srcPath - 新版檔案路徑
 * @param {string} destPath - 舊版檔案路徑
 * @param {string} label - 顯示用標籤
 */
function printFileDiff(srcPath, destPath, label) {
  // 嘗試使用外部 diff 指令
  const result = spawnSync('diff', ['-u', destPath, srcPath], { encoding: 'utf8' });

  if (result.error) {
    // 外部 diff 不可用，使用純 JS fallback
    printJsDiff(srcPath, destPath, label);
    return;
  }

  if (!result.stdout.trim()) return;
  console.log(col.bold(`\n  -- ${label}`));
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

/**
 * 純 JS diff 顯示（當外部 diff 指令不可用時的 fallback）
 * @param {string} srcPath - 新版檔案路徑
 * @param {string} destPath - 舊版檔案路徑
 * @param {string} label - 顯示用標籤
 */
function printJsDiff(srcPath, destPath, label) {
  let oldText = '', newText = '';
  try { oldText = fs.readFileSync(destPath, 'utf8'); } catch (_) { /* empty */ }
  try { newText = fs.readFileSync(srcPath, 'utf8'); } catch (_) { /* empty */ }

  const ops = computeLineDiff(oldText, newText);
  const changedOps = ops.filter(op => op.type !== ' ');
  if (changedOps.length === 0) return;

  console.log(col.bold(`\n  -- ${label}`));

  // 只顯示有差異的行與前後各 2 行 context
  let lastPrinted = -1;
  for (let idx = 0; idx < ops.length; idx++) {
    if (ops[idx].type === ' ') continue;

    // 印出 context（前 2 行）
    const ctxStart = Math.max(0, idx - 2);
    if (ctxStart > lastPrinted + 1 && lastPrinted >= 0) {
      console.log(col.dim('  ...'));
    }
    for (let c = Math.max(ctxStart, lastPrinted + 1); c < idx; c++) {
      if (ops[c].type === ' ') console.log('  ' + ops[c].line);
    }

    // 印出差異行
    if (ops[idx].type === '+') {
      console.log(col.green('  +' + ops[idx].line));
    } else {
      console.log(col.red('  -' + ops[idx].line));
    }
    lastPrinted = idx;

    // 印出 context（後 2 行）
    const ctxEnd = Math.min(ops.length - 1, idx + 2);
    for (let c = idx + 1; c <= ctxEnd; c++) {
      if (ops[c].type === ' ') {
        console.log('  ' + ops[c].line);
        lastPrinted = c;
      } else {
        break; // 下一個差異行會自己處理
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Display Utilities — 輸出格式化工具
// 統一的狀態行輸出格式，確保對齊與語義一致
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 格式化並輸出一行狀態
 * @param {keyof STATUS_ICONS} type - 狀態類型
 * @param {string} label - 項目名稱
 * @param {string} [desc=''] - 描述文字
 */
function printStatusLine(type, label, desc = '') {
  const entry = STATUS_ICONS[type];
  if (!entry) return;
  const icon = col[entry.color](`[${entry.icon}]`);
  const text = entry.color === 'dim' ? col.dim(label) : label;
  const suffix = desc ? `  ${col[entry.color](desc)}` : '';
  console.log(`  ${icon} ${text}${suffix}`);
}

/**
 * 輸出操作摘要統計行
 * @param {{added: number, updated: number, deleted: number}} stats
 */
function printSummary(stats) {
  const parts = [];
  if (stats.added > 0)   parts.push(col.green(`${stats.added} 個新增`));
  if (stats.updated > 0) parts.push(col.yellow(`${stats.updated} 個更新`));
  if (stats.deleted > 0) parts.push(col.red(`${stats.deleted} 個刪除`));
  if (parts.length === 0) {
    console.log(col.dim('  無任何變更'));
  } else {
    console.log(`  摘要：${parts.join('、')}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Settings Handler — settings.json 合併邏輯
// 處理 settings.json 的裝置欄位排除與合併
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 合併 settings.json（排除裝置特定欄位）
 * @param {'to-repo'|'to-local'} direction - 同步方向
 * @param {boolean} [dryRun=false] - 是否為 dry-run 模式
 * @returns {boolean} 是否有實際變更
 */
function mergeSettingsJson(direction, dryRun = false) {
  const localPath = path.join(CLAUDE_HOME, 'settings.json');
  const repoPath = path.join(REPO_ROOT, 'claude', 'settings.json');

  if (direction === 'to-repo') {
    if (!fs.existsSync(localPath)) return false;
    const local = readJson(localPath);
    for (const field of DEVICE_FIELDS) delete local[field];
    if (dryRun) return true;
    writeJsonSafe(repoPath, local);
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
    if (dryRun) return true;
    writeJsonSafe(localPath, { ...repo, ...deviceValues });
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Operation Log — 操作日誌
// 每次同步後追加紀錄到 .sync-history.log
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 追加操作日誌
 * @param {string} direction - 操作方向（to-repo / to-local）
 * @param {string[]} changes - 變更清單
 */
function appendSyncLog(direction, changes) {
  try {
    const timestamp = new Date().toISOString();
    const hostname = os.hostname();
    const entry = [
      `[${timestamp}] ${direction} @ ${hostname}`,
      ...changes.map(c => `  ${c}`),
      '',
    ].join('\n');
    fs.appendFileSync(SYNC_HISTORY_LOG, entry + '\n');
  } catch (_) {
    // 日誌寫入失敗不影響主流程
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Commands — 各指令的實作
// diff, to-repo, to-local, skills:diff, skills:add, help
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * diff 指令：比對本機與 repo 的差異
 * @param {ParsedArgs} opts - CLI 引數
 * @returns {number} exit code（EXIT_OK=無差異, EXIT_DIFF=有差異）
 */
function runDiff(opts) {
  console.log(col.bold('\n  本機 vs repo 差異比對\n'));

  // 收集所有比較項目
  const items = [];

  // CLAUDE.md
  {
    const src = path.join(CLAUDE_HOME, 'CLAUDE.md');
    const dest = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
    items.push({ label: 'CLAUDE.md', src, dest, status: diffFile(src, dest), verboseSrc: src, verboseDest: dest });
  }

  // settings.json（去掉裝置欄位再比較）
  let tmpSrc = null;
  {
    const localPath = path.join(CLAUDE_HOME, 'settings.json');
    const dest = path.join(REPO_ROOT, 'claude', 'settings.json');
    let status = null;
    if (fs.existsSync(localPath)) {
      const local = readJson(localPath);
      for (const field of DEVICE_FIELDS) delete local[field];
      const stripped = JSON.stringify(local, null, 2) + '\n';
      tmpSrc = path.join(os.tmpdir(), `sync-ai-settings-diff-${process.pid}.json`);
      registerTempFile(tmpSrc);
      fs.writeFileSync(tmpSrc, stripped);
      if (!fs.existsSync(dest)) {
        status = 'new';
      } else if (fs.readFileSync(dest, 'utf8') !== stripped) {
        status = 'changed';
      }
    }
    items.push({ label: 'settings.json', src: tmpSrc, dest, status, verboseSrc: localPath, verboseDest: dest });
  }

  // statusline.sh
  {
    const src = path.join(CLAUDE_HOME, 'statusline.sh');
    const dest = path.join(REPO_ROOT, 'claude', 'statusline.sh');
    items.push({ label: 'statusline.sh', src, dest, status: diffFile(src, dest), verboseSrc: src, verboseDest: dest });
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
    ...items.map(i => ({
      label: `claude/${i.label}`, status: i.status, src: i.src, dest: i.dest,
      verboseSrc: i.verboseSrc, verboseDest: i.verboseDest,
    })),
    ...agentDiffs.map(d => {
      const src = path.join(CLAUDE_HOME, 'agents', d.rel);
      const dest = path.join(REPO_ROOT, 'claude', 'agents', d.rel);
      return { label: `claude/agents/${d.rel}`, status: d.status, src, dest, verboseSrc: src, verboseDest: dest };
    }),
    ...commandDiffs.map(d => {
      const src = path.join(CLAUDE_HOME, 'commands', d.rel);
      const dest = path.join(REPO_ROOT, 'claude', 'commands', d.rel);
      return { label: `claude/commands/${d.rel}`, status: d.status, src, dest, verboseSrc: src, verboseDest: dest };
    }),
  ];

  let hasDiff = false;
  for (const item of allDiffItems) {
    if (item.status === null) {
      printStatusLine('ok', item.label);
    } else if (item.status === 'new') {
      printStatusLine('added', item.label, '本機有、repo 沒有');
      hasDiff = true;
    } else if (item.status === 'changed') {
      printStatusLine('changed', item.label, '有差異');
      hasDiff = true;
    } else if (item.status === 'deleted') {
      printStatusLine('deleted', item.label, 'repo 有、本機沒有');
      hasDiff = true;
    }
    if (opts.verbose && item.verboseSrc) {
      logVerbosePaths(item.verboseSrc, item.verboseDest || item.dest);
    }
  }

  if (!hasDiff) {
    console.log(col.green('\n  本機與 repo 完全一致\n'));
    return EXIT_OK;
  }

  // 詳細 diff
  console.log(col.bold('\n  -- 詳細差異 --'));

  for (const item of allDiffItems) {
    if (item.status === 'changed' && item.src && item.dest) {
      printFileDiff(item.src, item.dest, item.label);
    } else if (item.status === 'new' && item.src && fs.existsSync(item.src)) {
      console.log(col.bold(`\n  -- ${item.label}  ${col.green('（新增）')}`));
      const lines = fs.readFileSync(item.src, 'utf8').split('\n');
      for (const line of lines.slice(0, 30)) console.log(col.green('  +' + line));
      if (lines.length > 30) console.log(col.dim(`  ... 共 ${lines.length} 行`));
    }
  }

  console.log(col.bold('\n  下一步：'));
  console.log(`   npm run to-repo   ${col.dim('# 將本機內容寫入 repo，再用 git diff 確認')}`);
  console.log('');

  return EXIT_DIFF;
}

/**
 * 在 verbose 模式下輸出檔案完整路徑與大小
 * @param {string} src - 來源路徑
 * @param {string} dest - 目的路徑
 */
function logVerbosePaths(src, dest) {
  const srcSize = fs.existsSync(src) ? fs.statSync(src).size : 0;
  const destSize = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  console.log(col.dim(`      src:  ${src} (${srcSize} bytes)`));
  console.log(col.dim(`      dest: ${dest} (${destSize} bytes)`));
}

/**
 * to-repo 指令：本機設定同步到 repo
 * @param {ParsedArgs} opts - CLI 引數
 * @returns {number} exit code
 */
function runToRepo(opts) {
  const dryRun = opts.dryRun;

  if (dryRun) {
    console.log(col.bold('\n  [dry-run] 本機 -> repo（不寫入任何檔案）\n'));
  } else {
    console.log(col.bold('\n  本機 -> repo\n'));
  }

  // 檢查 git repo
  if (!dryRun && !isInsideGitRepo()) {
    if (isGitAvailable()) {
      throw new SyncError('目前目錄不在 git repository 內', ERR.GIT_ERROR);
    }
  }

  isWriting = !dryRun;
  const stats = { added: 0, updated: 0, deleted: 0 };
  const changeLog = [];

  try {
    // CLAUDE.md
    {
      const src = path.join(CLAUDE_HOME, 'CLAUDE.md');
      const dest = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
      const existed = fs.existsSync(dest);
      if (copyFile(src, dest, true, dryRun)) {
        const action = existed ? 'updated' : 'added';
        stats[action]++;
        changeLog.push(`CLAUDE.md (${action})`);
        printStatusLine(action === 'added' ? 'added' : 'changed', 'CLAUDE.md');
      }
    }

    // settings.json
    if (mergeSettingsJson('to-repo', dryRun)) {
      stats.updated++;
      changeLog.push('settings.json (updated)');
      printStatusLine('changed', 'settings.json');
    }

    // statusline.sh
    {
      const src = path.join(CLAUDE_HOME, 'statusline.sh');
      const dest = path.join(REPO_ROOT, 'claude', 'statusline.sh');
      const existed = fs.existsSync(dest);
      if (copyFile(src, dest, true, dryRun)) {
        const action = existed ? 'updated' : 'added';
        stats[action]++;
        changeLog.push(`statusline.sh (${action})`);
        printStatusLine(action === 'added' ? 'added' : 'changed', 'statusline.sh');
      }
    }

    // agents/
    for (const c of mirrorDir(
      path.join(CLAUDE_HOME, 'agents'),
      path.join(REPO_ROOT, 'claude', 'agents'),
      [], true, dryRun
    )) {
      stats[c.action]++;
      changeLog.push(`agents/${c.rel} (${c.action})`);
      const iconType = c.action === 'added' ? 'added' : c.action === 'deleted' ? 'deleted' : 'changed';
      printStatusLine(iconType, `agents/${c.rel}`);
    }

    // commands/
    for (const c of mirrorDir(
      path.join(CLAUDE_HOME, 'commands'),
      path.join(REPO_ROOT, 'claude', 'commands'),
      [], true, dryRun
    )) {
      stats[c.action]++;
      changeLog.push(`commands/${c.rel} (${c.action})`);
      const iconType = c.action === 'added' ? 'added' : c.action === 'deleted' ? 'deleted' : 'changed';
      printStatusLine(iconType, `commands/${c.rel}`);
    }
  } finally {
    isWriting = false;
  }

  console.log('');
  printSummary(stats);

  if (dryRun) {
    console.log(col.dim('\n  以上為預覽，未實際寫入任何檔案'));
    console.log('');
    return EXIT_OK;
  }

  // 寫入操作日誌
  if (changeLog.length > 0) {
    appendSyncLog('to-repo', changeLog);
  }

  // 顯示 git status
  console.log('');
  if (!isGitAvailable()) {
    console.log(col.yellow('  Git 不可用，跳過狀態顯示'));
  } else if (!isInsideGitRepo()) {
    console.log(col.yellow('  不在 git repo 內，跳過狀態顯示'));
  } else {
    const gitStatus = git(['status', '--short']);
    if (!gitStatus.ok) {
      console.log(col.yellow('  無法取得 git 狀態'));
    } else if (gitStatus.stdout.trim()) {
      console.log(col.bold('  Git 變動：\n'));
      for (const line of gitStatus.stdout.trim().split('\n')) {
        console.log('    ' + col.yellow(line));
      }
      const gitDiffResult = git(['diff', '--stat']);
      if (gitDiffResult.ok && gitDiffResult.stdout.trim()) {
        console.log('');
        for (const line of gitDiffResult.stdout.trim().split('\n')) {
          console.log('    ' + col.dim(line));
        }
      }
      console.log('');
      console.log(col.bold('  下一步：'));
      console.log(col.dim('   git add -A && git commit -m "sync: from <hostname>" && git push'));
    } else {
      console.log(col.green('  與 repo 完全一致，無變動'));
    }
  }
  console.log('');
  return EXIT_OK;
}

/**
 * to-local 指令：repo 設定同步到本機
 * @param {ParsedArgs} opts - CLI 引數
 * @returns {Promise<number>} exit code
 */
async function runToLocal(opts) {
  const dryRun = opts.dryRun;

  if (dryRun) {
    console.log(col.bold('\n  [dry-run] repo -> 本機（不寫入任何檔案）\n'));
  } else {
    console.log(col.bold('\n  repo -> 本機\n'));
  }

  // 預覽
  if (!dryRun) console.log('  預覽（尚未套用）：\n');

  const preview = [];

  const claudeStatus = diffFile(
    path.join(REPO_ROOT, 'claude', 'CLAUDE.md'),
    path.join(CLAUDE_HOME, 'CLAUDE.md'),
  );
  if (claudeStatus) preview.push({ label: '~/.claude/CLAUDE.md', status: claudeStatus });

  // settings.json
  {
    const repoPath = path.join(REPO_ROOT, 'claude', 'settings.json');
    const localPath = path.join(CLAUDE_HOME, 'settings.json');
    if (fs.existsSync(repoPath)) {
      const repo = readJson(repoPath);
      const local = fs.existsSync(localPath) ? readJson(localPath) : {};
      const localClean = { ...local };
      for (const field of DEVICE_FIELDS) delete localClean[field];
      const repoStr = JSON.stringify(repo, null, 2);
      const localStr = JSON.stringify(localClean, null, 2);
      if (repoStr !== localStr) {
        preview.push({
          label: '~/.claude/settings.json',
          status: fs.existsSync(localPath) ? 'changed' : 'new',
        });
      }
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
    console.log(col.green('  本機與 repo 完全一致，無需套用\n'));
    return EXIT_OK;
  }

  for (const p of preview) {
    if (p.status === 'new') {
      printStatusLine('added', p.label);
    } else if (p.status === 'deleted') {
      printStatusLine('deleted', p.label);
    } else {
      printStatusLine('changed', p.label);
    }
  }

  if (dryRun) {
    console.log(col.dim('\n  以上為預覽，未實際寫入任何檔案\n'));
    return EXIT_OK;
  }

  console.log('');
  const confirmed = await askConfirm(col.bold('  套用以上變更？(y/N) '));
  if (!confirmed) {
    console.log('\n  已取消\n');
    return EXIT_OK;
  }
  console.log('');

  // 套用
  isWriting = true;
  const stats = { added: 0, updated: 0, deleted: 0 };
  const changeLog = [];

  try {
    {
      const src = path.join(REPO_ROOT, 'claude', 'CLAUDE.md');
      const dest = path.join(CLAUDE_HOME, 'CLAUDE.md');
      const existed = fs.existsSync(dest);
      if (copyFile(src, dest, true)) {
        const action = existed ? 'updated' : 'added';
        stats[action]++;
        changeLog.push(`CLAUDE.md (${action})`);
      }
    }

    if (mergeSettingsJson('to-local')) {
      stats.updated++;
      changeLog.push('settings.json (updated)');
    }

    {
      const src = path.join(REPO_ROOT, 'claude', 'statusline.sh');
      const dest = path.join(CLAUDE_HOME, 'statusline.sh');
      const existed = fs.existsSync(dest);
      if (copyFile(src, dest, true)) {
        const action = existed ? 'updated' : 'added';
        stats[action]++;
        changeLog.push(`statusline.sh (${action})`);
      }
    }

    for (const c of mirrorDir(
      path.join(REPO_ROOT, 'claude', 'agents'),
      path.join(CLAUDE_HOME, 'agents'),
      [], true,
    )) {
      stats[c.action]++;
      changeLog.push(`agents/${c.rel} (${c.action})`);
    }

    for (const c of mirrorDir(
      path.join(REPO_ROOT, 'claude', 'commands'),
      path.join(CLAUDE_HOME, 'commands'),
      [], true,
    )) {
      stats[c.action]++;
      changeLog.push(`commands/${c.rel} (${c.action})`);
    }
  } finally {
    isWriting = false;
  }

  console.log('  同步完成：\n');
  printSummary(stats);

  if (changeLog.length > 0) {
    console.log('');
    for (const ch of changeLog) console.log(`    ${ch}`);
    appendSyncLog('to-local', changeLog);
  }
  console.log('');
  return EXIT_OK;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Skills Handler — Skills 管理指令
// skills:diff 與 skills:add 的實作
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * skills:diff 指令：比對本機與 repo 的 skills 差異
 * @returns {number} exit code
 */
function runSkillsDiff() {
  console.log(col.bold('\n  Skills 差異比對\n'));

  const repoLockPath = path.join(REPO_ROOT, 'skills-lock.json');
  const localLockPath = path.join(AGENTS_HOME, '.skill-lock.json');

  let repoSkills = {};
  let localSkills = {};

  if (fs.existsSync(repoLockPath)) {
    const data = readJson(repoLockPath);
    repoSkills = (data && data.skills) || {};
  }
  if (fs.existsSync(localLockPath)) {
    const data = readJson(localLockPath);
    localSkills = (data && data.skills) || {};
  }

  const onlyInRepo  = Object.keys(repoSkills).filter(n => !localSkills[n]);
  const onlyInLocal = Object.keys(localSkills).filter(n => !repoSkills[n]);
  const inBoth      = Object.keys(repoSkills).filter(n =>  localSkills[n]);

  if (inBoth.length === 0 && onlyInRepo.length === 0 && onlyInLocal.length === 0) {
    console.log(col.green('  本機與 repo 完全一致\n'));
    return EXIT_OK;
  }

  // 一致的
  for (const name of inBoth) {
    printStatusLine('ok', name);
  }

  // repo 有、本機沒裝
  for (const name of onlyInRepo) {
    printStatusLine('down', name, 'repo 有、本機未安裝');
  }

  // 本機有、repo 沒記錄
  for (const name of onlyInLocal) {
    printStatusLine('up', name, '本機有、repo 未記錄');
  }

  // 建議指令
  if (onlyInRepo.length > 0) {
    console.log(col.bold('\n  -- 安裝缺少的 skills --'));
    for (const name of onlyInRepo) {
      const skill = repoSkills[name];
      if (skill && skill.source) {
        console.log(`    npx skills add ${skill.source} -g -y --skill ${name} --agent claude-code`);
      }
    }
  }

  if (onlyInLocal.length > 0) {
    console.log(col.bold('\n  -- 本機多裝的 skills（自行決定是否移除） --'));
    for (const name of onlyInLocal) {
      console.log(`    npx skills remove ${name} -g -y`);
    }
  }

  console.log('');
  return (onlyInRepo.length > 0 || onlyInLocal.length > 0) ? EXIT_DIFF : EXIT_OK;
}

/**
 * skills:add 指令：新增 skill 到 skills-lock.json
 * @returns {number} exit code
 */
function runSkillsAdd() {
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  let name, source;

  if (!arg1) {
    throw new SyncError(
      '請提供 skill 來源\n' +
      '  用法 1：node sync.js skills:add https://skills.sh/<org>/<repo>/<skill>\n' +
      '  用法 2：node sync.js skills:add <name> <source>',
      ERR.INVALID_ARGS,
    );
  }

  if (arg1.startsWith('https://skills.sh/')) {
    const parts = arg1.replace('https://skills.sh/', '').split('/');
    if (parts.length < 3) {
      throw new SyncError(
        '無法解析 skills.sh URL，格式應為 https://skills.sh/<org>/<repo>/<skill>',
        ERR.INVALID_ARGS,
        { url: arg1 },
      );
    }
    source = `${parts[0]}/${parts[1]}`;
    name = parts[2];
  } else if (arg1 && arg2) {
    name = arg1;
    source = arg2;
  } else {
    throw new SyncError(
      '參數不足\n' +
      '  用法 1：node sync.js skills:add https://skills.sh/<org>/<repo>/<skill>\n' +
      '  用法 2：node sync.js skills:add <name> <source>',
      ERR.INVALID_ARGS,
    );
  }

  const repoLockPath = path.join(REPO_ROOT, 'skills-lock.json');
  let lock;
  if (fs.existsSync(repoLockPath)) {
    lock = readJson(repoLockPath);
  } else {
    lock = { version: 1, skills: {} };
  }

  if (!lock.skills) lock.skills = {};

  if (lock.skills[name]) {
    console.log(col.yellow(`\n  [!] ${name} 已存在於 skills-lock.json（source: ${lock.skills[name].source}）`));
    console.log(col.dim('  若要更新來源，請手動編輯 skills-lock.json\n'));
    return EXIT_OK;
  }

  lock.skills[name] = { source, sourceType: 'github' };
  writeJsonSafe(repoLockPath, lock);

  console.log(col.bold(`\n  已加入 ${col.cyan(name)}`));
  console.log(col.dim(`  source: ${source}\n`));
  console.log(col.bold('  安裝指令：'));
  console.log(`    npx skills add ${source} -g -y --skill ${name} --agent claude-code\n`);
  return EXIT_OK;
}

/**
 * help 指令：顯示所有可用指令與說明
 */
function runHelp() {
  const pkg = readPackageJson();
  const version = pkg ? pkg.version : 'unknown';

  console.log(col.bold(`\n  sync-ai v${version}`));
  console.log(col.dim('  跨裝置 Claude Code 設定同步工具\n'));

  console.log(col.bold('  指令：'));
  console.log(`    ${col.cyan('diff')}          ${col.dim('(d)')}     比對本機與 repo 差異`);
  console.log(`    ${col.cyan('to-repo')}       ${col.dim('(tr)')}    本機設定 -> repo`);
  console.log(`    ${col.cyan('to-local')}      ${col.dim('(tl)')}    repo 設定 -> 本機`);
  console.log(`    ${col.cyan('skills:diff')}   ${col.dim('(sd)')}    比對 skills 差異`);
  console.log(`    ${col.cyan('skills:add')}    ${col.dim('(sa)')}    新增 skill 到 skills-lock.json`);
  console.log(`    ${col.cyan('help')}                   顯示此說明`);

  console.log(col.bold('\n  旗標：'));
  console.log(`    ${col.cyan('--dry-run')}              預覽操作，不實際寫入`);
  console.log(`    ${col.cyan('--verbose')}              顯示詳細路徑與檔案大小`);
  console.log(`    ${col.cyan('--version')}              顯示版本號`);
  console.log(`    ${col.cyan('--help')}                 顯示此說明`);

  console.log(col.bold('\n  範例：'));
  console.log(col.dim('    node sync.js diff'));
  console.log(col.dim('    node sync.js to-repo --dry-run'));
  console.log(col.dim('    node sync.js skills:add https://skills.sh/anthropics/skills/web-search'));
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: CLI Parser — 命令列引數解析
// 集中解析所有 CLI 引數與旗標
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ParsedArgs
 * @property {string|null} command - 指令名稱
 * @property {boolean} dryRun - 是否為 dry-run 模式
 * @property {boolean} verbose - 是否為 verbose 模式
 * @property {boolean} showVersion - 是否顯示版本
 * @property {boolean} showHelp - 是否顯示 help
 */

/**
 * 解析 CLI 引數
 * @returns {ParsedArgs}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    command: null,
    dryRun: false,
    verbose: false,
    showVersion: false,
    showHelp: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--verbose') {
      result.verbose = true;
    } else if (arg === '--version') {
      result.showVersion = true;
    } else if (arg === '--help' || arg === '-h') {
      result.showHelp = true;
    } else if (!arg.startsWith('--') && result.command === null) {
      // 解析指令（含別名）
      const resolved = COMMAND_ALIASES[arg] || arg;
      if (VALID_COMMANDS.includes(resolved)) {
        result.command = resolved;
      } else {
        result.command = arg; // 保留原值，由 main() 處理錯誤
      }
    }
    // skills:add 的額外引數由 runSkillsAdd 自行處理
  }

  return result;
}

/**
 * 讀取 package.json（不丟出錯誤）
 * @returns {Record<string, unknown>|null}
 */
function readPackageJson() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Interactive — 互動確認
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 向使用者提問並等待確認
 * @param {string} question - 問題文字
 * @returns {Promise<boolean>} 使用者是否確認
 */
function askConfirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Main — 程式進入點
// 根據 CLI 引數分派到對應指令
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 主函式：解析引數、分派指令、統一錯誤處理
 */
async function main() {
  const opts = parseArgs();

  // --version
  if (opts.showVersion) {
    const pkg = readPackageJson();
    console.log(pkg ? pkg.version : 'unknown');
    process.exit(EXIT_OK);
  }

  // --help 或 help 指令
  if (opts.showHelp || opts.command === 'help') {
    runHelp();
    process.exit(EXIT_OK);
  }

  // 無指令
  if (!opts.command) {
    runHelp();
    process.exit(EXIT_ERROR);
  }

  // 無效指令
  if (!VALID_COMMANDS.includes(opts.command)) {
    throw new SyncError(
      `未知指令：${opts.command}`,
      ERR.INVALID_ARGS,
    );
  }

  // 分派指令
  let exitCode = EXIT_OK;

  switch (opts.command) {
    case 'diff':
      exitCode = runDiff(opts);
      break;
    case 'to-repo':
      exitCode = runToRepo(opts);
      break;
    case 'to-local':
      exitCode = await runToLocal(opts);
      break;
    case 'skills:diff':
      exitCode = runSkillsDiff();
      break;
    case 'skills:add':
      exitCode = runSkillsAdd();
      break;
  }

  process.exit(exitCode);
}

// 統一錯誤處理入口
main().catch(err => {
  formatError(err);
  process.exit(EXIT_ERROR);
});
