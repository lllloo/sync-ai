# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。

## 執行環境

- **OS**：Windows 11（主力）/ macOS（次要）— 跨平台設計
- **Node.js**：>= 18（LTS），零外部相依，禁止新增 npm 套件
- **工具**：`node`、`npm`、`git` — 無 Python/pip 環境，不依賴

## 常用指令

**同步：**
- `npm run diff` — 純比較本機 vs repo，顯示差異（不寫任何東西）
- `npm run status` — 同時比較設定與 skills 差異（等同依序執行 `diff` + `skills:diff`）
- `npm run to-repo` — 本機 → repo（完成後顯示 git diff）
- `npm run to-local` — repo → 本機（先預覽，確認後才套用）

**Skills（獨立管理，不自動同步）：**
- `npm run skills:diff` — 比較本機已安裝 vs `skills-lock.json`，列出差異並提供安裝／移除指令
- `npm run skills:add -- <url>` 或 `npm run skills:add -- <name> <source>` — 新增 skill 記錄

**測試：**
- `npm test` — 執行 `test/sync.test.js` 純函式單元測試（`node --test`，零相依）
- 單一測試：`node --test --test-name-pattern="<name>" test/sync.test.js`

**全域旗標**（`node sync.js` 直接呼叫時可用）：`--dry-run`、`--verbose`、`--version`、`--help`。指令別名：`d`/`s`/`tr`/`tl`/`sd`/`sa`。

## 同步項目與對應

| repo 路徑 | 本機路徑 | 備註 |
|-----------|----------|------|
| `claude/CLAUDE.md` | `~/.claude/CLAUDE.md` | 全文比對 |
| `claude/settings.json` | `~/.claude/settings.json` | **比對時 strip `model`、`effortLevel`（裝置特定欄位）** |
| `claude/statusline.sh` | `~/.claude/statusline.sh` | 全文比對 |
| `claude/agents/` | `~/.claude/agents/` | 以 package 子目錄組織（如 `awesome-claude-code-subagents/`） |
| `claude/commands/` | `~/.claude/commands/` | 目錄鏡射 |

## 架構重點

**單檔 CLI 設計**：所有邏輯在 `sync.js`（~1800 行，零外部相依，只用 Node.js 內建模組）。檔案結構採 section banner 分段，關鍵不變式：

- **所有函式 ≤ 60 行**（經 iter4/iter5 稽核強制）— 新增函式若超過需拆分
- **Data-driven dispatch**：`COMMANDS` 物件含 `handler`，`main()` 透過 `await COMMANDS[cmd].handler(opts)` 派發，**新增指令只需改 `COMMANDS`**
- **SyncItem 抽象**：`buildSyncItems()` 產出宣告式 `SyncItem[]`，後續 `diffSyncItems` / `applySyncItems` 走統一流程
- **Atomic write**：`writeJsonSafe` 先寫暫存檔再 rename（含 EXDEV fallback），避免斷電損壞
- **統一錯誤處理**：`SyncError` class（`code` + `context`）+ 檔尾 `.catch(formatError)`，所有路徑經 `formatError`，**禁止**裸 `console.error + process.exit`
- **Exit code 語義**：`EXIT_OK=0`（成功或 diff 無差異）、`EXIT_DIFF=1`（diff 有差異，可用於 CI）、`EXIT_ERROR=2`
- **Relative path 遮罩**：`toRelativePath` 處理 REPO_ROOT 與 `$HOME` → `~/`，`printFileDiff` 的 diff header 亦走此函式避免洩漏使用者名稱
- **Skills lock 為純資料 manifest**：`skills-lock.json` 不參與同步流程；`runSkillsDiff` 透過 `npx skills list` 抓本機狀態做集合比對，**只輸出建議指令、不執行安裝/移除**。本機多裝的 skills 會同時列出（A）`npm run skills:add` 加入 repo 與（B）`npx skills remove` 從本機移除兩種選項

**測試策略**：`test/sync.test.js` 只測純函式（`computeLineDiff`、`matchExclude`、`statusToStatsKey`、`parseSkillSource`、`parseArgs`、`toRelativePath`、`COMMANDS` 完整性）。有 IO 的路徑靠 smoke test 人工驗證。若改純函式，**必須**同步更新 unit test，維持全數通過（視同 100% 覆蓋）。

## 修改守則

- **README.md 須同步更新**：新增/移除指令、改變同步項目、調整行為、新增旗標時必跟。
- **新增/調整 npm script 時須同步更新 README 的指令別名表與 `COMMANDS` 物件**，避免別名與 handler 漂移。
- **函式行數守則**：新增或重構後若某函式 > 60 行，需拆分（`buildSyncItems` 54 行為宣告式陣列，例外）。
- **禁止新增外部相依**：所有功能必須使用 Node.js 內建模組，不得 `npm install` 任何套件。
- **settings.json 裝置特定欄位**（`model`、`effortLevel`）若要增減，需同步改 `DEVICE_FIELDS` 常數與 README 注意事項。
- **Bash 規則**（來自全域 CLAUDE.md）：禁用 `$()` 命令替換；禁擅自執行 `npm run build`。
- **嚴禁洩漏敏感資訊**：輸出、log、diff 內容中不得出現 API Key、token 或完整使用者路徑。

## Agents 管理

`claude/agents/` 以 package 子目錄組織，來源優先順序：

1. **`everything-claude-code/`**（主要）— 來自 `affaan-m/everything-claude-code`
2. **`awesome-claude-code-subagents/`**（補充）— 來自 `VoltAgent/awesome-claude-code-subagents`，依分類子目錄組織（`categories/01-core-development/` 等），僅安裝 `everything-claude-code` 未涵蓋的功能

**新增 agent 的方式**（用 `gh` 抓原始內容）：
```bash
# 從 everything-claude-code
gh api repos/affaan-m/everything-claude-code/contents/agents/<name>.md --jq '.content' | base64 -d > claude/agents/everything-claude-code/<name>.md

# 從 awesome-claude-code-subagents（需指定分類路徑）
gh api "repos/VoltAgent/awesome-claude-code-subagents/contents/categories/<category>/<name>.md" --jq '.content' | base64 -d > claude/agents/awesome-claude-code-subagents/<name>.md
```

## 注意事項

- `.agents/`（skill 實體）、`.sync-history.log`、`.DS_Store` 皆在 `.gitignore`
- Skills 不在自動同步範圍，`skills-lock.json` 為各裝置參考清單（source of truth）

<!-- GSD:project-start source:PROJECT.md -->
## Project

**sync-ai 完整體檢**

針對 sync-ai（Claude Code 跨裝置設定同步工具）進行一次完整的功能驗證與健康檢查。涵蓋指令功能正確性、邊界與錯誤處理、跨平台相容性、以及單元測試覆蓋缺口分析。產出為結構化體檢報告，不修改程式碼。

**Core Value:** 確認所有同步指令（diff / to-repo / to-local / skills:diff）在各種情境下行為正確，不會造成使用者設定遺失或損壞。

### Constraints

- **零外部相依**：驗證過程中不可引入新套件，測試補強建議也必須基於 node:test
- **不改程式碼**：本次產出為報告，不直接修改 sync.js 或測試檔案
- **跨平台考量**：主力 Windows 11，次要 macOS，報告需涵蓋兩平台差異
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (Node.js) - All application logic and CLI tools
- Bash - Utilities like `statusline.sh`
## Runtime
- Node.js >= 18 (LTS) - Required for all operations
- npm - Command runner and script execution
- Lockfile: Not present (zero external dependencies)
## Frameworks
- Node.js Built-in Modules Only
- node:test (Node.js Built-in) - Pure function unit testing
- No build tools needed - Single file architecture (`sync.js`)
## Key Dependencies
- None - Zero external npm dependencies by design
- Git CLI - External tool for version control operations
- Bash/POSIX Tools - External utilities
## Configuration
- User home directory: `process.env.HOME` (macOS/Linux) or `os.homedir()` (Windows)
- No `.env` files required - Configuration stored in version-controlled JSON files
- No build configuration needed
- Single entry point: `sync.js` (shebang: `#!/usr/bin/env node`)
- `package.json` - npm scripts and project metadata
- `skills-lock.json` - Global skills manifest (cross-device source of truth)
- `claude/settings.json` - Claude Code settings template (contains device-specific fields: `model`, `effortLevel`)
## Platform Requirements
- Node.js >= 18
- Git (any recent version)
- Bash or POSIX-compatible shell
- Working directory: Git repository root
- Windows 11+ (primary development platform)
- macOS (secondary)
- Linux (POSIX-compatible)
- Same requirements as development
- No separate production build step
- Git access required for sync operations
- `npx` available for skills management
## Data Storage
- Local user configuration: `~/.claude/` directory structure
- Repo-tracked configuration: `./claude/` directory
- JSON files for settings and skills manifest
- Uses temporary file + atomic rename pattern in `writeJsonSafe()`
- EXDEV fallback for cross-filesystem moves (Windows temporary directory behavior)
## External Tool Integration
- Spawned via `child_process.spawnSync('git', ...)`
- Operations: diff, status, used by CI systems (exit code `1` for diff mode)
- `diff` command spawned via `child_process.spawnSync`
- Used for line-by-line diff output (fallback for large files exceeds LCS_MAX_LINES=2000 lines)
- `npx skills` - Installed globally with `-g` flag
- Operations: `npx skills add`, `npx skills list`, `npx skills remove`
- Not executed by sync tool - only suggested via CLI output
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- `sync.js` — single-file CLI entry point (monolithic design)
- `test/*.test.js` — test files follow pattern `<module>.test.js` (e.g., `sync.test.js`, `settings.test.js`)
- `*.json` — configuration files (`package.json`, `skills-lock.json`, `.prettierrc` etc.)
- camelCase for all function declarations
- Prefix names with operation type: `run*` (command handlers), `check*` (validation), `get*` (accessors), `compute*` (transformations), `print*` (output), `parse*` (input parsing)
- All functions must be ≤ 60 lines (strict limit enforced during review)
- Examples: `runDiff`, `checkReadAccess`, `getFiles`, `computeLineDiff`, `printStatusLine`, `parseArgs`
- camelCase for local variables and constants
- SCREAMING_SNAKE_CASE for truly immutable constants and enum-like objects
- Constants grouped at module top in dedicated section (marked with `// Constants` comment)
- Examples: `EXIT_OK`, `STATUS_ICONS`, `DEVICE_FIELDS`, `REPO_ROOT`, `srcContent`, `tmpPath`
- PascalCase for error class (`SyncError`)
- JSDoc @typedef for complex objects defined as comments near constant declarations
- Examples: `SyncItem`, `ParsedArgs`, etc.
- Use `const obj = { key: value, ... }` for dispatch tables and configuration
- Example: `COMMANDS` object with `{ alias, desc, handler }` structure
- Example: `STATUS_ICONS` object mapping status→icon/color pairs
## Code Style
- No formatter detected (manually maintained)
- 2-space indentation
- Line length: unrestricted but reasonable (most lines < 100 chars)
- Blank lines used to separate logical sections within functions
- No eslint config detected
- Convention is `'use strict'` at top of all modules
- Prefer explicit error handling (no silent catches except where intentional with `/* ignore */` comments)
- Code divided into logical sections marked with banner comments:
- Each section contains related functions and comments on dependencies
- Section order: Constants → ANSI Colors → Errors → Tempfile Registry → Signal Handling → External Tools → FS Utilities → Git Utilities → Diff Engine → Output → Settings Handler → Operation Log → Sync Core → Commands → CLI Parser → Interactive → Main
- This organization enables grep-friendly navigation and clear responsibility boundaries
## Import Organization
- None used; all paths relative to file location
- Dual-mode module (can run as CLI or be required for testing)
- Entry point: `if (require.main === module)` check
- When run directly: `main().catch(err => {...}).then(exitCode => process.exit(exitCode))`
- When imported: explicit `module.exports = { func1, func2, ... }` listing only public functions
- Test exports limited to pure functions; IO-dependent code tested via smoke tests
- Example in `sync.js` (lines 1788-1818): exports `computeLineDiff`, `parseArgs`, error codes, constants
## Error Handling
- All errors thrown as `SyncError` class (custom error with `code` + `context` fields)
- Error codes defined in `ERR` constant object: `FILE_NOT_FOUND`, `JSON_PARSE`, `GIT_ERROR`, `PERMISSION`, `INVALID_ARGS`, `IO_ERROR`
- SyncError format: `new SyncError(message, code, { path, ... })`
- Centralized `formatError(err)` function (not called inline) — all errors routed through it before exit
- Hints provided for each error code (map in `formatError`, line 166–173)
- Context information (like file path) stored as object, not interpolated in message, then masked via `toRelativePath` to avoid leaking user home directory
- Never use `throw new Error(...)` or bare `process.exit()`; always use `SyncError` and let `formatError` handle display
## Logging
- `console.log()` for normal output
- `console.error()` for errors (but prefer `formatError` wrapper)
- Output always wrapped in `col.*()` color function for consistent styling
- Color conditional: only output ANSI codes if `process.stdout.isTTY` is true
- Indentation: 2 spaces for nested output
- Examples: `console.log(col.dim('  無任何變更'))`, `console.error(col.red('  [!] ' + message))`
- Verbose mode: `--verbose` flag enables additional path display via `logVerbosePaths()`
- Dry-run mode: all output prefixed with indication that no writes occur
- Normal: summary statistics and status icons
## Comments
- Comment non-obvious algorithm choices (e.g., LCS DP in `computeLineDiff`, line 626–666)
- Explain workarounds (e.g., Windows EXDEV fallback for atomic writes, line 373–376)
- Document design decisions in section banners (e.g., why tempfile registry exists, line 213–215)
- Mark intentional error ignores with `/* ignore */` or `/* 忽略 */`
- Comprehensive JSDoc comments on all public functions
- Format: `/** ... */` with `@param`, `@returns`, `@throws` tags
- All parameters typed with type hints in curly braces
- Example (lines 296–310):
- Optional parameters denoted with square brackets: `@param {string} [base='']`
- No JSDoc for private helper functions (only public/exported ones)
## Function Design
- Enforced during review; larger functions must be split
- Exception: `buildSyncItems` (line 949) is 54 lines because it's a declarative array, not procedural logic
- Prefer few parameters (usually ≤ 4); bundle related params into config object if needed
- Use options object for boolean flags: `{ dryRun: false, force: false, verbose: false }`
- Always provide default values for optional parameters: `function copyFile(src, dest, force = false, dryRun = false)`
- Prefer single return type per function (no `null | object | boolean` mixed returns)
- When file missing is expected, return `null` explicitly; throw `SyncError` only for permission errors
- Boolean returns for "did something change?" queries
- Object returns for structured data (e.g., `{ clean, serialized }` from `loadStrippedSettings`)
## Module Design
- Single file (`sync.js`) exports only pure functions and constants
- Pure functions = no file I/O, no process mutation, deterministic
- Examples of exported: `computeLineDiff`, `parseArgs`, `matchExclude`, `toRelativePath`, `SyncError`
- Examples NOT exported: `runDiff`, `buildSyncItems` (contain I/O), command handlers (dispatch-only)
- Avoid circular imports (not applicable in single-file design)
- None used; monolithic single-file design with clear section organization
## Language
- Function names, variable names, comments, error messages, help text all in Traditional Chinese
- Technical terms (e.g., "sync", "diff", "CLI") may remain in English for clarity
- JSDoc comments also in Chinese
## Data-Driven Dispatch
- Command handlers defined in `COMMANDS` object (line 63–71)
- Each command entry: `{ alias: string|null, desc: string, handler: function|null }`
- Handlers injected at runtime in `attachCommandHandlers()` (line 1774–1782) to avoid TDZ
- Main dispatch: `await entry.handler(opts)` (line 1767)
- Adding new command: only modify `COMMANDS` object, no changes to `main()` needed
## Atomic Write Pattern
- Write to temporary file first: `filePath + '.tmp.' + process.pid`
- Register temp file for cleanup on exit
- Rename temp → destination (atomic on same filesystem)
- Fallback: if rename fails with EXDEV (cross-device), write directly
- Clean up temp file in `finally` block regardless
- Used in `writeJsonSafe()` (line 363–383)
## Path Masking
- `toRelativePath()` (line 197–210) converts absolute paths to relative for safe display
- Prefers paths relative to REPO_ROOT (inside repo)
- Falls back to `~/...` for paths in HOME directory
- Never displays full absolute path containing username
- Used in error context display (line 181) and diff headers (line 703)
- Prevents leaking user home directory in logs/output
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## 模式概述
- 整個應用邏輯於 `sync.js` 單檔內（~1800 行，零外部相依）
- 所有函式 ≤ 60 行（強制要求，便於可讀性與測試）
- 聲明式 `COMMANDS` 物件驅動命令派發，無條件分支
- `SyncItem` 抽象統一所有同步操作，三條指令共用單一處理管道
- 支援 dry-run 模式，同步前完整預覽
## 層級
- 目的：解析使用者輸入，分派至對應指令
- 位置：`sync.js` 1736-1782 行（`main()` 與 `attachCommandHandlers()`）
- 包含：指令解析、引數驗證、幫助文本
- 依賴：`parseArgs()` / `COMMANDS` 表
- 使用者：終端使用者（npm scripts 或直接呼叫）
- 目的：各指令的業務邏輯（diff / to-repo / to-local / skills 管理）
- 位置：`sync.js` 1274-1531 行（`runDiff` / `runToRepo` / `runToLocal` / `runSkillsDiff` 等）
- 包含：flow control、使用者互動、統計與日誌
- 依賴：核心同步層、display 層
- 使用者：`main()` 透過 `attachCommandHandlers()` 注入的 handler
- 目的：同步項目建立、差異計算、套用變更
- 位置：`sync.js` 948-1132 行（`buildSyncItems` / `diffSyncItems` / `applySyncItems`）
- 包含：`SyncItem` 聲明、方向性同步邏輯
- 依賴：FS utilities、Settings handler
- 使用者：指令層的各 handler
- 目的：原子檔案操作、目錄遞迴、權限檢查
- 位置：`sync.js` 291-530 行（`readJson` / `writeJsonSafe` / `copyFile` / `mirrorDir` 等）
- 包含：寫入安全（tmp + rename）、permission 檢查、EXDEV fallback
- 依賴：Node.js 內建 `fs` / `path`
- 使用者：核心同步層、Settings handler
- 目的：settings.json 去除裝置欄位、合併邏輯
- 位置：`sync.js` 831-910 行（`serializeSettings` / `loadStrippedSettings` / `mergeSettingsJson`）
- 包含：DEVICE_FIELDS 排除、序列化對稱性
- 依賴：FS utilities
- 使用者：核心同步層（settings 項目處理）
- 目的：統一格式化終端輸出，狀態圖示與色碼
- 位置：`sync.js` 793-828 行 與各指令內（`printStatusLine` / `printSummary` / `printFileDiff`）
- 包含：狀態圖示映射、ANSI 色碼、差異視覺化
- 依賴：`STATUS_ICONS` 常數、`col` 色碼工具函數
- 使用者：所有指令
- 目的：統一錯誤分類與顯示，含修復建議
- 位置：`sync.js` 123-210 行（`SyncError` class / `formatError()`）
- 包含：錯誤代碼（FILE_NOT_FOUND / JSON_PARSE / GIT_ERROR 等）、路徑遮罩
- 依賴：無
- 使用者：所有層，最終由 `main().catch()` 統一處理
## 資料流
## 關鍵抽象
- 目的：統一描述各類同步項目（檔案 / 目錄 / settings）
- 結構：`{ label, src, dest, type, verboseSrc, verboseDest }`
- 例子：
- 目的：封裝 CLI 引數
- 結構：`{ command, dryRun, verbose, showVersion, showHelp, extraArgs }`
- 目的：描述單項差異
- 結構：`{ label, status, src, dest, verboseSrc, verboseDest, itemType }`
- status 值：`null`（一致） / `'new'`（本機有） / `'changed'`（不同） / `'deleted'`（repo 有）
## 進入點
- 位置：`sync.js` 1788-1795 行（`if (require.main === module)` 區塊）
- 觸發：直接執行 `node sync.js` 或 npm script
- 責任：呼叫 `main()`，統一捕捉錯誤，呼叫 `process.exit(exitCode)`
- 位置：`sync.js` 1796-1819 行（`else` 區塊）
- 觸發：被 `require('./sync.js')` 引入（單元測試）
- 責任：匯出純函式供 `test/sync.test.js` 使用
## 錯誤處理
- `FILE_NOT_FOUND`：檔案不存在，提示檢查路徑
- `JSON_PARSE`：JSON 格式錯誤，提示使用 jsonlint 驗證
- `GIT_ERROR`：Git 操作失敗，提示確認 git 安裝與 repo 狀態
- `PERMISSION`：檔案權限不足
- `INVALID_ARGS`：使用者引數錯誤
- `IO_ERROR`：磁碟操作失敗
- `toRelativePath()` 將絕對路徑轉為相對路徑（相對 repo 或 ~ 代替 $HOME）
- 所有錯誤訊息、diff header、verbose 輸出都經此函數，避免洩漏使用者目錄
## 跨切關注
- 位置：`sync.js` 917-936 行（`appendSyncLog()`）
- 何時：每次 to-repo / to-local 完成後
- 內容：timestamp / hostname / 變更清單
- 檔案：`.sync-history.log`（已 .gitignore）
- 讀取檔案時：`checkReadAccess()` 檢查權限
- 寫入檔案時：`checkWriteAccess()` 檢查已存在檔案的權限
- settings 合併時：去除 DEVICE_FIELDS（model / effortLevel）
- 無內建認證，依賴 git 層級認證
- to-repo 時檢查是否在 git repo 內（非 dry-run）
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| create-adaptable-composable | Create a library-grade Vue composable that accepts maybe-reactive inputs (MaybeRef / MaybeRefOrGetter) so callers can pass a plain value, ref, or getter. Normalize inputs with toValue()/toRef() inside reactive effects (watch/watchEffect) to keep behavior predictable and reactive. Use this skill when user asks for creating adaptable or reusable composables. | `.agents/skills/create-adaptable-composable/SKILL.md` |
| frontend-design | Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics. | `.agents/skills/frontend-design/SKILL.md` |
| skill-creator | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy. | `.agents/skills/skill-creator/SKILL.md` |
| vue-best-practices | MUST be used for Vue.js tasks. Strongly recommends Composition API with `<script setup>` and TypeScript as the standard approach. Covers Vue 3, SSR, Volar, vue-tsc. Load for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API unless the project explicitly requires Options API. | `.agents/skills/vue-best-practices/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
