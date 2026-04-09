# Stack Research

**Domain:** Node.js CLI tool verification & health check (zero external dependencies)
**Researched:** 2026-04-09
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:test` | Node.js >= 18 (stable in v20) | Test runner for unit and integration tests | Built-in, zero dependencies, already used in this project; stable as of v20. No reason to reach for Jest/Vitest when the built-in runner handles everything needed. |
| `node:assert/strict` | Node.js >= 18 | Assertion library | Already used; strict mode catches type mismatches that loose equality would miss. No external library adds value here. |
| `node:child_process` (spawnSync/execFileSync) | Node.js >= 18 | CLI functional testing via subprocess invocation | Spawn `node sync.js <cmd>` as a real child process to get actual exit codes, stdout, stderr. No mock: test the real binary. Use `execFileSync` on Unix, `spawnSync` with `shell: false` on Windows. |
| `node:fs`, `node:os` (tmpdir) | Node.js >= 18 | Fixture management for I/O tests | `os.tmpdir()` + `fs.mkdtempSync()` for isolated per-test directories; `fs.rmSync` with `{ recursive: true, force: true }` for cleanup. Already used in `settings.test.js` via `withTmpDir`. |

### Supporting Capabilities (Built-in, No Install)

| Capability | API | Purpose | When to Use |
|------------|-----|---------|-------------|
| Built-in mocking | `node:test` `mock.fn()`, `mock.method()` | Spy on functions, intercept `process.exit` | When a function cannot be tested through a pure subprocess call; e.g., testing that `askConfirm()` reads `process.stdin.isTTY` correctly |
| Built-in coverage | `--experimental-test-coverage` flag | Line/branch/function coverage report | Run as `node --test --experimental-test-coverage test/*.test.js` to identify untested paths. Flag is experimental but functional in v20+; v22+ more stable. |
| `node:test` `mock.timers` | `context.mock.timers.enable()` | Freeze/advance time in tests | Not needed for sync-ai today (all sync), but available if async timeouts are ever added. |
| `process.platform` check in test helpers | `process.platform === 'win32'` | Conditional assertions for cross-platform tests | Use to branch expected path separators or command output in integration tests. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test --test-name-pattern="<name>"` | Run a single test by name | Already supported; use for fast iteration during investigation |
| `node --test --experimental-test-coverage` | Generate coverage report to stdout | No install; add `--test-coverage-include=sync.js` to scope to source only |
| `node --test --test-reporter=tap` | TAP output for structured parsing | Built-in reporters: `tap`, `spec`, `dot`, `junit`, `lcov` — useful if report automation is needed |
| Manual smoke test scripts | Validate IO-heavy commands (`to-repo`, `to-local`) | Document exact steps with expected outcomes; cannot be automated without a real `.claude` directory |

## Installation

```bash
# Nothing to install — entire stack is Node.js built-ins
# Verify Node.js version meets minimum:
node --version  # must be >= 18; v20 or v22 recommended for coverage flag
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node:test` (built-in) | Jest | If project already uses Jest, or if you need snapshot testing, extensive mock module support. NOT here — would violate zero-dependency constraint. |
| `node:test` (built-in) | Vitest | If project is ESM-first and needs watch mode with HMR. NOT here — same dependency constraint violation. |
| `node:child_process` (direct) | `execa` library | If you need cross-platform shell escaping, streaming, or Promise API out of the box. NOT here — zero-dependency constraint. `spawnSync` with `shell: false` suffices for the invocation pattern needed. |
| `--experimental-test-coverage` | `c8` | If you need HTML coverage reports or lcov integration with a CI dashboard. c8 has 10+ transitive dependencies — violates constraint. The built-in flag gives line/branch/function counts to stdout, which is sufficient for gap identification. |
| Temporary directory fixtures | Jest `beforeEach`/`afterEach` with mocked `fs` | If you want to avoid touching the real filesystem. Mocking `fs` is fragile and hides real platform differences. Real temp dirs catch actual Windows/macOS path issues. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `jest`, `vitest`, `mocha`, `tap` | Require `npm install`; violates zero-dependency constraint explicitly stated in PROJECT.md | `node:test` + `node:assert/strict` |
| `c8`, `nyc`, `istanbul` | External dependencies; c8 alone pulls 10+ transitive packages | `node --experimental-test-coverage` built-in flag |
| `execa`, `cross-spawn` | External packages for child process wrapping | `node:child_process` `spawnSync` with `shell: false` and `process.platform` guard |
| `sinon`, `testdouble` | External mocking libraries | `node:test` `mock.fn()` / `mock.method()` available since v18 |
| `nock`, `msw` | HTTP interceptors — not relevant | Not applicable; sync-ai makes no HTTP calls |
| Mocking the `fs` module | Hides real cross-platform path separator bugs | Real temp directories with `os.tmpdir()` + `fs.mkdtempSync()` |
| `process.exit()` without guard in tests | A called `process.exit()` kills the test runner process | Either: (a) test via subprocess so the child exits, not the runner; or (b) mock `process.exit` with `mock.fn()` before the call |

## Stack Patterns by Test Type

**Functional testing (happy path commands):**
- Spawn `node sync.js <cmd>` via `spawnSync('node', ['sync.js', 'diff'], { cwd, env, encoding: 'utf8' })`
- Assert on `status` (exit code), `stdout`, `stderr`
- Use a temporary directory mirroring expected repo structure as fixture
- Confidence: HIGH — this is the standard pattern for CLI black-box testing

**Edge case / error handling testing:**
- For errors that surface as exit code 2 and a message: subprocess approach (same as above)
- For errors internal to pure functions (SyncError): direct unit test with `assert.throws()`
- For TTY-dependent paths (`askConfirm`): pass `stdin: 'pipe'` to subprocess + write no input, assert on timeout/error behavior
- Confidence: HIGH — both paths already established in the codebase

**Cross-platform compatibility:**
- Primary: Run the test suite on both Windows (main) and macOS (secondary) manually to catch platform-specific failures
- In tests: use `path.join()` everywhere; never string-concatenate paths; assert on normalized paths using `path.normalize()`
- For path-sensitive assertions: use `path.sep` or branch on `process.platform === 'win32'`
- For the `diff` command fallback: Windows lacks a system `diff` binary; the JS LCS fallback should be exercised in tests by setting `SYNC_AI_DISABLE_SYSTEM_DIFF=1` (if added) or by verifying the fallback branch in unit tests
- Confidence: MEDIUM — cross-platform testing requires actual hardware or CI matrix; cannot be fully automated in a single-environment test run

**Coverage gap analysis:**
- Run `node --test --experimental-test-coverage --test-coverage-include=sync.js test/*.test.js`
- Interpret uncovered lines as candidates for new integration tests (I/O paths) or smoke test documentation
- Coverage output goes to stdout; no file required
- Confidence: HIGH — works in Node.js v20+, more stable in v22+

## Version Compatibility

| Capability | Minimum Node.js | Recommended | Notes |
|------------|-----------------|-------------|-------|
| `node:test` core (stable) | v18 | v20 or v22 | v18 was experimental; v20.0.0 declared stable |
| `mock.fn()`, `mock.method()` | v18.13+ | v20+ | Available since late v18; fully documented in v20 |
| `--experimental-test-coverage` | v18 | v22 | Experimental flag retained even in v22/v23; bug with `NODE_V8_COVERAGE` + subprocess hang exists in v20 (issue #49344); v22 more reliable |
| `spawnSync` with `shell: false` | v18 | any | `shell: false` is critical on Windows to avoid `.cmd` wrapper issues; on Unix it works identically |
| `mock.timers` | v20.4+ | v22 | Timer mocking added in v20.4 |

## Sources

- [Node.js Test Runner — official docs](https://nodejs.org/api/test.html) — subprocess isolation, mock API, coverage flag options (HIGH confidence)
- [Collecting Code Coverage in Node.js — Node.js Learn](https://nodejs.org/learn/test-runner/collecting-code-coverage) — `--experimental-test-coverage` flags, threshold options, `/* node:coverage ignore */` annotation (HIGH confidence)
- [c8 npm package](https://www.npmjs.com/package/c8) — confirmed c8 has 10+ transitive dependencies; eliminated as option (HIGH confidence)
- [goldbergyoni/nodejs-testing-best-practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) — "black-box testing > mocking internals" for CLIs; component-level testing approach (MEDIUM confidence — community source)
- [Node.js child_process cross-platform issues](https://medium.com/@python-javascript-php-html-css/resolving-compatibility-issues-with-node-js-child-process-spawn-and-grep-across-platforms-b33be96f9438) — `shell` option differences Windows vs Unix (MEDIUM confidence)
- [NODE_V8_COVERAGE subprocess hang issue #49344](https://github.com/nodejs/node/issues/49344) — known bug; reason to prefer v22 for coverage runs (HIGH confidence — official Node.js issue tracker)
- [Mocking in Node.js test runner](https://nodejs.org/learn/test-runner/mocking) — `mock.fn`, `mock.method` availability and usage (HIGH confidence)

---
*Stack research for: Node.js CLI tool verification (sync-ai health check milestone)*
*Researched: 2026-04-09*
