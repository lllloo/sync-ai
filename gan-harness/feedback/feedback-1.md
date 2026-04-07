# Evaluation Feedback -- Iteration 1

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 7 | 0.30 | 2.10 |
| 可靠性 | 6 | 0.25 | 1.50 |
| 使用者體驗 | 7 | 0.25 | 1.75 |
| 可維護性 | 6 | 0.20 | 1.20 |
| **總分** | | | **6.55** |

## Verdict: FAIL (threshold: 7.0)

## Checklist

### 程式碼品質
- [x] `SyncError` class 存在，含 `code` 與 `context` 屬性
- [x] `readJson()` 區分 ENOENT vs JSON parse error
- [ ] 沒有裸 `console.error() + process.exit(1)` 模式 -- `handleSignal()` (line 183) 直接呼叫 `process.exit(EXIT_ERROR)`，雖在 signal handler 中尚可接受，但未經統一的 throw 路徑
- [x] exit code 常數化（`EXIT_OK`、`EXIT_DIFF`、`EXIT_ERROR`）
- [x] `run()`/`git()` 函式檢查 stderr 並處理
- [ ] 所有函式有 JSDoc -- 大部分有，但 `cleanEmptyDirs`、`matchExclude` 的 JSDoc 缺少 `@returns`；`runHelp` 沒有 `@returns` 標註

### 可靠性
- [x] tempfile 在 process.on('exit') 清理
- [x] SIGINT handler 已註冊
- [ ] `printFileDiff` 不再硬性依賴外部 `diff` 指令 -- 有 JS fallback，但仍**優先嘗試外部 diff**（line 582），在 Windows 上每次都會 spawn 失敗再 fallback，造成不必要的效能開銷。應先偵測一次是否可用，或在 Windows 上直接跳過
- [x] JSON 寫入函式使用 write-to-tmp + rename 模式（`writeJsonSafe`）
- [ ] `diff` 指令：有差異 exit 1、無差異 exit 0、錯誤 exit 2 -- 正確實作
- [x] git 不可用時有 graceful fallback

### 使用者體驗
- [x] 統一 icon 映射表（`STATUS_ICONS`）
- [x] `help` 指令完整含所有子指令與旗標
- [x] `--version` 顯示版本號
- [x] `--dry-run` 在 to-repo/to-local 可用
- [x] 操作摘要統計行
- [x] 錯誤訊息含修復建議

### 可維護性
- [x] 程式碼有清楚的 section banner
- [x] 每個 section 有一行說明
- [ ] 沒有超過 60 行的單一函式 -- `runDiff` 121行、`runToRepo` 133行、`runToLocal` 159行、`runSkillsDiff` 68行、`runSkillsAdd` 67行
- [ ] `diffFile`/`diffDir` 的重複模式已抽取 -- `runToRepo` 中的 dry-run 路徑未使用 `diffFile`/`diffDir`，而是用 `copyFile(force=true, dryRun=true)` 和 `mirrorDir(force=true, dryRun=true)`，邏輯與 diff 不一致
- [x] CLI 引數解析集中在一處（`parseArgs`）
- [x] 函式命名一致（run*, diff*, copy*, mirror*）

## Critical Issues (must fix)

1. **`to-repo --dry-run` 結果與 `diff` 不一致**: `diff` 報告 "本機與 repo 完全一致"，但 `to-repo --dry-run` 報告 "28 個更新"。原因：`copyFile` 使用 `force=true` 時不做內容比對，dry-run 直接回傳 `true`；`mergeSettingsJson` 在 dry-run 也不檢查是否有實際差異。修復方式：在 dry-run 模式下，`copyFile` 應比對內容後再決定回傳值（即 `force` 不應影響 dry-run 的判斷邏輯）；`mergeSettingsJson` 在 dry-run 時應比對 stripped local 與 repo 的內容。

2. **大函式未拆分**: `runToLocal`（159行）、`runToRepo`（133行）、`runDiff`（121行）遠超 60 行上限。每個都有明確可拆的子區塊（檔案比對區、agents/commands 區、git 狀態區）。修復方式：將 `runToRepo` 拆為 `syncSingleFiles(direction, opts)` + `syncDirs(direction, opts)` + `showGitStatus()`。

## Major Issues (should fix)

1. **`printFileDiff` 在 Windows 上每次都嘗試 spawn `diff`**: 應快取 diff 可用性檢查結果，或在 Windows 平台直接使用 JS fallback。修復：在模組頂層偵測一次 `diffAvailable = spawnSync('diff', ['--version']).status === 0`，之後根據此值決定路徑。

2. **`computeSimpleLineDiff` 品質差**: 大檔案 fallback 用 Set 比對會丟失行的順序資訊和重複行，產生錯誤的 diff 結果。例如兩行相同內容只有一行會出現在 Set 中。修復：改用滑動窗口或 patience diff，或至少說明此為近似結果。

3. **`runSkillsAdd` 直接讀 `process.argv[3]`/`[4]`**: 繞過了 `parseArgs()` 的集中解析，違反 CLI 引數解析集中的設計原則。修復：在 `parseArgs` 中收集額外的 positional args 到 `opts.positionalArgs` 陣列。

## Minor Issues (nice to fix)

1. **`handleSignal` 中的 `process.exit`**: 可改為設定 flag 後 re-raise signal（`process.kill(process.pid, signal)`），讓 OS 設定正確的 exit code。

2. **`readPackageJson` 與 `readJson` 重複**: `readPackageJson` 沒用 `readJson`，自己做了一套 try-catch。應統一使用 `readJson` 並 catch `SyncError`。

3. **`to-repo` 的 git 檢查邏輯不對稱**: line 911-914，只有 `isGitAvailable()` 時才檢查 `isInsideGitRepo()`。但如果 git 不可用，應該也要提醒（不只是在最後 status 顯示時）。

4. **`VALID_COMMANDS` 與 `COMMAND_ALIASES` 可合併管理**: 目前分開定義，新增指令時容易漏改其中一個。

5. **`diff --verbose` 對 agents/commands 目錄的檔案不顯示 verbose 資訊**: `diffDir` 回傳的結果有加入 verbose 路徑，但排版上未個別顯示 verbose paths（只在 allDiffItems 迴圈中統一處理，邏輯正確但可確認）。

## What Improved Since Last Iteration
- N/A（這是第一次迭代，作為 baseline 評估）

## What Regressed Since Last Iteration
- N/A

## Specific Suggestions for Next Iteration

1. **修復 `to-repo --dry-run` 的誤報問題**: 在 `copyFile` 中，當 `dryRun=true` 時，無論 `force` 為何，都應先比對內容再回傳。在 `mergeSettingsJson` 中，dry-run 時應比對 stripped JSON 字串是否相同。這是最關鍵的功能性 bug。

2. **拆分三大指令函式**: 將 `runDiff`、`runToRepo`、`runToLocal` 中的重複邏輯抽取為：
   - `buildSyncItems(direction)` -- 建立同步項目清單（含 settings.json 特殊處理）
   - `applySyncItems(items, opts)` -- 執行同步（含 dry-run 判斷）
   - `showGitStatus()` -- 顯示 git 狀態
   這樣三個指令都可以共用同一套邏輯，每個函式可控制在 30-40 行。

3. **快取 diff 可用性**: 在模組頂層用 lazy getter 偵測一次外部 diff 是否可用：
   ```js
   let _diffAvailable;
   function isDiffAvailable() {
     if (_diffAvailable === undefined) {
       _diffAvailable = spawnSync('diff', ['--version']).status === 0;
     }
     return _diffAvailable;
   }
   ```

4. **將 `skills:add` 的引數解析納入 `parseArgs`**: 新增 `opts.extraArgs` 陣列，收集指令之後的 positional 引數。

## Smoke Test Results

| 測試 | 結果 | exit code |
|------|------|-----------|
| `node sync.js diff` | PASS | 0 |
| `node sync.js help` | PASS | 0 |
| `node sync.js --version` | PASS (1.0.0) | 0 |
| `node sync.js to-repo --dry-run` | FAIL (誤報 28 更新) | 0 |
| `node sync.js to-local --dry-run` | PASS | 0 |
| `node sync.js invalid-cmd` | PASS (友善錯誤) | 2 |
| `node sync.js` (no args) | PASS (顯示 help) | 2 |
| `node sync.js d` (alias) | PASS | 0 |
| `node sync.js diff --verbose` | PASS | 0 |
| `node sync.js skills:add` (no args) | PASS (友善錯誤) | 2 |
