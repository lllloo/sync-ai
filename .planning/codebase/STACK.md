# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- JavaScript (Node.js) - All application logic and CLI tools

**Secondary:**
- Bash - Utilities like `statusline.sh`

## Runtime

**Environment:**
- Node.js >= 18 (LTS) - Required for all operations

**Package Manager:**
- npm - Command runner and script execution
- Lockfile: Not present (zero external dependencies)

## Frameworks

**Core:**
- Node.js Built-in Modules Only
  - `fs` - File system operations
  - `path` - Path manipulation
  - `os` - Operating system utilities
  - `readline` - Interactive user input
  - `child_process` - Process spawning for external tools
  - `node:test` - Unit testing framework
  - `node:assert/strict` - Test assertions

**Testing:**
- node:test (Node.js Built-in) - Pure function unit testing
  - Config: No external config needed
  - No external dependencies required

**Build/Dev:**
- No build tools needed - Single file architecture (`sync.js`)

## Key Dependencies

**Critical:**
- None - Zero external npm dependencies by design
  - All functionality uses only Node.js standard library

**Infrastructure:**
- Git CLI - External tool for version control operations
  - Invoked via `child_process.spawnSync`
  - Path: `git` command from system PATH

- Bash/POSIX Tools - External utilities
  - `diff` command - For file comparison
  - `npx` - npm package executor for skills installation
  - Invoked via `child_process.spawnSync`

## Configuration

**Environment:**
- User home directory: `process.env.HOME` (macOS/Linux) or `os.homedir()` (Windows)
- No `.env` files required - Configuration stored in version-controlled JSON files

**Build:**
- No build configuration needed
- Single entry point: `sync.js` (shebang: `#!/usr/bin/env node`)

**Key Configuration Files:**
- `package.json` - npm scripts and project metadata
- `skills-lock.json` - Global skills manifest (cross-device source of truth)
- `claude/settings.json` - Claude Code settings template (contains device-specific fields: `model`, `effortLevel`)

## Platform Requirements

**Development:**
- Node.js >= 18
- Git (any recent version)
- Bash or POSIX-compatible shell
- Working directory: Git repository root

**Supported Platforms:**
- Windows 11+ (primary development platform)
- macOS (secondary)
- Linux (POSIX-compatible)

**Production/Deployment:**
- Same requirements as development
- No separate production build step
- Git access required for sync operations
- `npx` available for skills management

## Data Storage

**File-based:**
- Local user configuration: `~/.claude/` directory structure
- Repo-tracked configuration: `./claude/` directory
- JSON files for settings and skills manifest

**Atomic Write Safety:**
- Uses temporary file + atomic rename pattern in `writeJsonSafe()`
- EXDEV fallback for cross-filesystem moves (Windows temporary directory behavior)

## External Tool Integration

**Git:**
- Spawned via `child_process.spawnSync('git', ...)`
- Operations: diff, status, used by CI systems (exit code `1` for diff mode)

**File Comparison:**
- `diff` command spawned via `child_process.spawnSync`
- Used for line-by-line diff output (fallback for large files exceeds LCS_MAX_LINES=2000 lines)

**Skills Manager:**
- `npx skills` - Installed globally with `-g` flag
- Operations: `npx skills add`, `npx skills list`, `npx skills remove`
- Not executed by sync tool - only suggested via CLI output

---

*Stack analysis: 2026-04-09*
