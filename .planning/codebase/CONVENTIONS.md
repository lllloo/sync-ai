# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- `sync.js` — single-file CLI entry point (monolithic design)
- `test/*.test.js` — test files follow pattern `<module>.test.js` (e.g., `sync.test.js`, `settings.test.js`)
- `*.json` — configuration files (`package.json`, `skills-lock.json`, `.prettierrc` etc.)

**Functions:**
- camelCase for all function declarations
- Prefix names with operation type: `run*` (command handlers), `check*` (validation), `get*` (accessors), `compute*` (transformations), `print*` (output), `parse*` (input parsing)
- All functions must be ≤ 60 lines (strict limit enforced during review)
- Examples: `runDiff`, `checkReadAccess`, `getFiles`, `computeLineDiff`, `printStatusLine`, `parseArgs`

**Variables:**
- camelCase for local variables and constants
- SCREAMING_SNAKE_CASE for truly immutable constants and enum-like objects
- Constants grouped at module top in dedicated section (marked with `// Constants` comment)
- Examples: `EXIT_OK`, `STATUS_ICONS`, `DEVICE_FIELDS`, `REPO_ROOT`, `srcContent`, `tmpPath`

**Types/Classes:**
- PascalCase for error class (`SyncError`)
- JSDoc @typedef for complex objects defined as comments near constant declarations
- Examples: `SyncItem`, `ParsedArgs`, etc.

**Constants Object Pattern:**
- Use `const obj = { key: value, ... }` for dispatch tables and configuration
- Example: `COMMANDS` object with `{ alias, desc, handler }` structure
- Example: `STATUS_ICONS` object mapping status→icon/color pairs

## Code Style

**Formatting:**
- No formatter detected (manually maintained)
- 2-space indentation
- Line length: unrestricted but reasonable (most lines < 100 chars)
- Blank lines used to separate logical sections within functions

**Linting:**
- No eslint config detected
- Convention is `'use strict'` at top of all modules
- Prefer explicit error handling (no silent catches except where intentional with `/* ignore */` comments)

**Section Organization in `sync.js`:**
- Code divided into logical sections marked with banner comments:
  ```javascript
  // =============================================================================
  // Section: [Name] -- [Description]
  // =============================================================================
  ```
- Each section contains related functions and comments on dependencies
- Section order: Constants → ANSI Colors → Errors → Tempfile Registry → Signal Handling → External Tools → FS Utilities → Git Utilities → Diff Engine → Output → Settings Handler → Operation Log → Sync Core → Commands → CLI Parser → Interactive → Main
- This organization enables grep-friendly navigation and clear responsibility boundaries

## Import Organization

**Order:**
1. Node.js built-ins: `const fs = require('fs')`
2. Local modules: `const { func } = require('../sync.js')`

**Path Aliases:**
- None used; all paths relative to file location

**Module Exports Pattern:**
- Dual-mode module (can run as CLI or be required for testing)
- Entry point: `if (require.main === module)` check
- When run directly: `main().catch(err => {...}).then(exitCode => process.exit(exitCode))`
- When imported: explicit `module.exports = { func1, func2, ... }` listing only public functions
- Test exports limited to pure functions; IO-dependent code tested via smoke tests
- Example in `sync.js` (lines 1788-1818): exports `computeLineDiff`, `parseArgs`, error codes, constants

## Error Handling

**Patterns:**
- All errors thrown as `SyncError` class (custom error with `code` + `context` fields)
- Error codes defined in `ERR` constant object: `FILE_NOT_FOUND`, `JSON_PARSE`, `GIT_ERROR`, `PERMISSION`, `INVALID_ARGS`, `IO_ERROR`
- SyncError format: `new SyncError(message, code, { path, ... })`
- Centralized `formatError(err)` function (not called inline) — all errors routed through it before exit
- Hints provided for each error code (map in `formatError`, line 166–173)
- Context information (like file path) stored as object, not interpolated in message, then masked via `toRelativePath` to avoid leaking user home directory
- Never use `throw new Error(...)` or bare `process.exit()`; always use `SyncError` and let `formatError` handle display

**Example:**
```javascript
// Good:
if (!fs.existsSync(filePath)) {
  throw new SyncError(`檔案不存在：${filePath}`, ERR.FILE_NOT_FOUND, { path: filePath });
}

// Bad:
throw new Error('file not found');
process.exit(1);
```

## Logging

**Framework:** console (Node.js built-in)

**Patterns:**
- `console.log()` for normal output
- `console.error()` for errors (but prefer `formatError` wrapper)
- Output always wrapped in `col.*()` color function for consistent styling
- Color conditional: only output ANSI codes if `process.stdout.isTTY` is true
- Indentation: 2 spaces for nested output
- Examples: `console.log(col.dim('  無任何變更'))`, `console.error(col.red('  [!] ' + message))`

**Log Levels (informal):**
- Verbose mode: `--verbose` flag enables additional path display via `logVerbosePaths()`
- Dry-run mode: all output prefixed with indication that no writes occur
- Normal: summary statistics and status icons

## Comments

**When to Comment:**
- Comment non-obvious algorithm choices (e.g., LCS DP in `computeLineDiff`, line 626–666)
- Explain workarounds (e.g., Windows EXDEV fallback for atomic writes, line 373–376)
- Document design decisions in section banners (e.g., why tempfile registry exists, line 213–215)
- Mark intentional error ignores with `/* ignore */` or `/* 忽略 */`

**JSDoc/TSDoc:**
- Comprehensive JSDoc comments on all public functions
- Format: `/** ... */` with `@param`, `@returns`, `@throws` tags
- All parameters typed with type hints in curly braces
- Example (lines 296–310):
  ```javascript
  /**
   * 檢查檔案讀取權限
   * @param {string} filePath - 要檢查的檔案路徑
   * @throws {SyncError} 當檔案無法讀取時
   * @returns {void}
   */
  ```
- Optional parameters denoted with square brackets: `@param {string} [base='']`
- No JSDoc for private helper functions (only public/exported ones)

## Function Design

**Size:** Maximum 60 lines (hard constraint)
- Enforced during review; larger functions must be split
- Exception: `buildSyncItems` (line 949) is 54 lines because it's a declarative array, not procedural logic

**Parameters:**
- Prefer few parameters (usually ≤ 4); bundle related params into config object if needed
- Use options object for boolean flags: `{ dryRun: false, force: false, verbose: false }`
- Always provide default values for optional parameters: `function copyFile(src, dest, force = false, dryRun = false)`

**Return Values:**
- Prefer single return type per function (no `null | object | boolean` mixed returns)
- When file missing is expected, return `null` explicitly; throw `SyncError` only for permission errors
- Boolean returns for "did something change?" queries
- Object returns for structured data (e.g., `{ clean, serialized }` from `loadStrippedSettings`)

## Module Design

**Exports:**
- Single file (`sync.js`) exports only pure functions and constants
- Pure functions = no file I/O, no process mutation, deterministic
- Examples of exported: `computeLineDiff`, `parseArgs`, `matchExclude`, `toRelativePath`, `SyncError`
- Examples NOT exported: `runDiff`, `buildSyncItems` (contain I/O), command handlers (dispatch-only)
- Avoid circular imports (not applicable in single-file design)

**Barrel Files:**
- None used; monolithic single-file design with clear section organization

## Language

**All text in Chinese (繁體中文):**
- Function names, variable names, comments, error messages, help text all in Traditional Chinese
- Technical terms (e.g., "sync", "diff", "CLI") may remain in English for clarity
- JSDoc comments also in Chinese

## Data-Driven Dispatch

**Pattern:**
- Command handlers defined in `COMMANDS` object (line 63–71)
- Each command entry: `{ alias: string|null, desc: string, handler: function|null }`
- Handlers injected at runtime in `attachCommandHandlers()` (line 1774–1782) to avoid TDZ
- Main dispatch: `await entry.handler(opts)` (line 1767)
- Adding new command: only modify `COMMANDS` object, no changes to `main()` needed

**Example:**
```javascript
COMMANDS['diff'] = { alias: 'd', desc: '比對...', handler: null }; // At top
// Later in attachCommandHandlers():
COMMANDS['diff'].handler = (opts) => runDiff(opts);
// Automatic dispatch in main():
return await COMMANDS[opts.command].handler(opts);
```

## Atomic Write Pattern

**Pattern:**
- Write to temporary file first: `filePath + '.tmp.' + process.pid`
- Register temp file for cleanup on exit
- Rename temp → destination (atomic on same filesystem)
- Fallback: if rename fails with EXDEV (cross-device), write directly
- Clean up temp file in `finally` block regardless
- Used in `writeJsonSafe()` (line 363–383)

## Path Masking

**Pattern:**
- `toRelativePath()` (line 197–210) converts absolute paths to relative for safe display
- Prefers paths relative to REPO_ROOT (inside repo)
- Falls back to `~/...` for paths in HOME directory
- Never displays full absolute path containing username
- Used in error context display (line 181) and diff headers (line 703)
- Prevents leaking user home directory in logs/output

---

*Convention analysis: 2026-04-09*
