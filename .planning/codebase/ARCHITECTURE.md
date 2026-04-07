# Architecture

**Analysis Date:** 2026-04-07

## Pattern Overview

**Overall:** Monolithic CLI with data-driven command dispatch

**Key Characteristics:**
- Single-file design (`sync.js` ~1700 lines, zero external dependencies)
- Section-banner organization for code modularity within single file
- Data-driven dispatch using `COMMANDS` object with injected handlers
- Declarative sync items (`SyncItem` abstraction) with unified processing pipeline
- Unified error handling via `SyncError` class with semantic error codes
- Atomic file writes (write-to-temp + rename) to prevent mid-operation corruption
- Pure function focus (all new functions ≤60 lines)

## Layers

**CLI Entry Layer:**
- Purpose: Parse command-line arguments and route to handlers
- Location: `sync.js` lines 1679-1711 (`main()` function)
- Contains: Argument parsing, global flag handling, command routing
- Depends on: `parseArgs()`, `COMMANDS` object, error handling
- Used by: Process entrypoint (line 1730)

**Command Handlers Layer:**
- Purpose: Implement each command's business logic (diff, to-repo, to-local, skills:diff, skills:add)
- Location: `sync.js` lines 1157-1610 (section "Commands")
- Contains: `runDiff()`, `runToRepo()`, `runToLocal()`, `runSkillsDiff()`, `runSkillsAdd()`, `runHelp()`
- Depends on: Sync core layer, output formatting utilities
- Used by: Data-driven dispatch in `main()`

**Sync Core Layer:**
- Purpose: Unified sync logic shared by diff/to-repo/to-local
- Location: `sync.js` lines 920-1074
- Contains: `buildSyncItems()` (declare what to sync), `diffSyncItems()` (compute differences), `applySyncItems()` (execute changes)
- Depends on: Diff engine, FS utilities, settings merge logic
- Used by: Command handlers, test suite

**Diff Engine Layer:**
- Purpose: Pure comparison logic (no writes)
- Location: `sync.js` lines 570-800 (section "Diff Engine")
- Contains: `diffFile()`, `diffDir()`, `computeLineDiff()`, `computeSimpleLineDiff()`, `getFiles()`, `matchExclude()`
- Depends on: FS utilities, LCS algorithm for line-level diffing
- Used by: Sync core layer

**FS Utilities Layer:**
- Purpose: File operations with safety guards
- Location: `sync.js` lines 289-528 (section "FS Utilities")
- Contains: `readJson()`, `writeJsonSafe()`, `copyFile()`, `mirrorDir()`, `ensureDir()`, permission checks
- Depends on: Node.js `fs` module, error handling
- Used by: Sync core, command handlers

**Git & External Tools Layer:**
- Purpose: Shell command execution and tool availability detection
- Location: `sync.js` lines 530-568 (section "Git Utilities") and lines 269-287 (section "External Tool Detection")
- Contains: `git()`, `isInsideGitRepo()`, `isGitAvailable()`, `isDiffAvailable()`
- Depends on: Node.js `child_process`, caching
- Used by: Command handlers (to-repo shows git status)

**Error Handling Layer:**
- Purpose: Semantic error representation and user-friendly formatting
- Location: `sync.js` lines 121-209 (section "Errors")
- Contains: `SyncError` class, `ERR` code constants, `formatError()`, `toRelativePath()`
- Depends on: ANSI color formatting
- Used by: All layers

**Output Formatting Layer:**
- Purpose: Terminal output with colors, status icons, and alignment
- Location: `sync.js` lines 106-119, 1547-1595 (sections "ANSI Colors", "Output Formatting")
- Contains: `col.*` color functions, `STATUS_ICONS`, `printStatusLine()`, `printFileDiff()`, `printVersion()`, `runHelp()`
- Depends on: TTY detection
- Used by: Command handlers, sync core for user feedback

**Settings Merge Layer:**
- Purpose: Special handling for settings.json with device-specific field stripping
- Location: `sync.js` lines 853-892 (section "Settings Merge")
- Contains: `mergeSettingsJson()`, `getStrippedSettings()`, `diffSettingsItem()`
- Depends on: FS utilities, device field constants (`DEVICE_FIELDS`)
- Used by: Sync core layer

**Temp File Management Layer:**
- Purpose: Clean up temporary files on any exit path (including SIGINT)
- Location: `sync.js` lines 212-267 (sections "Tempfile Registry", "Signal Handling")
- Contains: `registerTempFile()`, `cleanupTempFiles()`, signal handlers
- Depends on: Process lifecycle events
- Used by: Atomic write operations, process exit handler

**Skills Management Layer:**
- Purpose: Track Claude Code skills across devices
- Location: `sync.js` lines 1390-1510 (section "Skills Management")
- Contains: `readSkillsLock()`, `parseSkillSource()`, `runSkillsDiff()`, `runSkillsAdd()`
- Depends on: JSON I/O, URL parsing
- Used by: Command dispatch for `skills:*` commands

## Data Flow

**Diff Operation (read-only):**

1. User: `npm run diff` → `main()` with `opts.command = 'diff'`
2. `main()` → `runDiff(opts)`
3. `runDiff()`:
   - Calls `buildSyncItems('to-repo')` → declarative array of `SyncItem` objects
   - Calls `diffSyncItems(items, 'to-repo')` → compares src/dest, returns diff array
   - For each diff: calls `diffFile()` or `diffDir()` to compute status (null/'new'/'changed'/'deleted')
   - Settings items get special handling via `diffSettingsItem()` which calls `mergeSettingsJson(..., dryRun=true)`
   - Builds full list with `buildFullDiffList()` to include unchanged items
   - Outputs results via `printStatusLine()` with color/icons
   - Returns `EXIT_OK` (no diff) or `EXIT_DIFF` (has diff)

**To-Repo Operation (local → repo):**

1. User: `npm run to-repo` → `main()` with `opts.command = 'to-repo'`
2. `main()` → `runToRepo(opts)`
3. `runToRepo()`:
   - Builds sync items and diff list (same as diff)
   - If `--dry-run`: shows what would change and exits
   - If changes exist: prompts `askConfirm()` for user approval
   - If confirmed: calls `applySyncItems(items, 'to-repo', {dryRun: false})`
4. `applySyncItems()`:
   - Sets `isWriting = true` (for signal handler)
   - For each item:
     - **settings type**: calls `mergeSettingsJson('to-repo', false)` → reads local, strips device fields, writes to repo
     - **file type**: calls `copyFile(src, dest, force)` → atomic write via `writeJsonSafe()` or `fs.copyFileSync()`
     - **dir type**: calls `mirrorDir(src, dest)` → recursively copies/deletes to mirror src in dest
   - Collects stats (added/updated/deleted)
   - Appends to `.sync-history.log` via `appendSyncLog()`
5. `runToRepo()` then calls `showGitStatus()` to display git changes (git status, git diff)
6. Returns `EXIT_OK`

**To-Local Operation (repo → local):**

1. User: `npm run to-local` → `main()` with `opts.command = 'to-local'`
2. `main()` → `runToLocal(opts)`
3. `runToLocal()`:
   - Builds sync items with direction='to-local'
   - Calls `printDetailedDiff()` to show all changes
   - If no changes: returns early
   - If changes: prompts `askConfirm()`
   - If confirmed: calls `applySyncItems(items, 'to-local', {dryRun})`
4. `applySyncItems()`:
   - For **settings type**: calls `mergeSettingsJson('to-local', false)`
     - Reads repo settings, applies to local while preserving device fields (model, effortLevel)
   - For **file/dir types**: copies repo → local
5. Returns `EXIT_OK`

**Error Flow:**

- Any `SyncError` thrown anywhere in call stack propagates to `main()` `.catch()`
- `formatError()` reads error.code and displays context-aware hint to user
- Exits with `EXIT_ERROR` (code 2)
- Example: File not found → `ERR.FILE_NOT_FOUND` → prints path and hints about git initialization

**State Management:**

- **Sync items**: Declared once at start via `buildSyncItems()` based on direction
- **Diff results**: Computed fresh each time, no caching between commands
- **Device fields**: Tracked in `DEVICE_FIELDS` constant ['model', 'effortLevel']
- **Temp files**: Registered with `registerTempFile()`, cleaned on exit
- **Diff cache**: External `diff` tool availability cached in `_diffAvailable`

## Key Abstractions

**SyncItem:**
- Purpose: Declarative specification of one sync target
- Fields: `{label, src, dest, type: 'file'|'settings'|'dir', verboseSrc, verboseDest}`
- Examples: `sync.js` lines 939-983
- Pattern: Immutable data object, processed by diff and apply functions

**ParsedArgs:**
- Purpose: Structured command-line arguments
- Fields: `{command, dryRun, verbose, showVersion, showHelp, extraArgs}`
- Examples: Used throughout handlers via `opts` parameter
- Pattern: Returned by `parseArgs()`, passed to handlers

**SyncError:**
- Purpose: Semantic error with code and context
- Fields: `{message, code, context}`
- Error codes: `FILE_NOT_FOUND`, `JSON_PARSE`, `GIT_ERROR`, `PERMISSION`, `INVALID_ARGS`, `IO_ERROR`
- Examples: `sync.js` lines 305-322 (FS error handling), 337-352 (JSON parse), 377 (write failure)
- Pattern: Thrown anywhere, caught at top level by `.catch(formatError)`

**COMMANDS:**
- Purpose: Registry of all available commands with metadata and handlers
- Structure: `{[cmdName]: {alias, desc, handler}}`
- Examples: `sync.js` lines 63-70
- Pattern: Data-driven dispatch—handlers injected via `attachCommandHandlers()`

## Entry Points

**Primary (CLI):**
- Location: `sync.js` line 1730
- Triggers: `node sync.js <command> [flags]`
- Responsibilities: Parse argv, call `main()`, catch errors, exit with code

**Main Function:**
- Location: `sync.js` lines 1679-1711
- Triggers: Entry point calls `main()`
- Responsibilities: Initialize handlers, parse args, route to command, unified error handling

**Test Entry:**
- Location: `test/sync.test.js` line 23 (require)
- Triggers: `npm test` / `node --test`
- Responsibilities: Import pure functions, run node:test suite

## Error Handling

**Strategy:** Semantic errors via SyncError class + top-level catch

**Patterns:**

- **File not found**: `throw new SyncError(msg, ERR.FILE_NOT_FOUND, {path})`
- **JSON parse**: `throw new SyncError(msg, ERR.JSON_PARSE, {path, parseError})`
- **Permission denied**: `throw new SyncError(msg, ERR.PERMISSION, {path})`
- **Git unavailable**: Check `isGitAvailable()` before git calls, show warning but don't fatal
- **Async errors**: All async operations (signals, readline) wrapped in promise handlers

**Exit Codes:**
- `0` (EXIT_OK): Success or no diff
- `1` (EXIT_DIFF): Diff mode found differences
- `2` (EXIT_ERROR): Fatal error occurred

## Cross-Cutting Concerns

**Logging:** 
- Strategy: Console output to stdout/stderr with ANSI colors
- Patterns: `printStatusLine(icon, label, hint)` for structured output, `console.log/error` for text
- Example: `sync.js` lines 1547-1567

**Validation:**
- Strategy: Check at I/O boundaries (before reading/writing files)
- Patterns: `checkReadAccess()`, `checkWriteAccess()`, `readJson()` validates JSON parse
- Example: `sync.js` lines 300-324

**Authentication:**
- Strategy: Not applicable (no auth required—syncs local files and git repo)
- Patterns: N/A

**Path Handling:**
- Strategy: Separate repo root (`REPO_ROOT`), home (`HOME`), claude home (`CLAUDE_HOME`)
- Patterns: `toRelativePath()` masks absolute paths in output to avoid leaking usernames
- Example: `~/.claude/settings.json` instead of `/Users/alice/.claude/settings.json`

**Concurrency:**
- Strategy: Single-threaded (no async I/O), no file locking
- Assumption: Only one instance runs at a time
- Safety: Atomic writes via temp file + rename

**Cross-Platform:**
- Strategy: Path separators handled by `path` module
- Tested: Windows 11 + macOS
- Example: `sync.js` line 205 uses `path.sep`, ANSI color output conditional on `isTTY`

---

*Architecture analysis: 2026-04-07*
