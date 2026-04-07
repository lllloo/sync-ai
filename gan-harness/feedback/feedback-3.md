# Evaluation Feedback -- Iteration 3

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 9 | 0.30 | 2.70 |
| 可靠性 | 8 | 0.25 | 2.00 |
| 使用者體驗 | 8 | 0.25 | 2.00 |
| 可維護性 | 8 | 0.20 | 1.60 |
| **總分** | | | **8.30** |

## Verdict: PASS (threshold: 7.0) -- 等級 A

## Checklist

### 程式碼品質
- [x] `SyncError` class 存在，含 `code` 與 `context` 屬性
- [x] `readJson()` 區分 ENOENT vs JSON parse error（含 EACCES/EPERM）
- [x] 沒有裸 `console.error() + process.exit(1)` 模式 -- `process.exit` 集中於檔尾 `.then()/.catch()`
- [x] exit code 常數化（`EXIT_OK`、`EXIT_DIFF`、`EXIT_ERROR`）
- [x] `git()` 函式檢查 stderr 並處理（含 `result.error` fallback）
- [x] 所有函式有 JSDoc -- 50 餘個函式皆含 `@returns`/`@param` 標註

### 可靠性
- [x] tempfile 在 `process.on('exit')` 註冊清理
- [x] SIGINT/SIGTERM handler 已註冊，採 re-raise signal 退出
- [x] `printFileDiff` 使用 `isDiffAvailable()` 快取，並有 `printJsDiff` JS fallback
- [x] JSON 寫入使用 `writeJsonSafe`（write-to-tmp + rename，含 EXDEV fallback）
- [x] `diff` 指令 exit code 正確（無差異 0、有差異 1、錯誤 2）
- [x] git 不可用時 `showGitStatus` graceful fallback

### 使用者體驗
- [x] 統一 icon 映射表（`STATUS_ICONS`）
- [x] `help` 指令完整含所有子指令與旗標
- [x] `--version` 顯示版本號（1.0.0）
- [x] `--dry-run` 在 to-repo/to-local 可用，皆不寫入檔案
- [x] **操作摘要統計行** -- `to-local --dry-run` 已新增 `printSummary(previewStats)`（修復 iter2 #3）
- [x] 錯誤訊息含修復建議（`hints` 表 + `formatError`）

### 可維護性
- [x] 程式碼有清楚 section banner（17 個 section）
- [x] 每個 section 有一行說明其職責
- [~] 沒有超過 60 行的單一函式 -- `runDiff`/`runSkillsAdd` 已修復；但 `runToLocal` 為 70 行、`diffSyncItems` 為 62 行（見 Major Issues）
- [x] `diffFile`/`diffDir` 在 `runDiff` 與 `runToLocal` 已透過 `diffSyncItems` 共用
- [x] CLI 引數解析集中在 `parseArgs`
- [x] 函式命名一致（run*, diff*, copy*, mirror*, build*, apply*, show*, parse*, print*）

## Critical Issues (must fix)

無。

## Major Issues (should fix)

1. **`runToLocal` 為 70 行，仍超過 60 行上限**: L1247-L1316。雖然這次重構已將「預覽」與「套用」邏輯改用 `diffSyncItems`，但函式內仍包含五個職責：(a) 標頭輸出、(b) 取得 diff 結果並早期 return、(c) 顯示預覽列表、(d) 計算 previewStats、(e) askConfirm + applySyncItems。建議將 (c)+(d)（L1268-L1280, 約 13 行）抽取為 `printToLocalPreview(diffResults)` 函式，回傳 `previewStats`；並把 (e)（L1289-L1312）抽取為 `confirmAndApply(items, previewStats)`。完成後 `runToLocal` 應降至 ~35 行。

2. **`diffSyncItems` 為 62 行，略微超過上限**: L933-L994。可將 settings 分支（L937-L962, 約 26 行）抽取為 `diffSettingsItem(item)` 內部函式，回傳一個 result entry。完成後主函式應降至 ~40 行。

## Minor Issues (nice to fix)

1. **`runHelp` 中的對齊計算脆弱**: L1463-L1464 用 `Math.max(1, 14 - cmd.length)` 做欄寬計算，魔術數字 14、8 沒有抽常數。若未來新增更長指令名稱會破壞對齊。建議抽 `CMD_COL_WIDTH`/`ALIAS_COL_WIDTH` 常數，或改用 `String#padEnd`。

2. **`previewStats` 計算重複了 diff status 的對應**: L1275-L1280 手動將 status (`new`/`changed`/`deleted`) 對應到 stats key (`added`/`updated`/`deleted`)，這個對應邏輯在 `applySyncItems` 也有一份（透過 `existed`/`copyFile`）。建議抽出共用 helper `statusToStatsKey(status)`，或在 `diffSyncItems` 直接回傳 stats。

3. **`buildFullDiffList` 修改傳入的 `diffItems` 陣列（mutating）**: L1101-L1128 既 push 又回傳同一個陣列。雖然行為正確，但 mutating 與回傳值並存容易造成混淆。建議改為純函式：先複製陣列再 push，呼叫端使用 `const all = buildFullDiffList(items, [...diffItems])`。

4. **`computeLineDiff` 的 LCS DP 對 m+n=2000 邊界設定缺少測試**: 邊界值魔術數字 `2000` 直接寫死於 L572，建議抽常數 `LCS_MAX_LINES = 2000` 並加註說明（"超過此行數改用近似 diff 以避免 O(mn) 記憶體爆炸"）。

5. **`runHelp` 與 main() 對 `--help` 處理路徑不對稱**: `--version` 在 main 中直接讀 pkg 並 return；`--help` 透過 `runHelp()`（也讀 pkg）。雖然功能正確，但兩者一個 inline、一個函式呼叫，風格不一致。建議統一改為兩個小函式 `printVersion()`/`runHelp()`。

## What Improved Since Last Iteration

1. **`runDiff` 從 85 行降至 38 行**：成功抽取 `buildFullDiffList`（28 行）與 `printDetailedDiff`（13 行）。職責清晰、可讀性大幅提升。修復 iter2 Major #1。

2. **`runSkillsAdd` 從 63 行降至 28 行**：抽取 `parseSkillSource`（29 行），URL 與手動引數的解析邏輯集中。修復 iter2 Major #2。

3. **`to-local --dry-run` 補上摘要統計行**：L1282-L1285 在 dry-run 早期 return 前呼叫 `printSummary(previewStats)`，與 `to-repo --dry-run` 輸出格式一致。實測輸出：`摘要：2 個更新`。修復 iter2 Major #3。

4. **`computeSimpleLineDiff` 已標記 `isApproximate`**：L629 在 result[0] 設 flag，`printJsDiff` L686-L688 顯示 dim 色提示「（大檔案模式：以下為近似差異，重複行的位置可能不精確）」。修復 iter2 Major #4。

5. **`runToLocal` 改用 `diffSyncItems` 預覽**：不再呼叫 `applySyncItems(..., dryRun: true)` 兩次。`applySyncItems` 在實際套用時只呼叫一次。修復 iter2 Minor #1。

6. **`buildSyncItems` settings.json 方向處理已加註解**：L889-L891 三行說明 settings.json 不隨 direction 調換的原因。修復 iter2 Minor #2。

7. **`diffSyncItems` settings.json diff 方向加註**：L938 註解明確說「比對方向固定，不受 direction 參數影響」。修復 iter2 Minor #3。

8. **排序邏輯改用 `itemType` 欄位**：L1121-L1123 用 `a.itemType === 'dir'` 取代脆弱的字串檢查 `label.includes('agents/')`。新增 `itemType` 欄位於 diff 結果物件。修復 iter2 Minor #4。

9. **`main()` 中 `--version`/`--help` 改為 `return EXIT_OK`**：L1590、L1596 不再呼叫 `process.exit`，由檔尾 `.then(exitCode => process.exit(exitCode))` 統一處理。修復 iter2 Minor #5。

## What Regressed Since Last Iteration

無明顯退化。所有先前通過的冒煙測試項目仍然通過。`runToLocal` 因新增 `previewStats` 計算與顯示邏輯（為了修復 iter2 Major #3）而從 56 行成長至 70 行；雖然這在功能上是必要的，但也意味著該函式現在超過 60 行上限（見 Major #1）。

## Specific Suggestions for Next Iteration

1. **拆分 `runToLocal`（70 行 → ~35 行）**：抽取 `printToLocalPreview(diffResults)`（回傳 `previewStats`）與 `confirmAndApply(items, opts)`。

2. **拆分 `diffSyncItems`（62 行 → ~40 行）**：抽取 `diffSettingsItem(item)` 處理 settings 分支。

3. **共用 `statusToStatsKey` helper**：消除 status→stats 的對應重複（applySyncItems 與 runToLocal 各有一份）。

4. **抽常數 `LCS_MAX_LINES = 2000` 與 `CMD_COL_WIDTH`**：消除 magic number。

5. **`buildFullDiffList` 改為純函式**：避免 mutating 傳入陣列。

## Smoke Test Results

| 測試 | 結果 | exit code | 備註 |
|------|------|-----------|------|
| `node sync.js diff` | PASS（顯示 2 項差異 + 詳細 diff） | 1 | CLAUDE.md、settings.json 有差異 |
| `node sync.js help` | PASS | 0 | 顯示完整指令、旗標、範例 |
| `node sync.js --version` | PASS（輸出 `1.0.0`） | 0 | |
| `node sync.js to-repo --dry-run` | PASS（顯示 2 個更新 + 摘要） | 0 | |
| `node sync.js to-local --dry-run` | PASS（**已含摘要統計行**） | 0 | 修復 iter2 Major #3 |
| `node sync.js invalid` | PASS（友善錯誤 + 提示） | 2 | |
| `node sync.js`（no args） | PASS（顯示 help） | 2 | |
| `node sync.js d`（alias） | PASS（與 diff 一致） | 1 | |
| `node sync.js diff --verbose` | PASS（顯示完整路徑與檔案大小） | 1 | |
| `node sync.js skills:add`（no args） | PASS（友善錯誤 + 用法提示 + hint） | 2 | |

## 函式行數稽核

| 函式 | 行數 | 狀態 |
|------|------|------|
| `runDiff` | 38 | OK |
| `buildFullDiffList` | 28 | OK |
| `printDetailedDiff` | 13 | OK |
| `runToRepo` | 43 | OK |
| **`runToLocal`** | **70** | **超標** |
| **`diffSyncItems`** | **62** | **略微超標** |
| `runSkillsDiff` | 51 | OK |
| `runSkillsAdd` | 28 | OK |
| `parseSkillSource` | 29 | OK |
| `runHelp` | 27 | OK |
| `applySyncItems` | 32 | OK |
| `mergeSettingsJson` | 40 | OK |
| `printJsDiff` | 47 | OK |
| `computeLineDiff` | 41 | OK |
| `mirrorDir` | 41 | OK |
| `showGitStatus` | 36 | OK |
| `parseArgs` | 41 | OK |
| `main` | 53 | OK |

仍有 2 個函式超過 60 行門檻。其餘約 50 個函式皆符合單一職責原則。
