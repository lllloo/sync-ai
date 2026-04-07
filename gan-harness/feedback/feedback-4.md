# Evaluation Feedback -- Iteration 4

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 9 | 0.30 | 2.70 |
| 可靠性 | 9 | 0.25 | 2.25 |
| 使用者體驗 | 9 | 0.25 | 2.25 |
| 可維護性 | 9 | 0.20 | 1.80 |
| **總分** | | | **9.00** |

## Verdict: PASS (threshold: 7.0) -- 等級 S

本次評估是 iter3 (8.30) 的修復輪。所有前次提出的 2 個 Major + 5 個 Minor issues 已全數確認修復，函式行數稽核最大值從 70 降至 54，無任何函式超過 60 行上限。四個維度皆達到 9 分，屬於「senior 工程師會產出的水準」。三個維度能進一步提升至 10 的關鍵障礙（如無外部測試、README/PR flow 等）已超出本專案 scope，因此 9.00 是合理天花板。

## Checklist

### 程式碼品質（9/10）
- [x] `SyncError` class 含 `code` + `context`（L105-117）
- [x] `readJson()` 區分 ENOENT / EACCES / JSON_PARSE（L280-302）
- [x] 無裸 `console.error + process.exit` -- 所有路徑經 `formatError` + 檔尾統一 `.catch`
- [x] exit code 常數化（`EXIT_OK`/`EXIT_DIFF`/`EXIT_ERROR` L21-23）
- [x] `git()` 處理 stderr 與 `result.error`（L487-498）
- [x] 52 個 function 全部有 JSDoc `@param`/`@returns`
- [x] 常數集中：`STATUS_ICONS`、`COMMANDS`、`DEVICE_FIELDS`、`LCS_MAX_LINES`、`CMD_COL_WIDTH`、`ALIAS_COL_WIDTH`、`ERR` 全部在 Section: Constants / Errors 內

### 可靠性（9/10）
- [x] tempfile 註冊於 `process.on('exit', cleanupTempFiles)`（L188）
- [x] SIGINT/SIGTERM handler 採 re-raise（L204-215），中斷時顯示警告
- [x] `printFileDiff` 快取 `isDiffAvailable` + `printJsDiff` JS fallback
- [x] `writeJsonSafe` 使用 write-to-tmp + rename + EXDEV fallback（L310-330）
- [x] `diff` exit code 語義正確：無差異=0、有差異=1、錯誤=2（實測通過）
- [x] `showGitStatus` 雙層 graceful fallback（`isGitAvailable` + `isInsideGitRepo`）

### 使用者體驗（9/10）
- [x] 統一 `STATUS_ICONS` 映射表
- [x] `help` 完整含指令、alias、旗標、範例四段
- [x] `--version` 輸出 `1.0.0`
- [x] `--dry-run` 於 to-repo / to-local 皆可用，含預覽摘要
- [x] `printSummary` 統計行（added / updated / deleted）
- [x] 錯誤訊息含 `hints` 表提示修復方向
- [x] `--verbose` 顯示完整路徑與 bytes

### 可維護性（9/10）
- [x] 17 個 section banner，每段附職責說明
- [x] 所有函式 <= 60 行（最大 `buildSyncItems` 54 行，為宣告式資料結構）
- [x] `diffSyncItems` 抽 `diffSettingsItem`（iter3 Major #2 修復）
- [x] `runToLocal` 抽 `printToLocalPreview` + `confirmAndApply`（iter3 Major #1 修復）
- [x] `buildFullDiffList` 改純函式（iter3 Minor #3 修復）
- [x] `statusToStatsKey` helper 消除對應重複（iter3 Minor #2 修復）
- [x] CLI 解析集中於 `parseArgs`
- [x] 命名一致：`run*`/`diff*`/`print*`/`build*`/`apply*`/`copy*`/`mirror*`/`show*`

## Critical Issues (must fix)

無。

## Major Issues (should fix)

無。本輪前次兩個 Major issues 已全數修復：

1. **`runToLocal` 70 -> 29 行**：成功抽取 `printToLocalPreview(diffResults)`（14 行，L1282-1295）與 `confirmAndApply(items)`（28 行，L1302-1329）。`runToLocal` 主函式現在職責單一：標頭輸出、取得 diff、dry-run 分支、委派給 `confirmAndApply`。

2. **`diffSyncItems` 62 -> 38 行**：成功抽取 `diffSettingsItem(item)`（26 行，L955-980），處理 settings.json 的 stripped 比對、tmpfile 註冊、status 判斷。主函式 `diffSyncItems` 現在是清楚的三分支 dispatcher（settings / file / dir）。

## Minor Issues (nice to fix)

以下皆為錦上添花等級，不影響評分：

1. **`buildSyncItems` 54 行稍長但合理**：L882-935。本質上是 5 個 SyncItem 字面量陣列的宣告式結構（每個 item 有 7 個欄位 + 註解），難以進一步拆分而不損失可讀性。若真要精簡，可考慮定義 helper `makeItem(label, srcBase, destBase, type)` 來消除 `verboseSrc`/`verboseDest` 欄位的重複（目前 `src === verboseSrc`、`dest === verboseDest` 幾乎都一樣）。但這會增加抽象成本。建議維持現狀。

2. **`COMMANDS` 物件可增加 `handler` 欄位以消除 `main()` 的 switch**：L1672-1688 的 switch 與 L62-69 的 `COMMANDS` 宣告有輕微耦合。若 `COMMANDS` 直接帶上 `handler: runDiff` 等函式參考，`main()` 可簡化為 `await COMMANDS[cmd].handler(opts)`。這會是 data-driven dispatch 的較優雅版本，但需處理 async / sync 混合與 `help` 的特殊邏輯，refactor 成本不低。

3. **`SyncError` 的 `context.path` 只被 `formatError` 印出**：其他 context 欄位（如 `parseError`、`url`）並未被 `formatError` 印出。可考慮在 `formatError` 中把所有 `context` 欄位以 dim 輔助行顯示，讓使用者看到完整 debug 資訊。

4. **`printToLocalPreview` 內兩次 `for (const d of diffResults)`**：L1283-1287 與 L1290-1293 是兩個連續迴圈（一個印、一個統計）。可合併為單一迴圈同時完成，微量效能優化，但目前可讀性較高。不必修。

5. **`logVerbosePaths` 使用固定 6 空格縮排（L1122-1123）**：魔術字串 `'      src: '`/`'      dest:'`。雖然只出現這一處，但與 Section: Constants 的哲學略違。可抽 `VERBOSE_INDENT = '      '`。純美感層級。

## What Improved Since Last Iteration

1. **`runToLocal` 從 70 行降至 29 行** -- 超過預期的「~35 行」目標。抽取的 `printToLocalPreview` + `confirmAndApply` 命名精準、職責單一。修復 iter3 Major #1。

2. **`diffSyncItems` 從 62 行降至 38 行** -- 符合「~40 行」目標。`diffSettingsItem` 命名符合命名慣例（`diff*`），並在 JSDoc 明確註明「比對方向固定」的關鍵 invariant。修復 iter3 Major #2。

3. **`runHelp` 改用 `String#padEnd` + 常數**：L1520-1521 使用 `cmd.padEnd(CMD_COL_WIDTH)` / `aliasRaw.padEnd(ALIAS_COL_WIDTH)`，完全消除 `Math.max(1, 14 - cmd.length)` 這類脆弱計算。常數 `CMD_COL_WIDTH = 14`、`ALIAS_COL_WIDTH = 8` 加到 L45-46。修復 iter3 Minor #1。

4. **`statusToStatsKey(status)` helper 出現於 L942-947**：`printToLocalPreview` L1291 改用此 helper，消除 status → stats key 對應的字串魔術值。修復 iter3 Minor #2。

5. **`buildFullDiffList` 改純函式**：L1135 `const result = [...diffItems]` 顯式複製，L1162 `return result`，不再 mutate 傳入陣列。JSDoc L1129 `純函式：不修改傳入的 diffItems 陣列` 清楚記載此契約。修復 iter3 Minor #3。

6. **`LCS_MAX_LINES = 2000` 抽常數**：L38-42 含三行註解說明「O(mn) 記憶體爆炸」的理由；L582 使用 `if (m + n > LCS_MAX_LINES)`。消除魔術數字。修復 iter3 Minor #4。

7. **`printVersion()` 函式對稱**：L1501-1504 新增 `printVersion()`，main() L1644-1647 呼叫 `printVersion()`，風格與 `runHelp()` 對稱。修復 iter3 Minor #5。

8. **函式行數稽核首次全數通過 60 行上限**：最大函式為 `buildSyncItems`（54 行，宣告式），最大邏輯函式為 `main`（52 行）、`runSkillsDiff`（51 行）。

## What Regressed Since Last Iteration

無任何退化。所有冒煙測試通過。`runToLocal`（70 → 29）與 `diffSyncItems`（62 → 38）的拆分乾淨，未引入任何行為變更。

## Specific Suggestions for Next Iteration

若要追求 9.5+ 分，建議方向（皆非必要）：

1. **加入 `node:test` 單元測試**：針對 `computeLineDiff`、`matchExclude`、`statusToStatsKey`、`parseSkillSource`、`parseArgs` 五個純函式寫 unit test。這會讓 regression risk 顯著下降，並提升 rubric「可靠性」維度至 10。

2. **將 `COMMANDS` 改為 data-driven dispatch**：把 `handler` 放進 `COMMANDS` 物件，`main()` 的 switch 消失。但需要處理 async / help / version 的特殊邏輯。

3. **`formatError` 顯示全部 `context` 欄位**：目前只印 `context.path`，其他欄位（`parseError`、`url`、`signal`）對 debug 有幫助。

4. **CLAUDE.md 差異 diff 的 header 路徑可能暴露使用者路徑**：`diff -u` 的 header 顯示 `C:\\Users\\Roy\\...`，雖然這是 local 環境預期行為，但若將輸出貼到公開場合可能洩漏使用者名稱。可考慮 `printFileDiff` 內用 relative 路徑 override header。

5. **JSDoc 的 `ParsedArgs` typedef 可提升為 top-level**：目前位於 L1544-1551，可移到 Section: Constants 旁與 `SyncItem` typedef 集中管理 type definitions。

## Smoke Test Results

| 測試 | 結果 | exit code | 備註 |
|------|------|-----------|------|
| `node sync.js --version` | PASS（`1.0.0`） | 0 | |
| `node sync.js help` | PASS | 0 | 指令、alias、旗標、範例四段完整且對齊 |
| `node sync.js diff` | PASS（2 項差異 + 詳細 diff） | 1 | CLAUDE.md + settings.json 有差異，statusline 一致 |
| `node sync.js to-repo --dry-run` | PASS（摘要：2 個更新） | 0 | 未實際寫入檔案 |
| `node sync.js to-local --dry-run` | PASS（摘要：2 個更新） | 0 | 含 `printSummary` 統計行 |
| `node sync.js invalid` | PASS | 2 | `[!] 未知指令：invalid` + 修復提示 |
| `node sync.js`（no args） | PASS | 2 | 顯示 help，exit=2 符合語義 |
| `node sync.js d`（alias） | PASS | 1 | 與 `diff` 輸出一致 |
| `node sync.js diff --verbose` | PASS | 1 | 每項含 `src:`/`dest:` 完整路徑與 bytes |
| `node sync.js skills:add`（no args） | PASS | 2 | 含兩種用法提示 + hint |

## 函式行數稽核（iter 4）

所有函式皆 <= 60 行。以下為前 15 名：

| 函式 | 行數 | 狀態 |
|------|------|------|
| `buildSyncItems` | 54 | OK（宣告式，難以進一步拆） |
| `main` | 52 | OK |
| `runSkillsDiff` | 51 | OK |
| `printJsDiff` | 47 | OK |
| `runToRepo` | 43 | OK |
| `mirrorDir` | 41 | OK |
| `computeLineDiff` | 41 | OK |
| `parseArgs` | 41 | OK |
| `mergeSettingsJson` | 40 | OK |
| `diffSyncItems` | 38 | **iter3 62→38 修復** |
| `runDiff` | 38 | OK |
| `showGitStatus` | 36 | OK |
| `applySyncItems` | 32 | OK |
| `buildFullDiffList` | 31 | OK（純函式） |
| `runToLocal` | 29 | **iter3 70→29 修復** |

總函式數：52。最大邏輯函式 52 行。上限 60 行，達標率 100%。

## 評分理由（為何跨越 9.0 門檻）

iter3 為 8.30，對應「優秀 A 等級」。iter4 的具體改善：

- **程式碼品質 9 → 9**（維持）：本輪無新增程式碼品質問題；所有 iter3 的 checkbox 仍然通過。無 10 分的理由：缺少 unit test 與 CI。
- **可靠性 8 → 9**（+1）：iter3 的 `runToLocal` 70 行函式本身雖不影響可靠性，但函式愈大 regression risk 愈高。本輪拆分後每個子函式職責清楚、`isWriting` flag 的 try-finally 配置更緊湊（僅在 `confirmAndApply` 中實際寫入路徑），降低中斷時的 race 風險。無 10 分的理由：SIGINT 仍只在 `isWriting = true` 時顯示警告，若中斷發生在 `applySyncItems` 迴圈中途，partial state 仍會存在（無法 rollback）。
- **使用者體驗 8 → 9**（+1）：iter3 的 help 欄寬對齊脆弱已修復為 `padEnd`；`--version`/`--help` 路徑對稱（均為 `print*`/`run*` 小函式）。輸出格式視覺一致，冒煙測試 10 項全數通過且輸出美觀。無 10 分的理由：`printFileDiff` 的外部 diff header 路徑暴露使用者名稱；`confirmAndApply` 使用 `y/N` 問答但無法用 `--yes` 自動化。
- **可維護性 8 → 9**（+1）：函式行數稽核首次 100% 達標；前次 5 個 minor issues 全數修復；新增的 helper 命名與既有命名慣例一致；section banner 結構完整。無 10 分的理由：`COMMANDS` 尚未做 data-driven dispatch；`buildSyncItems` 宣告式結構仍有重複欄位（`verboseSrc` / `src`）。

總分 **9.00 = 2.70 + 2.25 + 2.25 + 1.80**，對應 rubric「S 等級：卓越，超出預期」。建議 Generator 停在此版本，進一步優化的邊際收益已遞減；後續若要突破 9.5，需要引入 unit test 與 CI，這已超出單檔 CLI 的合理 scope。
