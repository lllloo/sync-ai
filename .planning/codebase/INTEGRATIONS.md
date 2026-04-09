# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Git Repository:**
- Git CLI - Version control for configuration sync
  - Tool: `git` command via `child_process.spawnSync`
  - Operations: `status`, `diff`, `diff --stat`, `rev-parse --is-inside-work-tree`, `--version`
  - Config: `.git/` directory (standard Git repo)
  - Authentication: SSH keys or system Git credentials
  - Purpose: Stores and manages cross-device Claude Code configuration

**Skills Management (Claude Code Skills):**
- NPM Skills Registry (via `npx skills`)
  - Tool: `npx skills` command line tool
  - Source: https://skills.sh/ or GitHub package sources
  - Installation: `npx skills add <source> -g -y --skill <name>`
  - Removal: `npx skills remove <name> -g -y`
  - Config file: `skills-lock.json` (cross-device manifest)
  - Purpose: Track installed skills across multiple devices

## Skills Sources

**Tracked in `skills-lock.json`:**

| Skill Name | GitHub Source | Type |
|------------|---------------|------|
| vue-best-practices | vuejs-ai/skills | github |
| frontend-design | anthropics/skills | github |
| skill-creator | anthropics/skills | github |
| gan-style-harness | affaan-m/everything-claude-code | github |
| playwright-cli | microsoft/playwright-cli | github |
| defuddle | kepano/obsidian-skills | github |
| json-canvas | kepano/obsidian-skills | github |
| obsidian-bases | kepano/obsidian-skills | github |
| obsidian-cli | kepano/obsidian-skills | github |
| obsidian-markdown | kepano/obsidian-skills | github |

## Data Storage

**Git Repository:**
- Location: Private Git repository (as configured by user)
- Contents:
  - `claude/CLAUDE.md` - Global Claude Code project instructions
  - `claude/settings.json` - Shared Claude Code settings (stripped of device-specific fields)
  - `claude/statusline.sh` - Terminal status line utility
  - `claude/agents/` - Agent scripts organized by package source
  - `claude/commands/` - Command definitions
  - `skills-lock.json` - Skills manifest

**Local User Configuration:**
- Base: `~/.claude/` directory
- Mirror of repo structure for active settings
- Devices synchronize bidirectionally: `~/.claude/` ↔ `./claude/`

**Local Skills Lock:**
- Location: `~/.agents/.skill-lock.json`
- Purpose: Track locally installed skills (device-specific)
- Format: JSON with `version` and `skills` object
- Updated by: `npx skills install` / `npx skills add` / `npx skills remove`

**Logs:**
- Location: `.sync-history.log` (git-ignored, local only)
- Purpose: Record all to-repo and to-local operations with timestamps
- Format: Plain text log

## Authentication & Identity

**Auth Provider:**
- None built-in - Uses system Git credentials
- SSH Keys: Located in `~/.ssh/` (system default)
- Credential Storage: Git credential helper or SSH agent

## File Synchronization Exclusions

**Always Excluded:**
- `.DS_Store` - macOS system files
- `.agents/` directory - Skill implementation files (git-ignored)
- `.sync-history.log` - Operation history (git-ignored)
- Device-specific fields in `settings.json`: `model`, `effortLevel`

## Monitoring & Observability

**Error Tracking:**
- None - Errors handled via console output with ANSI color codes

**Logs:**
- `.sync-history.log` - Local operation log (not synced)
- Console output with structured error messages via `SyncError` class
- Error codes: `FILE_NOT_FOUND`, `JSON_PARSE`, `GIT_ERROR`, `PERMISSION`, `INVALID_ARGS`, `IO_ERROR`

## CI/CD & Deployment

**Hosting:**
- User-provided private Git repository

**CI Pipeline:**
- Not built-in - User responsibility for setup
- Exit codes available for CI integration:
  - `0` (EXIT_OK) - Success or no differences
  - `1` (EXIT_DIFF) - Differences detected (useful for CI gates)
  - `2` (EXIT_ERROR) - Error occurred

**Deployment Model:**
- Manual sync: User runs `npm run to-repo` / `npm run to-local`
- Expected workflow: Clone repo → `npm run to-local` → daily `npm run to-repo` / `npm run status`

## Environment Configuration

**Required env vars:**
- None explicitly required
- Implicit: `HOME` (or uses `os.homedir()` on Windows)

**Secrets location:**
- Git credentials: `~/.ssh/` or Git credential helper
- `.env` files: Not used - configuration is JSON-based and version-controlled
- No API keys stored in codebase

## Webhooks & Callbacks

**Incoming:**
- None - Tool is command-driven

**Outgoing:**
- None - Tool does not send HTTP requests or webhooks
- External process spawning only (Git, diff, npx)

## Tool Dependencies (Spawned Processes)

**Mandatory (Must be in system PATH):**
- `git` - Version control
- `node` - JavaScript runtime

**Conditional (Used if available):**
- `diff` - File comparison (fallback for large file diffs)
- `npx` - npm package executor (for skills management, not executed by tool)

**System Paths:**
- All external tools resolved via `child_process.spawnSync` without explicit PATH manipulation
- Relies on user's system PATH configuration

---

*Integration audit: 2026-04-09*
