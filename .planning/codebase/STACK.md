# Technology Stack

**Analysis Date:** 2026-04-07

## Languages

**Primary:**
- JavaScript (Node.js) 18+ (LTS) - Main CLI application (`sync.js`)
- Bash/shell - Status line display and git integration (`claude/statusline.sh`)
- JSON - Configuration and lock files (`claude/settings.json`, `skills-lock.json`)

**Testing:**
- JavaScript - Unit tests using Node.js built-in test runner

## Runtime

**Environment:**
- Node.js >= 18 (LTS) - Cross-platform runtime
- Bash shell - For script execution and CLI operations
- Git - Version control and repository management

**Platform Support:**
- Windows 11 (primary development target)
- macOS (secondary support)
- Cross-platform design with path normalization

## Frameworks

**Testing:**
- Node.js built-in `node:test` module (zero external dependency)
- Node.js built-in `assert/strict` module for assertions

**CLI Framework:**
- Custom CLI implementation in `sync.js` (~1700 lines)
- No external CLI library; uses core modules only

**Build/Dev:**
- npm - Package manager for script execution
- No bundler required (zero dependencies approach)

## Key Dependencies

**Critical:**
- None - Zero external npm dependencies by design
- All functionality uses only Node.js built-in modules

**Built-in Modules Used:**
- `fs` - File system operations (read/write files, directories)
- `path` - Cross-platform path handling
- `os` - OS detection and home directory resolution
- `readline` - Interactive prompts for user confirmation
- `child_process` (spawnSync) - Git command execution

## Configuration

**Environment:**
- Configured via `claude/settings.json` stored in user's `.claude` home directory
- Settings include Claude Code permissions, plugins, and UI preferences
- Device-specific fields (`model`, `effortLevel`) excluded from sync to maintain device independence

**Build:**
- No build step - Direct Node.js execution
- `sync.js` is executable with shebang `#!/usr/bin/env node`

**Key Configuration Files:**
- `.gitignore` - Excludes `.agents/`, `.agent/`, `node_modules/`, and log files
- `package.json` - Minimal npm scripts for CLI operations
- `.sync-history.log` - Audit trail of sync operations (git-ignored)

## Platform Requirements

**Development:**
- Windows 11 or macOS with Bash support
- Node.js >= 18 LTS
- npm (bundled with Node.js)
- Git (for repository operations)
- Text editor (VS Code recommended for Claude Code)

**Production/Deployment:**
- Runs on end-user machines (Windows 11, macOS)
- Uses private Git repository for configuration storage
- No server components required
- No external API dependencies or cloud services

## Runtime Characteristics

**Exit Codes:**
- `0` (EXIT_OK) - Successful operation or no differences detected
- `1` (EXIT_DIFF) - Differences found (useful for CI workflows)
- `2` (EXIT_ERROR) - Error occurred during operation

**Performance Constraints:**
- LCS (Longest Common Subsequence) algorithm limited to 2000 lines max for diff computation to prevent memory exhaustion
- Falls back to approximate diff for large files (O(mn) memory prevention)

**Architecture Principles:**
- Single-file CLI design for portability and zero-dependency guarantee
- Section banners organize logical areas within `sync.js`
- Function size limit: max 60 lines per function (enforced constraint)
- Data-driven dispatch pattern using `COMMANDS` object
- Atomic write operations to prevent data corruption on power loss

---

*Stack analysis: 2026-04-07*
