# Evaluation Feedback -- Iteration 2

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 8 | 0.30 | 2.40 |
| 可靠性 | 8 | 0.25 | 2.00 |
| 使用者體驗 | 7 | 0.25 | 1.75 |
| 可維護性 | 7 | 0.20 | 1.40 |
| **總分** | | | **7.55** |

## Verdict: PASS (threshold: 7.0)

## Checklist

### 程式碼品質
- [x] `SyncError` class 存在，含 `code` 與 `context` 屬性
- [x] `readJson()` 區分 ENOENT vs JSON parse error（含 EACCES/EPERM 處理）
- [x] 沒有裸 `console.error() + process.exit(1)` 模式 -- 所有 `process.exit` 集中在 `main()` 與 `.catch()` handler；`handleSignal` 改為 re-raise signal
- [x] exit code 常數化（`EXIT_OK`、`EXIT_DIFF`、`EXIT_ERROR`）
- [x] `git()` 函式檢查 stderr 並處理（含 `result.error` 處理）
- [x] 所有函式有 JSDoc -- 44 個函式均有 `@returns` 與 `@param` 標註

### 可靠性
- [x] tempfile 在 process.on('exit') 清理
- [x] SIGINT handler 已註冊，改用 re-raise signal 方式退出
- [x] `printFileDiff` 使用 `isDiffAvailable()` 快取偵測結果，不再每次嘗試 spawn
- [x] JSON 寫入函式使用 write-to-tmp + rename 模式（`writeJsonSafe`），含 EXDEV fallback
- [x] `diff` 指令：有差異 exit 1、無差異 exit 0（已驗證）
- [x] git 不可用時有 graceful fallback

### 使用者體驗
- [x] 統一 icon 映射表（`STATUS_ICONS`）
- [x] `help` 指令完整含所有子指令與旗標
- [x] `--version` 顯示版本號（1.0.0）
- [x] `--dry-run` 在 to-repo/to-local 可用，且結果與 `diff` 一致
- [ ] 操作摘要統計行 -- `to-local --dry-run` 缺少摘要統計行（見 Major Issues #1）
- [x] 錯誤訊息含修復建議

### 可維護性
- [x] 程式碼有清楚的 section banner（Constants, ANSI Colors, Errors, Tempfile Registry, Signal Handling, External Tool Detection, FS Utilities, Git Utilities, Diff Engine, Display Utilities, Settings Handler, Operation Log, Sync Core, Commands, CLI Parser, Interactive, Main）
- [x] 每個 section 有一行說明其職責
- [ ] 沒有超過 60 行的單一函式 -- `runDiff` 85 行、`runSkillsAdd` 63 行仍超標
- [x] CLI 引數解析集中在一處（`parseArgs`），含 `extraArgs`
- [x] 函式命名一致（run*, diff*, copy*, mirror*, build*, apply*, show*）
- [x] `VALID_COMMANDS` 與 `COMMAND_ALIASES` 統一由 `COMMANDS` 物件自動產生

## Critical Issues (must fix)

無。

## Major Issues (should fix)

1. **`runDiff` 仍有 85 行，超過 60 行上限**: 此函式包含三個可拆分的邏輯區塊：(a) 呼叫 diffSyncItems 並補全無差異項目（L1086-L1127, 約 42 行）、(b) 輸出狀態行（L1128-L1145, 約 18 行）、(c) 輸出詳細 diff（L1152-L1169, 約 18 行）。修復方式：將 (a) 抽取為 `buildFullDiffList(items, allDiffItems)` 函式，將 (c) 抽取為 `printDetailedDiff(allDiffItems)` 函式。

2. **`runSkillsAdd` 有 63 行，略超 60 行上限**: 可將 URL/手動引數的解析邏輯（L1354-L1385, 約 32 行）抽取為 `parseSkillSource(opts)` 函式，回傳 `{name, source}`。

3. **`to-local --dry-run` 缺少摘要統計行**: `to-repo --dry-run` 有呼叫 `printSummary(stats)`，但 `to-local --dry-run` 在 L1249 直接 return，跳過了摘要。修復方式：在 L1249 之前加入 `printSummary(preview.stats);`，讓兩個指令的 dry-run 輸出格式一致。

4. **`computeSimpleLineDiff` 仍使用 Set 比對**: JSDoc 已加註「近似值」說明（這是改善），但邏輯本身未改進。對於有重複行的大檔案，結果可能錯誤。建議至少在函式內加入 `console.log(col.dim('  (大檔案，顯示近似差異)'));` 提示使用者。

## Minor Issues (nice to fix)

1. **`to-local` 的預覽呼叫 `applySyncItems` 兩次**: 在非 dry-run 模式下，`runToLocal` 先用 `applySyncItems(items, 'to-local', { dryRun: true })` 預覽，使用者確認後再用 `applySyncItems(items, 'to-local', { dryRun: false })` 實際套用。這表示每個檔案會被讀取並比對兩次。效能影響不大（同步檔案很少），但架構上可以改為先取得 diffSyncItems 結果，再根據結果套用。

2. **`buildSyncItems` 的 settings.json 方向處理**: settings.json 的 `src`/`dest` 永遠是 `localPath`/`repoPath`（L882-L883），沒有根據 direction 調換。這是因為 `mergeSettingsJson` 內部自己處理方向。但這讓 `SyncItem` 的 `src`/`dest` 語義不一致（其他項目會根據 direction 調換）。建議在 JSDoc 或註解中明確說明此例外。

3. **`diffSyncItems` 中 settings.json 的 diff 方向寫死**: L929 始終用 `localPath` 和 `repoPath`，即使 direction 是 `to-local`。因為目前 `diffSyncItems` 只在 `runDiff` 中被呼叫（方向固定為 `to-repo`），所以不會出錯，但如果未來其他指令呼叫此函式可能產生 bug。建議加註 `// 注意：settings.json 的比對方向固定，不受 direction 參數影響`。

4. **`runDiff` 中的排序邏輯用字串檢查判斷類型**: L1122-1123 使用 `a.label.includes('agents/')` 判斷是否為目錄項目，這很脆弱。如果未來新增名稱含 `agents` 的檔案會誤判。建議在 diff 結果中保留 `type` 欄位供排序使用。

5. **`main()` 中 `--version` 和 `--help` 直接 `process.exit`**: 雖然在 main 中集中處理，但 `--version`（L1554）和 `--help`（L1560）早期退出時跳過了 switch 邏輯。嚴格來說不算 bug，但可以改為直接 return exit code，讓 `main()` 尾部統一 exit。

## What Improved Since Last Iteration

1. **`to-repo --dry-run` 誤報已修復**: 從報告 28 個虛假更新降為正確報告 1 個（settings.json 確實有差異）。`copyFile` 和 `mirrorDir` 在 dry-run 模式下現在正確比對內容。這是最關鍵的功能性 bug 修復。

2. **大函式顯著拆分**: `runToRepo` 從 133 行降至 43 行、`runToLocal` 從 159 行降至 56 行。新抽取的 `buildSyncItems`、`diffSyncItems`、`applySyncItems`、`showGitStatus` 讓三個指令共用同一套邏輯，消除了大量重複。

3. **Windows diff 效能問題已修復**: `isDiffAvailable()` lazy getter 快取偵測結果，不再每次都嘗試 spawn 失敗。

4. **`skills:add` 引數解析已集中**: `parseArgs` 新增 `extraArgs` 陣列，`runSkillsAdd` 不再直接讀取 `process.argv`。

5. **`handleSignal` 改用 re-raise signal**: 不再直接呼叫 `process.exit(EXIT_ERROR)`，改為移除 handler 後 re-raise signal，讓 OS 設定正確的 exit code。

6. **`readPackageJson` 統一使用 `readJson`**: 不再有重複的 try-catch 邏輯。

7. **`COMMANDS` 統一管理**: `VALID_COMMANDS` 和 `COMMAND_ALIASES` 由 `COMMANDS` 物件自動產生，新增指令時不會漏改。

8. **JSDoc 覆蓋率 100%**: 44 個函式全部有 `@returns` 標註。

## What Regressed Since Last Iteration

- 無明顯退化。所有先前通過的冒煙測試項目仍然通過。

## Specific Suggestions for Next Iteration

1. **拆分 `runDiff`（85 行）**: 抽取 `buildFullDiffList(items)` 補全無差異項目並排序，抽取 `printDetailedDiff(diffItems)` 處理詳細差異輸出。各約 30-40 行。

2. **拆分 `runSkillsAdd`（63 行）**: 抽取 `parseSkillSource(opts)` 回傳 `{name, source}`，約 30 行。

3. **補上 `to-local --dry-run` 的摘要統計行**: 在 `runToLocal` 的 dry-run 早期 return 前加入 `printSummary(preview.stats)`。一行修改。

4. **加強 `computeSimpleLineDiff` 的使用者提示**: 在大檔案 fallback 時加入 dim 色的近似結果提示。

## Smoke Test Results

| 測試 | 結果 | exit code |
|------|------|-----------|
| `node sync.js diff` | PASS（正確顯示 1 項差異） | 1 |
| `node sync.js help` | PASS | 0 |
| `node sync.js --version` | PASS (1.0.0) | 0 |
| `node sync.js to-repo --dry-run` | PASS（正確報告 1 個更新） | 0 |
| `node sync.js to-local --dry-run` | PASS（但缺摘要統計行） | 0 |
| `node sync.js invalid` | PASS（友善錯誤+提示） | 2 |
| `node sync.js`（no args） | PASS（顯示 help） | 2 |
| `node sync.js d`（alias） | PASS | 1 |
| `node sync.js diff --verbose` | PASS（顯示完整路徑與大小） | 1 |
| `node sync.js skills:add`（no args） | PASS（友善錯誤） | 2 |
