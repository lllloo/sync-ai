# Architecture Research

**Domain:** CLI Tool Verification — structured health check for layered CLI sync tool
**Researched:** 2026-04-09
**Confidence:** HIGH (derived from existing codebase map and architectural documentation)

## Standard Architecture

### System Overview

The verification task maps directly onto sync-ai's existing layered architecture. Each layer becomes its own verification domain, with bottom-up dependency ordering.

```
┌─────────────────────────────────────────────────────────────────┐
│                   VERIFICATION REPORT                           │
│         (assembled after all layers are verified)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│               LAYER 6: Command Layer Verification               │
│  diff / to-repo / to-local / skills:diff — end-to-end smoke     │
│  Depends on: all layers below                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│             LAYER 5: Cross-Cutting Concerns Verification        │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │ Exit Codes   │  │ Path Masking   │  │   Sync Log        │   │
│  └──────────────┘  └────────────────┘  └───────────────────┘   │
│  Depends on: Error layer, FS layer                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              LAYER 4: Sync Core Verification                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐   │
│  │  buildSyncItems  │  │  diffSyncItems   │  │ applySyncIt │   │
│  │  (SyncItem decl) │  │  (status calc)   │  │ (write+dry) │   │
│  └──────────────────┘  └──────────────────┘  └─────────────┘   │
│  Depends on: FS layer, Settings layer                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│            LAYER 3: Settings Handler Verification               │
│  serializeSettings / loadStrippedSettings / mergeSettingsJson   │
│  DEVICE_FIELDS exclusion, serialization symmetry                │
│  Depends on: FS layer                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              LAYER 2: FS Utilities Verification                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  readJson /  │  │  copyFile /  │  │  writeJsonSafe       │   │
│  │ writeJsonSafe│  │  mirrorDir   │  │  (atomic: tmp+rename)│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  Depends on: Error layer only                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              LAYER 1: Error Handling Verification               │
│  SyncError class / formatError() / error codes / path masking   │
│  Depends on: nothing (lowest layer)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities in Verification Context

| Verification Layer | What to Verify | Scope |
|--------------------|----------------|-------|
| Error Handling | SyncError codes complete, formatError masks paths, suggestions correct | Unit-testable, no I/O |
| FS Utilities | Atomic write safety, EXDEV fallback, permission checks, mirrorDir correctness | Requires temp files |
| Settings Handler | DEVICE_FIELDS stripped on both read/write, merge symmetry, round-trip fidelity | Requires temp files |
| Sync Core | SyncItem declaration covers all files, diff status accuracy, applySyncItems respects dry-run | Requires fixture dirs |
| Cross-Cutting | EXIT_OK/DIFF/ERROR codes correct, path masking in all outputs, log append correctness | Requires output capture |
| Command Layer | Each command behaves correctly end-to-end across happy path + edge cases | Full integration |

## Verification Structure (Project-Specific)

```
.planning/verification/
├── L1-error-handling.md     # SyncError codes, formatError, path masking
├── L2-fs-utilities.md       # writeJsonSafe, copyFile, mirrorDir, checkAccess
├── L3-settings-handler.md   # DEVICE_FIELDS, merge, round-trip symmetry
├── L4-sync-core.md          # buildSyncItems, diffSyncItems, applySyncItems
├── L5-cross-cutting.md      # exit codes, path masking, sync log
├── L6-commands.md           # diff / to-repo / to-local / skills:diff
└── REPORT.md                # assembled findings, gap analysis, recommendations
```

### Structure Rationale

- **Per-layer files:** Keeps verification findings scoped so gaps in one layer don't obscure findings in another.
- **Bottom-up ordering (L1→L6):** Each layer depends on the layers below. If L2 (FS) has a bug, L4 (Sync Core) findings are unreliable. Verify foundations first.
- **Separate REPORT.md:** Assembled last, synthesizes cross-layer patterns (e.g., "path masking fails in L2 and L5") and provides the unified health assessment.

## Architectural Patterns

### Pattern 1: Bottom-Up Verification Order

**What:** Verify the lowest-dependency layers first. Error Handling (no deps) → FS Utilities → Settings → Sync Core → Cross-Cutting → Commands.

**When to use:** Always for layered architectures where higher layers depend on lower ones. A bug in FS utilities can produce false negatives in command-level verification.

**Trade-offs:**
- Pro: Findings are causally ordered — L2 bugs explain L6 symptoms
- Pro: Allows early stopping if a foundational layer is broken
- Con: Takes longer to reach user-visible behaviors (commands)

### Pattern 2: Scenario-Based Coverage per Layer

**What:** For each layer, verify three scenario types: (A) happy path, (B) edge cases, (C) error conditions.

**When to use:** All layers except Cross-Cutting (which is purely structural, not scenario-driven).

**Trade-offs:**
- Pro: Systematic — every layer gets the same rigor
- Pro: Edge cases and errors are explicitly tracked, not ad-hoc
- Con: Can produce redundancy where higher layers re-exercise lower-layer edge cases

**Example structure per layer:**
```
## Happy Path
- [ ] Scenario A: [description] → Expected: [outcome]

## Edge Cases
- [ ] Scenario B: [description] → Expected: [outcome]

## Error Conditions
- [ ] Scenario C: [description] → Expected: [outcome]
```

### Pattern 3: Verdict-Per-Scenario Reporting

**What:** Every verification scenario produces one of: PASS / FAIL / SKIP (not testable without code changes) / WARN (works but fragile).

**When to use:** Verification reports (not unit tests). Provides actionable status without requiring code modification.

**Trade-offs:**
- Pro: Clear go/no-go per scenario
- Pro: WARN distinguishes "works today, risky tomorrow" from true failures
- Con: SKIP can hide gaps if overused — must document why each SKIP was necessary

## Data Flow for Verification

### Verification Dependency Flow

```
sync.js source
    │
    ├── L1: Error Handling ──────────────────────────────────────┐
    │       (no upstream deps)                                   │
    │                                                            │
    ├── L2: FS Utilities ─────────────────────────────────────── │
    │       deps: L1 (throws SyncError)                          │
    │                                                            │
    ├── L3: Settings Handler ─────────────────────────────────── │
    │       deps: L2 (readJson / writeJsonSafe)                  │
    │                                                            │
    ├── L4: Sync Core ───────────────────────────────────────────┤
    │       deps: L2 + L3                                        │
    │                                                            │
    ├── L5: Cross-Cutting Concerns ──────────────────────────────┤
    │       deps: L1 (exit codes), L2 (log), L4 (path masking)  │
    │                                                            │
    └── L6: Commands ────────────────────────────────────────────┘
            deps: all layers (full integration)
                    │
                    ▼
            REPORT.md (synthesized findings)
```

### Key Data Flows to Verify

1. **Settings round-trip:** local settings.json → strip DEVICE_FIELDS → write to repo → read back → merge with local device fields → result matches original. This flow touches L2+L3 and is the highest-risk data transformation.

2. **Dry-run propagation:** `--dry-run` flag set in L6 (command parsing) → passed to L4 (applySyncItems) → must reach every write call in L2. Verify the flag is never dropped across layer boundaries.

3. **Error surfacing:** SyncError thrown in L2 (e.g., PERMISSION) → propagates through L4 → caught by L6's main().catch() → formatError() produces masked, human-readable message. Verify no error is swallowed silently.

4. **Exit code correctness:** diff with changes → EXIT_DIFF(1); diff clean → EXIT_OK(0); any error → EXIT_ERROR(2). Verify each command returns the correct code under each condition.

5. **Path masking coverage:** Every user-visible output (status lines, diff headers, error messages, verbose logs) must show relative paths or ~/. Verify no absolute paths leak in any output path.

## Scaling Considerations

This is a local CLI tool — scaling in the traditional sense does not apply. The relevant "scaling" is verification coverage growth:

| Verification Scope | Architecture Adjustment |
|-------------------|------------------------|
| Single command | Ad-hoc smoke test (current state) |
| All 4 commands, happy path | L6 verification file only |
| All layers, all scenarios | Full L1-L6 + REPORT.md structure (recommended) |
| Regression prevention | Unit tests for pure functions (already exists for L1/L4 partials) |

### Coverage Priorities

1. **First gap:** L4 (Sync Core) applySyncItems has no unit tests — only integration path exists. Highest risk because it performs actual writes.
2. **Second gap:** L3 (Settings Handler) round-trip has no explicit test for the merge symmetry property (merge(strip(A), B) = A with B's device fields).
3. **Third gap:** L5 cross-cutting — exit codes and path masking have no test; only tested implicitly through manual smoke testing.

## Anti-Patterns

### Anti-Pattern 1: Top-Down Verification Only

**What people do:** Jump straight to verifying the `diff` and `to-repo` commands end-to-end, skipping layer verification.

**Why it's wrong:** A command-level failure gives no signal about which layer caused it. Debugging requires re-doing the work bottom-up anyway. A passing command does not guarantee the underlying layers are correct — it only proves the happy path didn't crash.

**Do this instead:** Verify bottom-up (L1 → L6). Command-level verification becomes a final integration check, not the primary verification method.

### Anti-Pattern 2: Binary Pass/Fail Without WARN

**What people do:** Mark every scenario as PASS or FAIL, with no intermediate state.

**Why it's wrong:** For a verification report (not a test suite), "works but fragile" is a distinct and actionable finding. Example: `mirrorDir` correctly deletes extra files in repo, but does so without preview — it works, but is a footgun waiting for a misconfigured sync direction.

**Do this instead:** Use PASS / FAIL / WARN / SKIP. WARN means "functions correctly but carries notable risk or technical debt."

### Anti-Pattern 3: Verifying I/O Layers Without Fixtures

**What people do:** Verify FS utilities by reading/writing actual config files on the developer's machine.

**Why it's wrong:** Pollutes real config, cannot run safely on CI, results depend on machine state, and destructive tests (mirrorDir deleting files) are unsafe.

**Do this instead:** Use OS temp directories (`os.tmpdir()`) for all L2/L3/L4 verification scenarios. Create minimal fixture files; clean up after each scenario.

### Anti-Pattern 4: Merging Cross-Platform Findings

**What people do:** Write a single set of findings that conflates Windows and macOS behavior.

**Why it's wrong:** This tool runs on both platforms. Path separators, `os.homedir()` resolution, `fs.rename()` across drives (EXDEV), and `spawn('diff')` availability differ between platforms. Merged findings hide platform-specific bugs.

**Do this instead:** For each layer, note per-platform observations separately. The L2 FS layer and L6 command layer are highest risk for platform divergence.

## Integration Points

### External Services

| Service | Integration Pattern | Verification Notes |
|---------|---------------------|-------------------|
| Git (CLI) | `spawn('git', ...)` in runToRepo, showGitStatus | Verify error handling when git not available or repo dirty |
| npx skills | `spawn('npx', ['skills', 'list'])` in runSkillsDiff | Verify fallback when skills CLI not installed |
| External diff | `spawn('diff', ...)` in printDetailedDiff | Verify JS fallback activates correctly when diff not on PATH |

### Internal Boundaries

| Boundary | Communication | Verification Focus |
|----------|---------------|-------------------|
| Command Layer → Sync Core | Direct function call, passes opts | Verify dry-run and verbose flags pass through intact |
| Sync Core → Settings Handler | Direct function call per SyncItem of type 'settings' | Verify only settings items go through mergeSettingsJson |
| Sync Core → FS Utilities | Direct function calls | Verify writeJsonSafe is used (not fs.writeFile directly) |
| Error Layer → All | SyncError thrown, caught at main().catch() | Verify no intermediate layer swallows errors silently |
| Display Layer → All commands | Shared printStatusLine / printFileDiff | Verify path masking applied in all output calls |

## Sources

- `sync.js` codebase (direct analysis, HIGH confidence)
- `.planning/codebase/ARCHITECTURE.md` (existing architectural map, HIGH confidence)
- `.planning/PROJECT.md` (verification scope and constraints, HIGH confidence)
- General CLI verification patterns (training data, MEDIUM confidence)

---
*Architecture research for: CLI Tool Verification — sync-ai health check*
*Researched: 2026-04-09*
