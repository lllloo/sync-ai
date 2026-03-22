'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOME      = os.homedir();

const FILE_MAP = {
  'settings-json': { repo: 'claude/settings.json', local: '.claude/settings.json' },
  'claude-md':     { repo: 'claude/CLAUDE.md',     local: '.claude/CLAUDE.md' },
};

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function resolve(fileKey) {
  const entry = FILE_MAP[fileKey];
  if (!entry) return null;
  return {
    repoPath:  path.join(REPO_ROOT, entry.repo),
    localPath: path.join(HOME, entry.local),
  };
}

function checkSame(fileKey) {
  const paths = resolve(fileKey);
  if (!paths) return { same: false, error: `unknown file: ${fileKey}` };
  const repo  = (readFileSafe(paths.repoPath)  ?? '').replace(/\r\n/g, '\n');
  const local = (readFileSafe(paths.localPath) ?? '').replace(/\r\n/g, '\n');
  return { same: repo === local };
}

function writeLocal(fileKey) {
  const paths = resolve(fileKey);
  if (!paths) return { success: false, error: `unknown file: ${fileKey}` };
  const content = readFileSafe(paths.repoPath);
  if (content === null) return { success: false, error: 'repo file not found' };
  fs.writeFileSync(paths.localPath, content, 'utf8');
  return { success: true };
}

// ─── 主程式 ───────────────────────────────────────────────

const args   = process.argv.slice(2);
const getArg = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const action = getArg('--action');
const file   = getArg('--file') ?? 'settings-json';

let result;
try {
  if (action === 'check-same') {
    result = checkSame(file);
  } else if (action === 'write-local') {
    result = writeLocal(file);
  } else {
    result = { error: `Unknown --action: ${action}. 可用值：check-same | write-local` };
  }
} catch (e) {
  result = { success: false, error: e.message };
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
