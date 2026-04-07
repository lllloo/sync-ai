# External Integrations

**Analysis Date:** 2026-04-07

## APIs & External Services

**Git Repository:**
- Git (local repository management)
  - Used for: Version control of Claude Code settings across devices
  - Execution method: `child_process.spawnSync` to run git commands
  - Operations: clone, pull, push, diff, status
  - Location in code: `sync.js` git command handlers

**GitHub (Marketplace & Skills):**
- Source for Claude Code agents/skills
- Integration method: Defined in `settings.json` marketplace configuration
- Marketplaces configured:
  - `wshobson/agents` (claude-code-workflows)
  - `affaan-m/everything-claude-code` (everything-claude-code)
  - `kepano/obsidian-skills` (obsidian-skills)

## Data Storage

**Databases:**
- Not applicable - Zero database dependencies

**File Storage:**
- Local filesystem only
- Storage locations:
  - `~/.claude/` - Claude Code global configuration directory
  - `~/.claude/CLAUDE.md` - Global instructions and conventions
  - `~/.claude/settings.json` - Claude Code settings (device-specific fields: `model`, `effortLevel`)
  - `~/.claude/statusline.sh` - Status line display script
  - `~/.claude/agents/` - Claude Code agents organized by package subdirectories
  - `~/.claude/commands/` - Claude Code custom commands
  - `~/.agents/` - Installed skills (actual implementation files, git-ignored)

**Sync Repository Storage:**
- Private Git repository contains:
  - `claude/CLAUDE.md` - Master copy of global instructions
  - `claude/settings.json` - Master settings (device fields stripped during sync)
  - `claude/statusline.sh` - Master status display script
  - `claude/agents/` - Agent definitions organized by package
  - `claude/commands/` - Command definitions
  - `skills-lock.json` - Skills manifest (reference, not auto-synced)

**Configuration Caching:**
- `.sync-history.log` - Audit trail of synchronization operations (git-ignored)

**Caching:**
- None configured

## Authentication & Identity

**Auth Provider:**
- GitHub (via SSH or HTTPS)
  - Implementation: Git authentication for private repository access
  - No explicit OAuth or token configuration in settings
  - Uses system git configuration for authentication

**Claude Code Settings:**
- User identity maintained in `settings.json`
- `language`: Set to Traditional Chinese (繁體中文)
- Device-specific models and effort levels excluded from sync

## Monitoring & Observability

**Error Tracking:**
- None - Local error handling only

**Logs:**
- `.sync-history.log` - Custom audit log
  - Records: Timestamp, operation type, device name, modified files with status
  - Format: Human-readable text with status indicators
  - Example: `[2026-04-07T03:53:38.022Z] to-repo @ DESKTOP-PRK0EVL`
  - Persistence: File-based, git-ignored (not committed)

**Status Display:**
- `claude/statusline.sh` - Displays in Claude Code UI
  - Shows: Current model, folder, git branch, context usage percentage
  - Shows: Rate limits (5-hour and 7-day windows) with reset countdowns
  - Zero subprocess usage (pure bash regex and parameter expansion)

## CI/CD & Deployment

**Hosting:**
- No server-side hosting
- Decentralized: Runs on user's local machines

**Deployment Model:**
- Self-hosted Git repository
- Clone and run locally: `git clone <repo> && cd sync-ai && npm run to-local`

**CI Pipeline:**
- Exit code semantics enable CI integration:
  - `0` (success/no changes) - Can be used to determine sync state
  - `1` (differences detected) - Can trigger actions
  - `2` (error) - Can fail CI build

## Environment Configuration

**Required Environment Variables:**
- None explicitly required - Uses system paths via `os.homedir()`

**Settings Configuration:**
- Global Claude Code settings via `settings.json`
- Environment variables can be set in `settings.json.env` object:
  - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set to `"1"`

**Secrets Location:**
- Settings file path: `~/.claude/settings.json`
- No embedded API keys or secrets in codebase
- Git credentials: Uses system git configuration (SSH keys or credential helper)
- Sensitive path information: Obfuscated in output via `toRelativePath()` function

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- None - No outbound notifications or callbacks

## Skills & Plugins Integration

**Installed Skills (Non-Auto-Synced):**
- `vue-best-practices` (vuejs-ai/skills)
- `frontend-design` (anthropics/skills)
- `skill-creator` (anthropics/skills)
- `gan-style-harness` (affaan-m/everything-claude-code)

**Plugin Configuration:**
- `obsidian@obsidian-skills` - Obsidian integration enabled in `settings.json`

**Skills Management:**
- Tracked in `skills-lock.json` as source of truth (reference only)
- Not auto-synced via `to-repo`/`to-local`
- Manual installation/removal via `npm run skills:diff` and `npx skills` commands
- Location in code: `sync.js` handles `skills:diff` and `skills:add` commands

## Permission Model

**Claude Code Permissions (settings.json):**

Allowed operations:
- Bash: `cat`, `cd`, `cp`, `date`, `du`, `echo`, `find`, `grep`, `head`, `ls`, `mkdir`, `sort`, `tail`, `tr`, `wc`, `git`, `gh api`, `gh repo`, node scripts, npm, npx skills, python3, docker-compose, code, obsidian, WebFetch, WebSearch, Pencil MCP

Denied operations:
- `Bash(git push:*)` - Intentional deny to prevent accidental force pushes

## Cross-Device Sync Model

**Sync Strategy:**
- Single-directional upstream (local → repo): `to-repo` command
- Single-directional downstream (repo → local): `to-local` command with preview
- Dry-run mode: `--dry-run` flag for preview without applying changes
- Atomic operations: All changes applied together (all or nothing)

**Device Identity:**
- Device name logged in `.sync-history.log` (e.g., `DESKTOP-PRK0EVL`)
- Settings `model` and `effortLevel` maintained locally, not synced

---

*Integration audit: 2026-04-07*
