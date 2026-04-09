---
phase: 1
slug: command-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node.js built-in) |
| **Config file** | test/sync.test.js, test/settings.test.js |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FUNC-01 | — | N/A | static analysis + dry-run | `node sync.js diff --dry-run` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | FUNC-02 | — | N/A | static analysis | code trace of diffSyncItems | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | FUNC-08 | — | N/A | static analysis + dry-run | `node sync.js to-repo --dry-run` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | FUNC-03 | — | N/A | static analysis | code trace of runToRepo | ✅ | ⬜ pending |
| 1-02-02 | 02 | 1 | FUNC-04 | — | N/A | static analysis | code trace of mergeSettingsJson | ✅ | ⬜ pending |
| 1-02-03 | 02 | 1 | FUNC-05 | — | N/A | static analysis | code trace of mirrorDir | ✅ | ⬜ pending |
| 1-03-01 | 03 | 1 | FUNC-06 | — | N/A | static analysis | code trace of runToLocal | ✅ | ⬜ pending |
| 1-03-02 | 03 | 1 | FUNC-07 | — | N/A | static analysis | code trace of mergeSettingsJson | ✅ | ⬜ pending |
| 1-04-01 | 04 | 1 | FUNC-09 | — | N/A | static analysis | code trace of runSkillsDiff | ✅ | ⬜ pending |
| 1-04-02 | 04 | 1 | FUNC-10 | — | N/A | static analysis | code trace of runDiffAll | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase produces a report via static analysis and dry-run execution — no new test infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| to-local 互動確認流程 | FUNC-06 | 需要 TTY 環境互動輸入 | 手動執行 `npm run to-local` 觀察預覽 + 確認流程 |
| skills:diff 與本機 skills 比對 | FUNC-09 | 需要本機已安裝 skills | 手動執行 `npm run skills:diff` 觀察輸出 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
