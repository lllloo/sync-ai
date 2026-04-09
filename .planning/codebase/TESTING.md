# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Node.js built-in `node:test` (no external test framework)
- Run via `npm test` which executes `node --test test/sync.test.js test/settings.test.js`
- Individual test file: `node --test --test-name-pattern="<pattern>" test/sync.test.js`

**Assertion Library:**
- Node.js built-in `node:assert/strict` (strict assertions)
- Imported as `const assert = require('node:assert/strict')`

**Run Commands:**
```bash
npm test                    # Run all tests (both sync.test.js and settings.test.js)
node --test test/sync.test.js                      # Run pure function tests
node --test test/settings.test.js                  # Run settings serialization tests
node --test --test-name-pattern="parseArgs" test/sync.test.js  # Run single test
```

## Test File Organization

**Location:**
- Co-located with source: `test/sync.test.js` mirrors `sync.js`, `test/settings.test.js` mirrors settings logic
- Pattern: `test/<module>.test.js` for each testable module

**Naming:**
- Test name format: descriptive Chinese text (e.g., `'computeLineDiff：兩個相同字串應無 +/- 行'`)
- Structure: `[Function name]：[Expected behavior]` — colon separates function from assertion
- Each test is self-contained and isolated

**Structure:**
```
test/
├── sync.test.js           # Tests pure functions from sync.js
└── settings.test.js       # Tests settings serialization & merging
```

## Test Structure

**Suite Organization:**
```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { exportedFunction, CONSTANT } = require('../sync.js');

// Optional: setup/teardown helpers
function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  try { return fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Tests
test('Function：behavior description', () => {
  const result = exportedFunction(input);
  assert.equal(result, expected);
});
```

**Patterns:**

1. **Isolation (withTmpDir):**
   - Fixture helper creates temporary directory for I/O tests
   - Cleans up in `finally` block regardless of test result
   - Used in `settings.test.js` (lines 26–34) for settings file tests
   - Example (lines 62–74 in settings.test.js):
     ```javascript
     test('loadStrippedSettings：移除所有 DEVICE_FIELDS', () => {
       withTmpDir((dir) => {
         const fp = path.join(dir, 'settings.json');
         const original = { permissions: ['a'], model: 'opus', effortLevel: 'high' };
         writeJson(fp, original);
         const result = loadStrippedSettings(fp);
         assert.ok(result, '應回傳 { clean, serialized }');
         for (const field of DEVICE_FIELDS) {
           assert.ok(!(field in result.clean), `${field} 應被移除`);
         }
       });
     });
     ```

2. **Mutation Wrapping (withArgv):**
   - For testing CLI argument parsing, wrap test in `withArgv` helper (line 129–133 in sync.test.js)
   - Temporarily modifies `process.argv`, restores in `finally`
   - Example (line 135–140):
     ```javascript
     test('parseArgs：解析指令與 --dry-run', () => {
       const result = withArgv(['to-repo', '--dry-run'], () => parseArgs());
       assert.equal(result.command, 'to-repo');
       assert.equal(result.dryRun, true);
     });
     ```

3. **Error Testing:**
   - Use `assert.throws()` with predicate function to check error type and code
   - Example (line 105–110 in sync.test.js):
     ```javascript
     test('parseSkillSource：缺少引數應丟 SyncError', () => {
       assert.throws(
         () => parseSkillSource({ extraArgs: [] }),
         (err) => err instanceof SyncError && err.code === ERR.INVALID_ARGS,
       );
     });
     ```

4. **Parametric Tests:**
   - Not used; each test case is explicit rather than parametrized
   - Keeps test names descriptive and assertion failures easy to diagnose

## Mocking

**Framework:** None (no external mocking library)

**Patterns:**
- Avoid mocking; use real functions or lightweight fixtures instead
- For file operations, use temporary directories (`withTmpDir`) instead of mocks
- For system calls (git, diff), rely on actual installed tools or fallback implementations
- Example in `test/sync.test.js` (line 28–32): real function calls, not mocks
  ```javascript
  test('computeLineDiff：兩個相同字串應無 +/- 行', () => {
    const ops = computeLineDiff('a\nb\nc', 'a\nb\nc');
    const changed = ops.filter(op => op.type !== ' ');
    assert.equal(changed.length, 0);
  });
  ```

**What to Mock:**
- Generally avoid; pure functions don't need mocks

**What NOT to Mock:**
- File system operations (use temporary directories instead)
- Git commands (use real git or accept skip if not available)
- External executables like `diff` (already has graceful fallback in source code)

## Fixtures and Factories

**Test Data:**
- Inline literals for simple cases (primitives, small objects)
- Helper function `writeJson()` (lines 32–34 in settings.test.js) for file fixtures:
  ```javascript
  function writeJson(filePath, obj) {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
  }
  ```
- Fixtures are created fresh per test (not shared)
- Example usage (line 63–65 in settings.test.js):
  ```javascript
  withTmpDir((dir) => {
    const fp = path.join(dir, 'settings.json');
    const original = { permissions: ['a'], model: 'opus', effortLevel: 'high' };
    writeJson(fp, original);
    // ... test assertion
  });
  ```

**Location:**
- Fixture helpers in test file itself (`sync.test.js`, `settings.test.js`)
- No separate fixtures directory; keep tests self-contained and runnable independently

## Coverage

**Requirements:** No formal coverage target enforced

**View Coverage:**
- No coverage tool configured
- Manual code inspection during review ensures critical paths tested
- Test selection follows: pure functions (100% coverage expected) vs. IO functions (smoke tested manually)

## Test Types

**Unit Tests (100% of test suite):**
- Test pure functions only (those exported from `sync.js`)
- Examples: `computeLineDiff`, `parseArgs`, `matchExclude`, `statusToStatsKey`, `parseSkillSource`, `toRelativePath`, `serializeSettings`, `loadStrippedSettings`
- All tests in both `sync.test.js` and `settings.test.js` are unit tests
- Scope: single function, no file I/O or external processes (except where fixtures provide them)
- Approach: direct function call with known inputs, assertion on return value

**Integration Tests:**
- Not automated in test suite
- Manual smoke test before release: `npm run to-repo --dry-run`, `npm run to-local`, etc.
- Rationale: too coupled to user's actual `.claude` directory; cannot run in CI

**E2E Tests:**
- Not present (not applicable for single-file CLI tool)

## Common Patterns

**Async Testing:**
- Not used; all functions are synchronous
- If async functions added in future, use `async function()` in test and `await` calls

**Example of Future Async Pattern (not currently used):**
```javascript
test('async function：should resolve with value', async () => {
  const result = await asyncFunc();
  assert.equal(result, expected);
});
```

**Error Testing:**
```javascript
// Pattern: assert.throws with predicate
test('function：should throw SyncError with code', () => {
  assert.throws(
    () => functionThatThrows(),
    (err) => err instanceof SyncError && err.code === ERR.SPECIFIC_ERROR,
  );
});

// Or for message content:
test('function：should throw error with message', () => {
  assert.throws(
    () => functionThatThrows(),
    /expected message text/,
  );
});
```

## Settings Serialization Regression Tests

**Special Category:** Tests in `settings.test.js` lock down symmetric serialization behavior

**Purpose:**
- Prevent regression of bug #3 (issue: `to-local` path used different newline handling than `to-repo`/`diff`)
- Ensure `serializeSettings`, `loadStrippedSettings`, and `writeJsonSafe` all produce identical format

**Example Test (lines 118–124 in settings.test.js):**
```javascript
test('回歸：writeJsonSafe 與 serializeSettings 的輸出格式對稱', () => {
  const obj = { permissions: ['Bash(npm test)'], statusLine: { type: 'cmd' } };
  const writeOutput = JSON.stringify(obj, null, 2) + '\n';
  assert.equal(serializeSettings(obj), writeOutput);
});
```

**Critical Tests:**
- `serializeSettings：輸出含結尾換行` (line 39–42) — verifies newline always present
- `loadStrippedSettings：serialized 欄位為 clean 的 serializeSettings 輸出` (line 76–84) — ensures symmetric output
- `回歸：to-local 比對 — 相同內容（僅 device fields 不同）應被視為一致` (line 126–150) — the full regression test that locks down #3 fix

## Command Completeness Tests

**Test Pattern (lines 187–198 in sync.test.js):**
- Ensures `COMMANDS` object is consistent with `VALID_COMMANDS`, `COMMAND_ALIASES`
- Verifies no orphaned aliases or missing command entries
- Critical for data-driven dispatch to function correctly

```javascript
test('COMMANDS：所有指令名稱皆列於 VALID_COMMANDS', () => {
  for (const cmd of Object.keys(COMMANDS)) {
    assert.ok(VALID_COMMANDS.includes(cmd), `${cmd} 應在 VALID_COMMANDS`);
  }
});

test('COMMAND_ALIASES：別名應對應回正式指令', () => {
  for (const [alias, cmd] of Object.entries(COMMAND_ALIASES)) {
    assert.ok(COMMANDS[cmd], `別名 ${alias} -> ${cmd} 應存在於 COMMANDS`);
    assert.equal(COMMANDS[cmd].alias, alias);
  }
});
```

## Testing Philosophy

**What Gets Unit-Tested:**
- All pure functions (deterministic, no side effects)
- Command-line argument parsing
- File path transformations
- Data serialization/deserialization
- Error code mapping

**What Gets Smoke-Tested Manually:**
- Actual file sync operations (`to-repo`, `to-local`)
- Git integration (status display, commit display)
- Interactive prompts
- Skills management commands
- Cross-platform behavior (Windows/macOS)

**Rationale:**
- Pure functions are fast, reliable, deterministic
- IO-heavy functions are fragile in automated tests (depends on environment)
- Single-file design means full repo can be imported for unit testing
- Zero external dependencies means test suite runs without setup

---

*Testing analysis: 2026-04-09*
