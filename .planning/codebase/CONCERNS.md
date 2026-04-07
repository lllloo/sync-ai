# Codebase Concerns

**Analysis Date:** 2026-04-07

## Tech Debt

**Large file diff performance degradation:**
- Issue: Files larger than 2000 lines (m+n combined) trigger `computeSimpleLineDiff()` which produces approximate diffs using Set-based line comparison, losing position information for repeated lines.
- Files: `sync.js` (lines 625-665, 674-693)
- Impact: Users cannot trust diff output for large files—reordered duplicate lines appear as deletions+additions even if logically unchanged. This can mask real changes or create false alarm diffs when syncing large config files.
- Fix approach: Implement a sliding-window O(n) diff algorithm or pre-process large files to detect repeated lines at the set level (e.g., group by content hash). Consider increasing `LCS_MAX_LINES` threshold after performance testing with actual config sizes.

**Unchecked file read errors in sync operations:**
- Issue: `copyFile()`, `mirrorDir()`, and `diffFile()` / `diffDir()` do NOT wrap `readFileSync()` calls with try-catch. If a file becomes inaccessible between the existence check and the read (TOCTOU race condition), the sync crashes with an unhandled exception.
- Files: `sync.js` (lines 406, 411, 415, 481, 486-487, 584, 607-608)
- Impact: On Windows or network filesystems, file permissions can change during sync. A crash mid-sync leaves the working directory in an inconsistent state. For `to-local` sync, `isWriting` flag is set but error bypasses `finally` block recovery.
- Fix approach: Wrap all `readFileSync()` calls in `copyFile()` and `mirrorDir()` (lines 481, 486-487) with `checkReadAccess()` immediately before reading. For `diffFile()`/`diffDir()`, gracefully treat read-failed files as "changed" and log a warning. In `mirrorDir()`, move line 481's read inside a try-catch that treats read errors as requiring write.

**Fragile readline interface in confirmation prompt:**
- Issue: `askConfirm()` creates a readline interface without explicit error handling or timeout. If stdin closes or hangs, the interface never resolves, blocking the process indefinitely.
- Files: `sync.js` (lines 1660-1668)
- Impact: Interactive `to-local` sync can hang forever on automation servers (CI/CD with no TTY) or if stdin connection drops. User must force-kill the process.
- Fix approach: Add a `setTimeout()` with 30-second limit that rejects the promise with a SyncError. Validate that `process.stdin.isTTY` is true before attempting interactive prompts; throw error if non-TTY.

## Known Bugs

**Potential data loss in atomic write fallback:**
- Symptoms: If `fs.renameSync()` fails with EXDEV (cross-device link), code falls back to direct `fs.writeFileSync()` without the atomic guarantee. A power loss during the fallback write can corrupt the target file.
- Files: `sync.js` (lines 362-382)
- Trigger: Running sync across mount points (e.g., external USB drive to internal SSD on Windows, or NFS to local filesystem on macOS).
- Workaround: Use the `--dry-run` flag first to test the sync before committing data on cross-device targets.
- Fix approach: Implement cross-device fallback using write-to-sibling + rename pattern (write to a temp in the same directory as dest, then rename). If not possible, create a distinct error message warning user to retry after moving files to same mount point.

**Signal handler race condition:**
- Symptoms: If SIGINT arrives while `isWriting` is true but before the try-catch sets it false, the signal prints "同步中斷" but the handler exits via `process.kill()` before cleanup fully completes.
- Files: `sync.js` (lines 256-267, 1360-1374)
- Trigger: User presses Ctrl+C during active write to filesystem.
- Impact: Low-risk in practice (cleanup is synchronous), but race window exists.
- Fix approach: Make `isWriting` flag flip atomic by using a finally block in the signal handler, or use `process.exitCode = code; process.exit()` pattern instead of `process.kill()`.

## Security Considerations

**User home directory exposure in error messages:**
- Risk: `toRelativePath()` attempts to mask HOME with `~/`, but error context values bypass this masking in some paths. If a user shares error output, relative paths might still contain username on Windows (e.g., `Users\RoyXXX\...`).
- Files: `sync.js` (lines 175-183, 196-209)
- Current mitigation: `toRelativePath()` masks `~` in path strings; `formatError()` calls `toRelativePath()` for context fields.
- Recommendations: Add a second pass in `formatError()` to post-process all string context values through `toRelativePath()`. Add a log level (--quiet mode) that suppresses context output entirely for CI/CD use.

**JSON injection via settings.json device fields:**
- Risk: If `DEVICE_FIELDS` constant is modified to exclude fewer fields, a user could commit sensitive values (API keys, tokens) to the repo in `settings.json` and sync them to other machines.
- Files: `sync.js` (lines 31-32, 839-892)
- Current mitigation: Hard-coded `DEVICE_FIELDS = ['model', 'effortLevel']` limits what can leak; settings are stripped before writing to repo.
- Recommendations: Add a validation step in `mergeSettingsJson()` to scan the local settings for known secret patterns (e.g., keys starting with `sk_`, `pk_`) and warn user before stripping. Document in README that any sensitive field MUST be added to `DEVICE_FIELDS`.

## Performance Bottlenecks

**Inefficient directory traversal in mirrorDir / getFiles:**
- Problem: `getFiles()` is called for both source and destination in `mirrorDir()` (lines 474-475, 499), leading to double-traversal if dest is large. Each `getFiles()` call recurses fully even if the directory is unchanged.
- Files: `sync.js` (lines 428-450, 469-509)
- Cause: No caching between getFiles calls; no lazy evaluation.
- Improvement path: Cache results of `getFiles(dest)` in the initial `mirrorDir()` call, reuse in the second loop. For frequently-synced large agent directories, consider a hash-of-hashes approach (directory content checksum) to skip unnecessary comparisons.

**Synchronous string processing for large files:**
- Problem: `computeLineDiff()` for files near 2000 lines will allocate a (1000 × 1000) DP table (~4MB as documented), blocking the event loop.
- Files: `sync.js` (lines 625-665)
- Cause: No async processing; Node.js default is synchronous fs + compute.
- Improvement path: For files >2000 lines, use `computeSimpleLineDiff()` by default (which is already O(n)). Reserve full LCS only for explicitly requested detailed diffs via a `--detailed-diff` flag.

## Fragile Areas

**Settings.json merge logic complexity:**
- Files: `sync.js` (lines 839-892)
- Why fragile: `mergeSettingsJson()` has three separate code paths (to-repo with/without changes, to-local with repo/without repo). Each path computes stripped JSON differently (some use `getStrippedSettings()`, some inline). String comparison mixes JSON.stringify outputs and fs reads, making it error-prone if JSON formatting changes.
- Safe modification: Refactor to a single `compareSettingsJson(local, repo, direction)` function that computes both sides once, returns a structured diff object, then applies conditionally.
- Test coverage: No unit test for `mergeSettingsJson()` (it's a complex function with side effects). Add at least one test: "to-repo strips DEVICE_FIELDS but preserves other settings".

**Global state in isWriting flag:**
- Files: `sync.js` (lines 248, 1360, 1373, 258)
- Why fragile: `isWriting` is a global boolean with no mutex; if two concurrent CLI invocations run (possible in automation), they can interfere. Also, the flag is set only around `applySyncItems()`, so signal during `confirmAndApply()` interactive prompt doesn't set it, leading to no warning if user Ctrl+Cs during prompt.
- Safe modification: If concurrency is never intended, add a process-wide lock file (`.sync-ai.lock`) at startup and release at exit. If concurrency must be supported, use file-based locking. For interactivity, set `isWriting = true` at the start of `confirmAndApply()`.
- Test coverage: No test for signal handling or interactivity. Manual smoke test required.

**Hardcoded path constants:**
- Files: `sync.js` (lines 25-29)
- Why fragile: `CLAUDE_HOME = path.join(HOME, '.claude')` and `AGENTS_HOME = path.join(HOME, '.agents')` are hardcoded. If user's config directory differs (e.g., custom XDG_CONFIG_HOME on Linux), sync silently syncs to wrong location.
- Safe modification: Add environment variable fallback: `CLAUDE_HOME = process.env.CLAUDE_HOME || path.join(HOME, '.claude')`. Document in README.
- Test coverage: No test with different HOME or CLAUDE_HOME values.

## Scaling Limits

**Directory recursion depth:**
- Current capacity: `getFiles()` and `cleanEmptyDirs()` use unbounded recursion. If user has agents with 100+ levels of nesting, stack overflow is possible.
- Limit: Node.js default stack is ~1000 frames; nesting >500 levels will crash.
- Scaling path: Convert `cleanEmptyDirs()` to iterative using a queue. For `getFiles()`, add a depth limit parameter (default 20) with a warning log if exceeded.

**Settings.json file size:**
- Current capacity: Entire settings.json is loaded into memory as a JS object. On typical machines, this is <1MB (no issue).
- Limit: If settings.json grows to >50MB (unlikely but possible in automated test suites), JSON.parse/stringify will stall.
- Scaling path: For very large settings, implement streaming JSON parser or chunked merge. For now, add a size check: if settings.json >5MB, warn user and skip sync.

## Dependencies at Risk

**No external dependencies (positive):**
- Risk: None—project uses only Node.js built-ins. No version lock issues.
- Impact: Low maintenance burden.
- Migration plan: If future features require external libraries (e.g., chalk for colors), carefully evaluate cost vs. benefit. Currently, ANSI codes are manually implemented.

## Missing Critical Features

**No transactional multi-file sync:**
- Problem: If `to-local` partially fails (e.g., syncs agents but crashes before settings), the working directory is inconsistent. User must manually revert or re-run.
- Blocks: Users cannot safely sync in high-stakes environments (e.g., critical Claude Code config on production machines).
- Fix approach: Implement rollback mechanism: collect all changes into a manifest, apply all-or-nothing. If any write fails, restore from manifest and exit with error. Requires more complex bookkeeping but improves reliability.

**No bandwidth/throttling for large syncs:**
- Problem: Syncing 1000+ agent files over slow networks (e.g., cellular) can timeout or be killed by network layer.
- Blocks: Use on very large agent libraries with slow connections.
- Fix approach: Add `--chunk-size` flag to limit files synced per batch. Show progress bar for long-running operations.

## Test Coverage Gaps

**No integration tests for actual sync operations:**
- What's not tested: `applySyncItems()`, `copyFile()`, `mirrorDir()`, `mergeSettingsJson()` (side-effecting functions). Only pure functions like `computeLineDiff()` are tested.
- Files: `test/sync.test.js` (198 lines total); `sync.js` (1757 lines)
- Risk: Critical bugs in file sync logic could ship undetected. E.g., a typo in `copyFile()` that deletes instead of copies would only be caught by manual testing.
- Priority: **High** — add at least smoke tests for:
  1. `to-repo` creates files in repo directory
  2. `to-local` applies files to local directory
  3. `to-repo --dry-run` does NOT modify repo
  4. `settings.json` DEVICE_FIELDS are correctly stripped

**No error recovery tests:**
- What's not tested: Behavior when disk is full, permission denied, file locked, network timeout (if NFS is used).
- Risk: Error messages may be confusing or error handling may fail (e.g., cleanup not triggered).
- Priority: **Medium** — add tests for permission errors, file access races.

**No test for SIGINT/SIGTERM signal handling:**
- What's not tested: Pressing Ctrl+C during sync properly cleans up temp files and doesn't corrupt state.
- Risk: If cleanup logic breaks, temp files accumulate or partially-written files remain.
- Priority: **Medium** — manual test or use process spawning in test harness to send signals.

---

*Concerns audit: 2026-04-07*
