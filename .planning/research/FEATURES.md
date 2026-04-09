# Feature Research

**Domain:** CLI Tool Health Check — Verification & Audit Checks
**Researched:** 2026-04-09
**Confidence:** HIGH (based on existing codebase map + known concerns doc)

---

## Feature Landscape

This health check has four verification dimensions. Each dimension's "features" are the specific checks that must be run. The downstream roadmap uses this to define what goes in each phase and in what order.

---

### Table Stakes (Health Check Is Incomplete Without These)

A health check missing any of these cannot be called comprehensive.

#### Dimension 1: Command Output Correctness

| Check | Why Expected | Complexity | Notes |
|-------|--------------|------------|-------|
| `diff` exit code semantics (0=clean, 1=changed, 2=error) | CI scripts depend on this contract | LOW | EXIT_DIFF=1 is the documented behavior; verify it holds |
| `diff` shows all managed items (not just changed ones) | `buildFullDiffList()` exists specifically for this | LOW | Check that unchanged files appear with null status |
| `to-repo` copies file content accurately (byte-for-byte) | Core function of the tool | LOW | Run to-repo, verify repo file matches local |
| `to-repo` strips DEVICE_FIELDS from settings.json | `model`/`effortLevel` must never appear in repo | MEDIUM | Verify both fields absent after to-repo; verify other fields preserved |
| `to-local` merges settings preserving local device fields | Inverse of above — local model/effortLevel must survive | MEDIUM | Run to-local, confirm device fields unchanged on local |
| `to-local` shows preview before applying | Documented interactive confirm flow | LOW | Check that diff is shown before `askConfirm()` prompt |
| `dry-run` flag makes no writes on any command | `--dry-run` must be safe on all commands | MEDIUM | Verify no filesystem writes occur; content comparison still runs |
| `skills:diff` output is buildable instructions (not auto-actions) | Tool only recommends, never executes | LOW | Verify no `npx skills install` is auto-triggered |
| `skills:diff` handles both directions (repo-only, local-only) | Both cases documented in ARCHITECTURE | LOW | Check that both missing-from-local and extra-on-local cases output correct commands |
| `status` command runs both diff and skills:diff sequentially | Documented as equivalent to diff + skills:diff | LOW | Verify both outputs appear in single invocation |

#### Dimension 2: Edge Cases and Error Paths

| Check | Why Expected | Complexity | Notes |
|-------|--------------|------------|-------|
| Missing local file handled with FILE_NOT_FOUND error | SyncError codes are the documented contract | LOW | Delete a managed file, run diff, check error code and message |
| Corrupt/malformed settings.json produces JSON_PARSE error | readJson() has this path | LOW | Write invalid JSON to settings.json, run diff |
| `to-repo` outside a git repo produces GIT_ERROR | Documented check in architecture | MEDIUM | Run in temp non-git dir |
| `askConfirm` behavior in non-TTY context (CI hang risk) | Known HIGH-priority tech debt in CONCERNS.md | MEDIUM | Pipe stdin from /dev/null, verify to-local does not hang indefinitely |
| `writeJsonSafe` creates new file correctly | Known MEDIUM tech debt for checkWriteAccess timing | MEDIUM | Remove target JSON, run to-repo, verify file created |
| `mirrorDir` removes files absent in source | Deletion logic is documented behavior | MEDIUM | Add extra file to repo agents/, run to-local, verify it's deleted locally |
| `mirrorDir` preserves files present in source | Complement of deletion check | LOW | Standard to-local on agents/ dir |
| Invalid command argument produces INVALID_ARGS error | SyncError contract | LOW | Run `node sync.js nonexistent-command`, check exit code 2 |
| Path masking in error messages (no absolute paths leaked) | Security concern in CONCERNS.md | LOW | Trigger a FILE_NOT_FOUND error, check output contains `~/` not `/Users/...` |

#### Dimension 3: Cross-Platform Compatibility

| Check | Why Expected | Complexity | Notes |
|-------|--------------|------------|-------|
| `checkWriteAccess` behavior on Windows for new files | Known tech debt — Windows behavior differs from POSIX | MEDIUM | Test writeJsonSafe on new file path on Windows |
| `diff` external command fallback on Windows | `diff` binary absent on Windows; JS fallback must activate | LOW | Verify `isDiffAvailable()` returns false on Windows, JS LCS runs |
| Path separator handling in all FS operations | Windows uses `\`, must not break path construction | MEDIUM | Run full diff/to-repo on Windows, check no path-separator errors |
| `toRelativePath` masks home dir on both platforms | Windows home is `C:\Users\...`, not `/home/...` | LOW | Trigger verbose output, verify `~/` substitution on Windows |
| `npx skills list` spawn works on Windows | External process spawn; Windows shell behavior differs | MEDIUM | Run skills:diff on Windows, verify spawn does not error |
| Line ending handling in file comparison | Windows CRLF vs Unix LF in copied files | MEDIUM | Verify CLAUDE.md comparison works when one side has CRLF |

#### Dimension 4: Test Coverage Gap Analysis

| Check | Why Expected | Complexity | Notes |
|-------|--------------|------------|-------|
| Identify all I/O functions not covered by current tests | CONCERNS.md explicitly lists this gap | LOW | Audit test/sync.test.js exports vs sync.js functions |
| Identify `mergeSettingsJson` path coverage (to-repo vs to-local) | Both directions exist; only one may be tested | MEDIUM | Check test file for both directions |
| Identify `computeLineDiff` fallback path coverage (>2000 lines) | LCS_MAX_LINES fallback is a separate code path | LOW | Check if test exercises >2000-line input |
| Map which SyncError codes have no test assertion | Each error code is a contract; untested = unverified | LOW | Cross-reference error codes in sync.js with assertions in test file |
| Flag functions requiring TTY simulation to test | `askConfirm` cannot be unit tested without TTY mock | LOW | Document as "requires integration test with stdin piping" |

---

### Differentiators (Extra Thoroughness Beyond Baseline)

These elevate the health check from "adequate" to "thorough." Include if phase scope permits.

| Check | Value Proposition | Complexity | Notes |
|-------|-------------------|------------|-------|
| Verify `.sync-history.log` contains no absolute paths | Security audit of log output | LOW | Run to-repo, inspect .sync-history.log for `/Users/` or `C:\Users\` |
| Verify `skills-lock.json` is not modified by any sync command | Lock file is a pure data manifest, must never be auto-written | LOW | Checksum file before and after running diff/to-repo/to-local |
| Verify LCS fallback output quality at exactly 2001 lines | Boundary condition for hardcoded LCS_MAX_LINES=2000 | MEDIUM | Craft a test file at 2001 lines, verify diff still readable |
| Verify `--verbose` flag produces extra output without breaking behavior | Verbose mode is a documented flag | LOW | Run each command with `--verbose`, verify exit codes unchanged |
| Verify `--version` and `--help` flags exit with code 0 | CLI contract | LOW | Simple invocation check |
| Audit all `console.error + process.exit` patterns (none should exist) | Architecture rule: only SyncError + formatError allowed | LOW | Grep sync.js for bare process.exit calls |
| Verify `appendSyncLog` does not error when log file does not exist | First-run scenario | LOW | Delete .sync-history.log, run to-repo |
| Verify EXDEV fallback in writeJsonSafe (cross-device rename) | EXDEV handling documented in architecture | HIGH | Requires two different filesystems; flag as "environment-dependent, skip if not available" |

---

### Anti-Features (Deliberately Excluded from This Health Check)

These seem relevant but should not be done during this milestone.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Fix bugs found during health check | Natural impulse when a bug is spotted | Violates PROJECT.md constraint: "only produce report, fix separately" — mixing fix+audit increases scope and makes report incomplete | Log finding, defer fix to next milestone |
| Performance benchmarking (diff speed, directory scan time) | CONCERNS.md mentions performance considerations | Tool operates on <100 files; performance is not a concern at this scale per PROJECT.md | Mention as non-issue in report; no metrics needed |
| Test coverage percentage targets | Sounds rigorous | Coverage % is meaningless for I/O-heavy code; `copyFile()` at 100% unit coverage still doesn't prove it works | Use function-boundary gap analysis instead (which checks are listed above) |
| Automated fix suggestions with code patches | Useful-seeming output | Generates noise; health check report should describe what, not prescribe how — fixes belong in separate milestone | Record findings only; let engineer decide fix approach |
| Verify git commit/push behavior | `to-repo` ends at git diff display; git operations are user responsibility | Out of scope per PROJECT.md; auto-git behavior not part of tool design | Document that tool intentionally stops before commit |
| Install/remove skills actions | skills:diff lists suggestions | skills:diff deliberately never executes — verifying that it doesn't would re-verify the same thing as the table stakes check | Covered by "skills:diff shows instructions only" check above |
| Cross-machine sync simulation | Would require two machines or complex mocking | Adds environment complexity without revealing new information vs. single-machine checks | Trust unit tests + smoke tests for cross-machine correctness |

---

## Feature Dependencies

```
[Dimension 4: Coverage Gap Analysis]
    └──requires──> [Dimension 1: Command Correctness] (know what's correct before auditing gaps)
    └──requires──> [Dimension 2: Error Path checks] (know which error paths exist)

[Dimension 3: Cross-Platform Compatibility]
    └──requires──> [Dimension 1: Command Correctness] (baseline behavior must be established first)

[Dimension 2: Edge Cases]
    └──partially-requires──> [Dimension 1: Command Correctness] (normal path must work before testing error paths)

[EXDEV fallback check (D2/Differentiator)]
    └──conflicts──> [Single-machine test environment] (requires cross-device setup)

[askConfirm non-TTY check]
    └──enhances──> [to-local correctness check] (validates CI safety of the same command)
```

### Dependency Notes

- **Dimension 1 before Dimension 2:** Cannot meaningfully test error paths if normal path is broken — failures become ambiguous. Run correctness checks first.
- **Dimension 1 before Dimension 3:** Cross-platform checks assume normal behavior is known; if behavior differs on Windows, the baseline must exist to compare against.
- **Dimension 1 before Dimension 4:** Coverage gap analysis requires knowing what functions exist and what they should do. Establishing correctness first gives the auditor the necessary mental model.
- **EXDEV check conflicts with standard environment:** Flag this check as "skip unless cross-device filesystem available." Do not block report on it.
- **askConfirm enhances to-local:** The TTY check (Dimension 2) and the to-local preview check (Dimension 1) share the same command — run them together rather than invoking to-local twice.

---

## MVP Definition

### Health Check Must Include (Non-Negotiable)

- [ ] All 10 Dimension 1 (command correctness) checks — without these the report is not credible
- [ ] All 9 Dimension 2 (edge case/error path) checks — error handling is the highest-risk area per CONCERNS.md
- [ ] All 6 Dimension 3 (cross-platform) checks — Windows is the primary platform; skipping these misses real risk
- [ ] All 5 Dimension 4 (coverage gap) checks — gap analysis is the stated deliverable per PROJECT.md

### Add If Time Permits

- [ ] Low-complexity differentiators (security log audit, skills-lock integrity, verbose/version flags) — value is HIGH, cost is LOW
- [ ] LCS boundary test (2001-line file) — useful but not critical for a settings sync tool

### Explicitly Defer

- [ ] EXDEV fallback verification — requires cross-device filesystem; environment-dependent, not worth blocking report
- [ ] Any bug fixes discovered — out of scope per PROJECT.md

---

## Feature Prioritization Matrix

| Check | User Value | Implementation Cost | Priority |
|-------|------------|---------------------|----------|
| DEVICE_FIELDS stripping (to-repo + to-local) | HIGH | LOW | P1 |
| askConfirm non-TTY hang (CI safety) | HIGH | LOW | P1 |
| dry-run makes no writes | HIGH | LOW | P1 |
| diff exit code semantics | HIGH | LOW | P1 |
| mirrorDir deletion behavior | HIGH | MEDIUM | P1 |
| checkWriteAccess on Windows new file | MEDIUM | MEDIUM | P1 |
| path separator on Windows | HIGH | MEDIUM | P1 |
| all SyncError codes tested | MEDIUM | LOW | P1 |
| I/O function coverage gap map | MEDIUM | LOW | P1 |
| skills:diff shows instructions only | HIGH | LOW | P1 |
| path masking in error messages | MEDIUM | LOW | P2 |
| .sync-history.log no absolute paths | MEDIUM | LOW | P2 |
| LCS boundary (2001-line file) | LOW | MEDIUM | P2 |
| EXDEV fallback | LOW | HIGH | P3 |

**Priority key:**
- P1: Must appear in health check report
- P2: Include if scope allows
- P3: Document as known gap, skip for this milestone

---

## Sources

- `.planning/PROJECT.md` — Scope constraints (no fixes, no new packages, four dimensions)
- `.planning/codebase/ARCHITECTURE.md` — Authoritative source for what each layer does, SyncError codes, data flow
- `.planning/codebase/CONCERNS.md` — Known tech debt (checkWriteAccess, askConfirm TTY, LCS threshold), test coverage gaps
- `CLAUDE.md` (project) — Sync item mapping, DEVICE_FIELDS definition, exit code semantics

---

*Feature research for: sync-ai CLI health check verification*
*Researched: 2026-04-09*
