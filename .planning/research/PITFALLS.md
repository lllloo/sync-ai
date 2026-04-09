# Pitfalls Research

**Domain:** CLI tool verification & health check — single-file Node.js file sync tool
**Researched:** 2026-04-09
**Confidence:** HIGH (based on direct codebase analysis + known tech debt from CONCERNS.md)

---

## Critical Pitfalls

### Pitfall 1: False "No Diff" from Symmetric Serialization Masking Real Divergence

**What goes wrong:**
The `diff` and `status` commands strip `DEVICE_FIELDS` (`model`, `effortLevel`) before comparing `settings.json`. If the stripping logic used during comparison does not exactly mirror the stripping logic used during `to-repo` / `to-local` writes, diff can report "no change" when the on-disk files actually diverge. This is a serialization symmetry problem — a write path and a read path that appear to do the same thing but differ in key order, whitespace, trailing newline, or field ordering.

**Why it happens:**
JSON serialization is not canonical by default. `JSON.stringify(obj, null, 2)` preserves insertion order. If fields are stripped before serialization in one path but after in another, the resulting bytes differ even when logical content is identical. The bug was already fixed once (commit b5bf284) — the risk is that future changes to `mergeSettingsJson` or `diffSyncItems` re-introduce the asymmetry.

**How to avoid:**
Any change to `DEVICE_FIELDS` or to the JSON comparison/write functions must be tested with a round-trip: write via `to-repo`, read via `diff`, confirm exit code is `EXIT_OK`. The unit test for `mergeSettingsJson` must assert byte-identical output, not just logical equality.

**Warning signs:**
- `diff` reports no changes but `git diff` on the repo shows modified `settings.json`
- `to-repo` repeatedly writes the file (action `updated`) even when no logical change was made
- Test for `mergeSettingsJson` uses deep-equal instead of string-equal comparison

**Phase to address:** Functional correctness verification (diff / to-repo / to-local command audit)

---

### Pitfall 2: `askConfirm` Hanging Silently in Non-TTY Environments

**What goes wrong:**
`askConfirm()` calls `readline.createInterface({ input: process.stdin })` and awaits a response. If `process.stdin` is not a TTY (piped input, CI pipeline, background job, output redirected), `readline.question()` blocks indefinitely with no error or timeout. The process hangs, consuming resources, with no indication to the user why it stopped.

**Why it happens:**
The implementation at `sync.js:1717-1725` does not check `process.stdin.isTTY` before creating the interface. This is a common Node.js mistake — `readline` does not raise an error for non-interactive stdin, it simply waits.

**How to avoid:**
Add a TTY guard at the top of `askConfirm()`:
```js
if (!process.stdin.isTTY) {
  throw new SyncError('非互動環境不支援確認提示，請使用 --dry-run 預覽後手動執行', ERR.INVALID_ARGS);
}
```
This is the highest-priority fix in the tech debt list and must be addressed before any CI-based smoke test can be run.

**Warning signs:**
- Running `node sync.js to-local` inside a script or pipe produces no output and never returns
- `process.stdin.isTTY` is `undefined` in the test environment
- Any attempt to automate `to-local` in a test harness blocks

**Phase to address:** Edge case and error handling verification; also blocks integration test design

---

### Pitfall 3: `fs.accessSync(W_OK)` False Negatives on Windows for Existing Files

**What goes wrong:**
`checkWriteAccess()` uses `fs.accessSync(filePath, fs.constants.W_OK)` to pre-flight write permission. On Windows, `fs.accessSync` with `W_OK` does not reliably detect whether a file is read-only because Windows uses ACLs, not POSIX permission bits. A file that is genuinely writable may be reported as not writable (false negative), or vice versa (false positive on network drives). The current code correctly skips the check for non-existent files (`if (!fs.existsSync(filePath)) return`), but the check for existing files remains unreliable on Windows.

**Why it happens:**
Node.js `fs.accessSync` on Windows translates `W_OK` to `FILE_ATTRIBUTE_READONLY` checks, which do not account for ACL-based denials or file locks by other processes. This is documented behavior in Node.js but often overlooked.

**How to avoid:**
Do not rely on pre-flight access checks on Windows. Replace the `checkWriteAccess` pre-check with try/catch around the actual write operation, converting EPERM/EACCES to `SyncError(ERR.PERMISSION)`. This is more reliable across platforms and avoids TOCTOU (time-of-check / time-of-use) races.

**Warning signs:**
- `to-local` fails with permission error on Windows for files that are actually writable
- `checkWriteAccess` throws but the subsequent manual write succeeds
- CI on Windows reports false permission failures that do not occur on macOS

**Phase to address:** Cross-platform compatibility assessment (Windows vs macOS)

---

### Pitfall 4: `mirrorDir` Delete-Before-Confirm Creates Unrecoverable State

**What goes wrong:**
`mirrorDir()` deletes files from the destination that are absent from the source (`fs.rmSync` at line 502). In `to-local` direction, this means local files not present in the repo are deleted during `apply` — after the user confirmed the preview diff. However, the preview diff (`dry-run`) and the actual apply are separate function calls. If the repo changes between preview and apply (race condition, or concurrent operation), the user confirms a stale preview and the actual deletion may be broader than expected.

**Why it happens:**
The dry-run pass and the apply pass are logically independent. There is no snapshot or lock between the two. The confirmation UX ("do you want to apply these changes?") implies the user has seen exactly what will be applied, but that guarantee only holds if the source hasn't changed.

**How to avoid:**
The risk is low in practice (single-user CLI, manual git pull required). Document the assumption explicitly: the user must not run `git pull` between `diff` and `to-local`. For the health check audit, verify that the diff shown before confirmation exactly matches what `applySyncItems` will do.

**Warning signs:**
- The `--dry-run` summary and the actual apply summary show different file counts
- A file appears as `deleted` in apply but was shown as `ok` in dry-run preview

**Phase to address:** Edge case and error handling verification

---

### Pitfall 5: LCS Fallback Produces Misleading "No Difference" for Large Files

**What goes wrong:**
When total line count exceeds `LCS_MAX_LINES = 2000`, the tool falls back to `computeSimpleLineDiff()`. This function uses `Set` membership to identify changed lines, which ignores line position and duplicates. A line present in both old and new files (same content, different position) is reported as unchanged (`' '`). For agent markdown files that may exceed 2000 lines, this means a diff showing zero changes even when lines have been reordered or inserted/deleted in a way that the set membership check misses.

**Why it happens:**
The simple diff is a space optimization for large files, explicitly documented as "approximate." The problem is that the `isApproximate` flag is only set on the first element of the result array, and callers must check it explicitly. If any caller renders the result without checking `isApproximate`, users see normal-looking diff output that is factually wrong.

**How to avoid:**
During the health check, verify that all callers of `computeLineDiff` that render output either (a) check `isApproximate` and display a warning, or (b) use the external `diff` tool path instead. Also verify that the `LCS_MAX_LINES` threshold is appropriate — 2000 lines means `m+n > 2000`, so a 1001-line file diffed against a 1001-line file triggers fallback. Most agent files are under 500 lines, but agent packages with many files could surface this.

**Warning signs:**
- diff output shows no changes for a file you know was modified
- The first diff op in a result has `isApproximate: true` but no warning is printed to the user
- Agent markdown files imported from external packages exceed 1000 lines

**Phase to address:** Functional correctness verification (diff output accuracy)

---

### Pitfall 6: Verification Tests Confirm "Command Runs" Not "Command Is Correct"

**What goes wrong:**
Smoke tests for CLI tools often verify that a command exits without error (exit code 0) and produces some output. This confirms the happy path runs but does not verify correctness. For a sync tool, the critical invariant is not "diff runs" but "diff correctly identifies what is different." A test that calls `node sync.js diff` and checks exit code 1 (differences exist) does not confirm that the diff is complete — it could be missing changed files.

**Why it happens:**
Testing CLI output is harder than testing exit codes. Output format can change, paths are environment-dependent, and assertions on specific text are brittle. So tests default to exit-code checking, which is necessary but insufficient.

**How to avoid:**
For the health check, structure verification around invariants, not outputs:
1. Known-different state should produce `EXIT_DIFF` (exit 1)
2. Known-identical state should produce `EXIT_OK` (exit 0)
3. The set of files reported as changed must match the set of actually changed files
Verification should use temporary directory fixtures with controlled, known content — not live `~/.claude` state.

**Warning signs:**
- Verification script only checks `$?` (exit code), not stdout content
- Test setup uses real `~/.claude` files (environment-dependent, non-reproducible)
- "Pass" is defined as "no crash" rather than "correct output"

**Phase to address:** Unit test coverage gap analysis and integration test design

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| No TTY check in `askConfirm` | Simpler code | Hangs in any automated context; blocks CI smoke tests | Never — low-effort fix |
| `fs.accessSync(W_OK)` pre-check | Early error feedback | False positives/negatives on Windows; TOCTOU race | Acceptable only on POSIX, not on Windows |
| `LCS_MAX_LINES = 2000` hardcoded | Prevents OOM on large files | Silently degrades diff quality; no user warning for most cases | Acceptable as internal constant if `isApproximate` is always surfaced to user |
| Dry-run and apply as independent passes | Clean separation of concerns | User confirms stale preview if source changes between passes | Acceptable given single-user CLI assumption |
| Zero integration tests for I/O paths | Faster test suite | Entire apply/mirror/confirm flow is unverified; bugs caught only in production | Acceptable short-term; integration tests should be added |
| Single-file design (`sync.js` ~1800 lines) | Zero dependency complexity | Hard to navigate, entire file must be loaded for any test | Acceptable given zero-dependency constraint |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `git` (external binary) | Assuming `git` is on `PATH` in all environments | `spawnSync('git', ...)` will fail silently if git not found; check `result.error` not just `result.status` |
| `diff` (external binary) | Assuming `diff` is available on Windows | It is not present by default on Windows; the `isDiffAvailable()` cache correctly handles this, but any new diff call must go through this function |
| `npx skills list` | Parsing unstructured CLI output | Output format of `npx skills` can change between versions; parsing must be defensive and tested against actual output format |
| `readline` + stdin | Using `readline` without TTY guard | In non-interactive environments (CI, pipes), readline blocks indefinitely |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `getFiles()` re-scans directory on every call | Slow for large agent packages with many files | Cache scan result per directory per command invocation | At ~500+ files in agents directory |
| `mirrorDir` reads all file contents for comparison | High memory usage for binary files | Currently mitigated by early-exit on size mismatch (if added); acceptable for config files | At agent packages with large binary assets |
| LCS DP table `O(m*n)` memory | OOM for large files | `LCS_MAX_LINES` threshold triggers fallback | When any two compared files together exceed 2000 lines |
| `isDiffAvailable()` caches only one call | Correct for current design | If ever called in parallel async context, cache must be behind a mutex | Not applicable in current single-thread design |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Absolute paths in error output | Leaks username / directory structure in logs shared with others | All paths in errors must go through `toRelativePath()`; the `formatError` context loop does this for `path` key — verify no other keys contain paths |
| `sync-history.log` contains absolute paths | Log file committed to repo leaks machine info | `.gitignore` already excludes it; verify this is not accidentally staged during `to-repo` |
| `writeJsonSafe` fallback path (EXDEV) writes directly | On cross-device writes, bypasses atomic write guarantee | Acceptable tradeoff; document that EXDEV scenario is non-atomic |
| `DEVICE_FIELDS` mis-configuration | Machine-specific model setting synced to another device, overriding its preference | Any change to `DEVICE_FIELDS` must be symmetric in both read (diff) and write (apply) paths |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No timeout on `askConfirm` | User leaves terminal; process hangs indefinitely | Add a timeout (e.g., 30 seconds) that defaults to "no" and prints a message |
| `EXIT_DIFF=1` looks like an error in shell scripts | `if node sync.js diff; then` evaluates diff as failure | Document clearly that exit 1 means "differences found, not error"; provide `--quiet` flag that exits 0 when diff is clean |
| Approximate diff not flagged prominently | User trusts diff output that is factually incomplete | Print `[近似比對，結果可能不完整]` warning whenever `isApproximate` is true |
| `to-repo` only shows `git diff` suggestion, not actual `git add/commit` | User must know to run git manually; easy to forget | After `to-repo`, print exact `git add -A && git commit -m "..."` command to copy-paste |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **diff command:** Verify that the diff correctly identifies ALL changed files, not just the first one — test with multiple files changed simultaneously
- [ ] **to-local apply:** Verify that dry-run preview and actual apply produce identical change sets — run both in controlled fixture environment
- [ ] **settings.json sync:** Verify that `DEVICE_FIELDS` stripping is byte-identical between read and write paths — a round-trip test must produce exit 0 from diff
- [ ] **skills:diff:** Verify that `npx skills list` output is parsed correctly for the current installed version of the skills CLI — output format may have changed
- [ ] **cross-platform paths:** Verify that all path operations work on Windows where `path.sep` is `\` and `HOME` uses backslashes — `toRelativePath` uses `path.sep` correctly but verify edge cases
- [ ] **error exit codes:** Verify that all error paths exit with `EXIT_ERROR=2`, not 0 or 1 — a silent success on error is worse than a crash
- [ ] **TTY detection:** Verify `askConfirm` behavior when stdin is not a TTY — currently hangs, must be fixed before any automated verification can run `to-local`

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Serialization asymmetry causes repeated overwrites | LOW | Restore `settings.json` from git history; add round-trip test to prevent recurrence |
| `askConfirm` hang in CI | LOW | Kill process (SIGKILL); add TTY guard; re-run with `--dry-run` flag |
| Windows `fs.accessSync` false negative blocks write | LOW | Run with elevated permissions or fix `checkWriteAccess` to use try/catch |
| `mirrorDir` deleted a local file not in repo | MEDIUM | Restore from git stash or local backup; document that local files not in repo will be deleted on `to-local` |
| LCS fallback masked real diff | LOW | Run `git diff` on repo directly for accurate comparison; raise `LCS_MAX_LINES` threshold |
| Verification confirms "runs" but not "correct" | MEDIUM | Redesign verification fixtures to use controlled known-state directories |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Serialization asymmetry | Functional correctness audit (diff / settings round-trip) | Round-trip test: write via to-repo, diff reports EXIT_OK |
| `askConfirm` TTY hang | Edge case / error handling audit | Run `node sync.js to-local < /dev/null` — must exit with error, not hang |
| `fs.accessSync` Windows false negative | Cross-platform compatibility assessment | Run `to-local` on Windows with a read-only file that is actually writable via ACL |
| `mirrorDir` stale preview | Edge case / error handling audit | Modify source between dry-run and apply; confirm behavior |
| LCS false "no diff" | Functional correctness audit (diff accuracy) | Create a file with >2000 lines, modify it, run diff — verify output shows change |
| Verification tests check exit code only | Unit test coverage gap analysis | All verification fixtures must assert specific changed-file sets, not just exit codes |

---

## Sources

- Direct codebase analysis: `sync.js` (lines 318-325, 363-383, 629-694, 1717-1725)
- Known tech debt: `.planning/codebase/CONCERNS.md` (2026-04-09 audit)
- Project scope: `.planning/PROJECT.md`
- Node.js `fs.accessSync` Windows behavior: HIGH confidence from Node.js documentation and known platform limitation
- `readline` non-TTY behavior: HIGH confidence (reproducible, documented Node.js behavior)
- LCS `isApproximate` flag propagation: HIGH confidence from direct code reading (line 692)

---
*Pitfalls research for: CLI tool verification — sync-ai Node.js file sync tool*
*Researched: 2026-04-09*
