# Codebase Structure

**Analysis Date:** 2026-04-07

## Directory Layout

```
sync-ai/
├── sync.js                  # Main CLI script (~1700 lines, zero dependencies)
├── package.json            # npm scripts and metadata
├── README.md               # User documentation and usage guide
├── CLAUDE.md               # Project-specific Claude Code guidelines
├── skills-lock.json        # Global skills manifest (device reference, not auto-synced)
├── .gitignore              # Git ignore rules
├── .sync-history.log       # Operation audit log (auto-generated, in .gitignore)
├── test/
│   └── sync.test.js        # Pure function unit tests (node:test, zero dependencies)
├── claude/                 # Repo-side sync targets (mirrors ~/.claude/)
│   ├── CLAUDE.md           # Global Claude Code instructions
│   ├── settings.json       # Shared Claude Code settings (device fields stripped)
│   ├── statusline.sh       # Bash statusline script
│   ├── agents/             # Global agents (organized by package)
│   │   └── awesome-claude-code-subagents/
│   └── commands/           # Global commands directory mirror
├── .agents/                # Local installed skill instances (in .gitignore)
│   └── skills/
├── .claude/                # Local project Claude Code config
│   ├── settings.json       # Local settings (overrides)
│   └── ...
├── .planning/
│   └── codebase/           # GSD codebase analysis documents
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
├── gan-harness/            # GAN iteration records (spec, feedback, state)
└── .git/                   # Git repository
```

## Directory Purposes

**Project Root:**
- Purpose: CLI tool entry point and configuration
- Contains: Main script, tests, documentation, repo-side sync targets
- Key files: `sync.js` (executable), `package.json` (npm scripts)

**`test/`:**
- Purpose: Unit test suite for pure functions
- Contains: `sync.test.js` with node:test specs
- Key files: `sync.test.js` — tests `computeLineDiff`, `matchExclude`, `statusToStatsKey`, `parseSkillSource`, `parseArgs`, `toRelativePath`, `COMMANDS` completeness
- No dependencies: Uses only Node.js `node:test` and `node:assert/strict`

**`claude/`:**
- Purpose: Source of truth for settings synced across devices
- Contains: Global CLAUDE.md, shared settings.json, statusline.sh, agents, commands
- Key files:
  - `claude/CLAUDE.md` — mirrored from `~/.claude/CLAUDE.md`
  - `claude/settings.json` — shared Claude Code config (device-specific fields stripped during sync)
  - `claude/agents/` — organized by package subdirectories (e.g., `awesome-claude-code-subagents/`)
  - `claude/commands/` — directory mirror of `~/.claude/commands/`
- Sync strategy: Compared against `~/.claude/` in both directions

**`.agents/`:**
- Purpose: Local installed skill instances
- Contains: Downloaded skill implementations
- In .gitignore: Not version controlled (reference only in `skills-lock.json`)
- Not auto-synced: Skills managed via `npm run skills:*` commands

**`.claude/`:**
- Purpose: Local Claude Code project configuration
- Contains: Project-specific settings.json, hooks, GSD config
- In .gitignore: Device-specific, never synced
- Note: Contains hooks like `gsd-check-update.js`, `gsd-read-guard.js` (GSD integration)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis output
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md (as generated)
- Not synced: Project-local documentation only

**`gan-harness/`:**
- Purpose: GAN (Get Shit Done) automation iteration records
- Contains: spec, eval-rubric, feedback, generator-state
- Not sync-related: Used for Claude Code optimization iterations only

## Key File Locations

**Entry Points:**
- `sync.js` (line 1730): Main CLI entry point, calls `main()` and exits
- `test/sync.test.js` (line 1): Test suite entry, imports pure functions

**Configuration:**
- `package.json`: npm scripts (`diff`, `to-repo`, `to-local`, `skills:diff`, `skills:add`, `test`)
- `sync.js` (lines 15-81): Constants (paths, exit codes, device fields, status icons, command registry)
- `CLAUDE.md`: Project guidelines and modification rules (sync items, architecture constraints)

**Core Logic:**
- `sync.js` (lines 920-1074): Sync core (`buildSyncItems`, `diffSyncItems`, `applySyncItems`)
- `sync.js` (lines 1157-1610): Command handlers (`runDiff`, `runToRepo`, `runToLocal`, `runSkillsDiff`, `runSkillsAdd`)
- `sync.js` (lines 570-800): Diff engine (`diffFile`, `diffDir`, `computeLineDiff`, `matchExclude`)
- `sync.js` (lines 289-528): FS utilities (`readJson`, `writeJsonSafe`, `copyFile`, `mirrorDir`, `ensureDir`)

**Testing:**
- `test/sync.test.js` (lines 28-150+): Pure function test cases
- Covers: `computeLineDiff`, `matchExclude`, `statusToStatsKey`, `parseSkillSource`, `parseArgs`, `toRelativePath`

**Utilities:**
- `sync.js` (lines 106-119): ANSI color output (`col.red`, `col.green`, etc.)
- `sync.js` (lines 121-209): Error handling (`SyncError`, `formatError`, `toRelativePath`)
- `sync.js` (lines 212-267): Temp file management and signal handlers
- `sync.js` (lines 1547-1595): Output formatting (`printStatusLine`, `printFileDiff`, `runHelp`)

## Naming Conventions

**Files:**

- **Main script**: `sync.js` (executable, ~1700 lines, camelCase for internal consistency)
- **Test files**: `sync.test.js` (follows `.test.js` naming, not `.spec.js`)
- **Config**: `settings.json` (JSON config file)
- **Manifest**: `skills-lock.json`, `.sync-history.log`
- **Documentation**: `README.md`, `CLAUDE.md` (uppercase markdown)
- **Git ignore**: `.gitignore`

**Directories:**

- **Sync targets**: `claude/`, `.agents/`, `.claude/` (mirrors of CLI home directories)
- **Test**: `test/` (contains test files)
- **Planning**: `.planning/codebase/` (GSD codebase docs)
- **Tool dirs**: `gan-harness/` (iteration records), `.git/` (version control)

**Functions:**

- **Commands**: camelCase with command name prefix (e.g., `runDiff`, `runToRepo`, `runSkillsDiff`)
- **Utilities**: camelCase verbs (e.g., `copyFile`, `mirrorDir`, `ensureDir`, `diffFile`, `readJson`, `writeJsonSafe`)
- **Checks**: `is*` or `check*` (e.g., `isDiffAvailable`, `isGitAvailable`, `isInsideGitRepo`, `checkReadAccess`, `checkWriteAccess`)
- **Parsers**: `parse*` (e.g., `parseArgs`, `parseSkillSource`)
- **Formatters**: `*ToString` or `format*` or `print*` (e.g., `toRelativePath`, `formatError`, `printStatusLine`, `printFileDiff`)
- **Pure diff**: `compute*` (e.g., `computeLineDiff`, `computeSimpleLineDiff`)

**Variables:**

- **Private/internal**: Prefix with `_` (e.g., `_diffAvailable`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `REPO_ROOT`, `CLAUDE_HOME`, `DEVICE_FIELDS`, `LCS_MAX_LINES`, `EXIT_OK`, `ERR`)
- **Objects**: camelCase (e.g., `col`, `STATUS_ICONS`, `COMMANDS`, `COMMAND_ALIASES`)

**Types (JSDoc):**

- **Class names**: PascalCase (e.g., `SyncError`)
- **Typedef names**: PascalCase (e.g., `SyncItem`, `ParsedArgs`)
- **Enum-like constants**: PascalCase (e.g., `ERR`, `STATUS_ICONS`)

## Where to Add New Code

**New Command:**
- Add entry to `COMMANDS` object (`sync.js` lines 63-70)
- Implement `runNewCommand(opts)` handler in Commands section (`sync.js` lines 1157+)
- Inject handler in `attachCommandHandlers()` (`sync.js` lines 1717-1724)
- Add corresponding npm script in `package.json`
- Update `README.md` with usage and examples
- If command is pure function, add tests to `test/sync.test.js`

**New Sync Item:**
- Add to `buildSyncItems()` array (`sync.js` lines 939-983)
- Specify `label` (display name), `src`, `dest`, `type` ('file'|'settings'|'dir')
- Update `CLAUDE.md` documentation with new sync item
- Update `README.md` with new sync target
- Test via `npm run diff` to verify inclusion

**New Utility Function:**
- Add to appropriate section in `sync.js` (e.g., FS Utilities, Diff Engine, Output Formatting)
- Keep function ≤60 lines (split if necessary)
- Use JSDoc `@param`, `@returns`, `@throws` annotations
- If pure function, add unit test to `test/sync.test.js`
- Export from `module.exports` if testable (line 1739+)

**New Error Type:**
- Add code constant to `ERR` object (`sync.js` lines 145-152)
- Add hint message to `hints` object in `formatError()` (`sync.js` lines 165-172)
- Throw via `new SyncError(msg, ERR.NEW_CODE, {context})`

**New Test:**
- Add to `test/sync.test.js` following existing patterns
- Use `test('description', () => {...})` from `node:test`
- Test only pure functions (no I/O)
- Use `assert.equal()`, `assert.deepEqual()`, `assert.throws()` from `node:assert/strict`

## Special Directories

**`.gitignore` targets:**
- Purpose: Track files intentionally excluded from version control
- Committed: Yes (the `.gitignore` file itself is in repo)
- Generated: No
- Contents: `.agents/` (installed skills), `.sync-history.log` (operation audit), `.DS_Store` (macOS)

**`gan-harness/`:**
- Purpose: GAN optimization iteration records (separate from sync tool functionality)
- Committed: Yes (but not part of sync logic)
- Generated: By GAN harness during optimization
- Note: Unrelated to sync functionality, only for Claude Code AI optimization

**`.claude/` (project-local):**
- Purpose: Project-specific Claude Code configuration
- Committed: No (in .gitignore, device-specific)
- Generated: Auto-created by Claude Code when needed
- Contents: GSD hooks, project settings overrides
- Not synced: This directory is always local-only

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis output
- Committed: Yes (checked into repo for team reference)
- Generated: By `gsd map-codebase` command
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

---

*Structure analysis: 2026-04-07*
