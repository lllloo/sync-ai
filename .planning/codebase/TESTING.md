# 測試模式

**分析日期：** 2026-04-07

## 測試框架

**執行器：**
- Node.js 內建 `node:test` 模組（Node v18+）
- 設定檔：`test/sync.test.js`

**斷言庫：**
- Node.js 內建 `node:assert/strict`

**執行指令：**
```bash
npm test                                       # 執行所有測試
node --test --test-name-pattern="name" test/sync.test.js  # 單一測試
```

## 測試檔案組織

**位置：**
- 測試與來源檔分離：`test/sync.test.js` 對應 `sync.js`

**命名：**
- 測試檔案：`[模組名].test.js`
- 目前僅一個測試檔案

**結構：**
```
test/
├── sync.test.js          # sync.js 的純函式單元測試
```

## 測試結構

**Suite 組織：**

測試組織採用「函式分組」策略，每個被測函式使用註釋橫線分隔：

```javascript
// 每個函式對應一個測試區段
// -----------------------------------------------
// computeLineDiff
// -----------------------------------------------
test('computeLineDiff：兩個相同字串應無 +/- 行', () => {
  const ops = computeLineDiff('a\nb\nc', 'a\nb\nc');
  const changed = ops.filter(op => op.type !== ' ');
  assert.equal(changed.length, 0);
});

// -----------------------------------------------
// matchExclude
// -----------------------------------------------
test('matchExclude：精確字串比對', () => {
  assert.equal(matchExclude('foo.json', 'foo.json'), true);
  assert.equal(matchExclude('foo.json', 'bar.json'), false);
});
```

**測試命名慣例：**
- 格式：`[函式名]：[測試場景]`
- 繁體中文描述，例如：`computeLineDiff：兩個相同字串應無 +/- 行`

**模式：**
- 無 `describe` 塊，直接使用 `test()` 宣告
- 每個 `test()` 為獨立的「情境單元」
- 簡單斷言 assertion（避免複雜的 setup/teardown）

## Fixture 與工廠

**測試資料：**

`parseArgs` 測試採用輔助函式處理 `process.argv` 變動：

```javascript
function withArgv(argv, fn) {
  const original = process.argv;
  process.argv = ['node', 'sync.js', ...argv];
  try { return fn(); } finally { process.argv = original; }
}

test('parseArgs：解析指令與 --dry-run', () => {
  const result = withArgv(['to-repo', '--dry-run'], () => parseArgs());
  assert.equal(result.command, 'to-repo');
  assert.equal(result.dryRun, true);
});
```

**位置：**
- 輔助函式定義於測試檔案內（`test/sync.test.js`）
- 無獨立的 fixture 或工廠檔案

## 覆蓋率

**要求：**
- 純函式必須 100% 覆蓋（視同強制）
- 有 I/O 的函式靠人工 smoke test 驗證

**檢查指令：**
```bash
# 暫無自動化覆蓋檢查，手工審查確保純函式完全測試
npm test
```

## 測試類型

**單元測試（全部）：**
- **範圍**：純函式邏輯驗證（`computeLineDiff`、`matchExclude` 等）
- **方法**：直接呼叫函式，檢查回傳值
- **特色**：無副作用、無檔案 I/O、完全可重複

**整合測試：**
- 不在自動化測試範圍內
- 通過人工 smoke test 驗證：
  - `npm run diff`
  - `npm run to-repo --dry-run`
  - `npm run to-local --dry-run`

**E2E 測試：**
- 無自動化 E2E
- 人工驗證跨裝置同步行為

## 常見模式

**非同步測試：**
```javascript
// 目前無非同步測試（sync.js 的 main 是 async，但測試內容為純函式）
```

**錯誤測試：**

使用 `assert.throws()` 驗證例外拋出：

```javascript
test('parseSkillSource：缺少引數應丟 SyncError', () => {
  assert.throws(
    () => parseSkillSource({ extraArgs: [] }),
    (err) => err instanceof SyncError && err.code === ERR.INVALID_ARGS,
  );
});

test('parseSkillSource：skills.sh URL 格式錯誤應丟錯', () => {
  assert.throws(
    () => parseSkillSource({ extraArgs: ['https://skills.sh/onlyone'] }),
    (err) => err instanceof SyncError && err.code === ERR.INVALID_ARGS,
  );
});
```

**核心特色：**
- 驗證拋出的 `SyncError` instance
- 檢查 `err.code` 是否等於預期的錯誤代碼

## 測試案例清單

### computeLineDiff（7 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | 兩個相同字串 | 無 +/- 行 |
| 2 | 空字串 → 新內容 | 全為 + 行 |
| 3 | 字串 → 移除行 | 包含 - 行 |
| 4 | 字串 → 修改行 | 同時有 +/- 行 |
| （額外） | 大檔案模式（>2000 行） | fallback 至 `computeSimpleLineDiff` |

### matchExclude（3 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | 精確字串比對 | 相符/不相符 |
| 2 | 尾部萬用字元 `*` | `logs/*` 匹配 `logs/a.log` |
| 3 | `*` 只支援尾部 | `f*o` 不匹配 `foo` |

### statusToStatsKey（2 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | 三種狀態對應 | `new` → `added`、`changed` → `updated`、`deleted` → `deleted` |
| 2 | 未知狀態 | 回傳 `null` |

### parseSkillSource（5 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | skills.sh URL | 解析出 name 與 source |
| 2 | name + source 雙引數 | 直接組裝 |
| 3 | 缺少引數 | 丟 SyncError |
| 4 | 格式錯誤的 URL | 丟 SyncError |
| 5 | 單一非 URL 引數 | 丟 SyncError |

### parseArgs（8 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | 指令 + 旗標 | `to-repo --dry-run` 解析正確 |
| 2 | 別名解析 | `tr` 解析為 `to-repo` |
| 3 | `--verbose` 旗標 | 標記設置 |
| 4 | `--version` / `--help` | 標記設置 |
| 5 | extraArgs 收集 | `skills:add name source` 蒐集引數 |
| 6 | 未知指令保留 | 保留原值供上層判斷 |
| （額外） | process.argv 隔離 | 每個測試獨立，原始值於 finally 還原 |

### toRelativePath（2 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | 非絕對路徑 | 原樣回傳 |
| 2 | REPO_ROOT 內的路徑 | 縮短為相對路徑 |

### COMMANDS / 對應表完整性（2 個測試）

| 測試 | 場景 | 驗證 |
|------|------|------|
| 1 | VALID_COMMANDS 完整性 | 所有指令名列於 VALID_COMMANDS |
| 2 | COMMAND_ALIASES 一致性 | 每個別名對應存在且反向檢查 |

## 測試執行範例

```bash
# 執行全部
npm test

# 執行單一測試（按名稱模式）
node --test --test-name-pattern="computeLineDiff" test/sync.test.js

# 執行特定描述的測試
node --test --test-name-pattern="兩個相同字串" test/sync.test.js
```

## 測試的限制與補充

**自動化測試涵蓋：**
- ✓ 純函式邏輯（diff 演算法、參數解析、字串比對）
- ✓ 錯誤拋出（例外處理）
- ✓ 資料對應表（COMMANDS、COMMAND_ALIASES）

**人工 smoke test（非自動化）：**
- 檔案讀寫（`readJson`、`writeJsonSafe`）
- 目錄同步（`syncDir` 之類的 I/O 操作）
- 外部工具呼叫（git、diff）
- 互動確認（`askConfirm`）
- 終端色碼輸出（TTY 檢查、色彩顯示）

**原因：**
- I/O 測試需要真實檔案系統或複雜的 mock，與「零外部相依」原則衝突
- 自動化 mock 會增加相依，違反設計哲學

## 新增測試的指南

1. **如果新增純函式：**
   - 在 `test/sync.test.js` 中新增測試區段（註釋橫線分隔）
   - 導入函式（加到頂部 `require('../sync.js')` 的解構清單）
   - 寫至少 2-3 個測試案例覆蓋正常路徑與邊界情況
   - 錯誤情況用 `assert.throws()` 驗證

2. **如果新增有 I/O 的函式：**
   - 不加自動化測試
   - 在 CLAUDE.md 的「修改守則」記錄人工測試步驟

3. **如果改動現有純函式：**
   - 同步更新對應的測試
   - 執行 `npm test` 確保全部通過

---

*測試分析：2026-04-07*
