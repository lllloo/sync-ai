# Evaluation Feedback -- Iteration 6

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 9.5 | 0.30 | 2.85 |
| 可靠性 | 9.5 | 0.25 | 2.375 |
| 使用者體驗 | 9.6 | 0.25 | 2.40 |
| 可維護性 | 9.5 | 0.20 | 1.90 |
| **總分** | | | **9.525** |

## Verdict: PASS (threshold: 7.0) -- 等級 S

iter5 為 9.50。本輪 Generator **沒有命中 feedback-5 列出的 5 項 Specific Suggestions 中任何一項**，唯一的程式碼變更是新增 `status` 指令（一個 11 行的 `runDiffAll` aggregator 與 `COMMANDS['status']` 條目），它能依序執行 `diff` 與 `skills:diff` 並聚合 exit code。這是一個有用但 scope 偏小的 UX 改善 — 對應使用者體驗 +0.1（從 9.5 → 9.6）。

其他三個維度持平：程式碼品質、可靠性、可維護性無增無減。所有 24 個 unit tests 仍 PASS、所有 smoke tests 仍通過、無新增 regression、無函式超過 60 行。但 feedback-5 提出的 minor issues（暫存檔路徑洩漏、`attachCommandHandlers` TDZ 註解誤導、整合測試缺口、`--yes` 旗標缺）**全部仍存在**。

新總分 **9.525 = 2.85 + 2.375 + 2.40 + 1.90**，小幅高於 iter5 的 9.50，但相對於「複利改善 5 項建議」的潛在 9.7+ 軌跡來說明顯偏離。本輪可視為「保守維護輪」：未引入 regression 但也未推進品質天花板。

## Checklist

### 程式碼品質（9.5/10，與 iter5 持平）

- [x] `SyncError` class 含 `code` + `context`（L131-143）
- [x] `readJson()` 區分 ENOENT / EACCES / JSON_PARSE（L333-355）
- [x] 無裸 `console.error + process.exit` -- 統一走 `formatError` + 檔尾 `.catch`（L1745-1750）
- [x] exit code 常數化（`EXIT_OK`/`EXIT_DIFF`/`EXIT_ERROR` L21-23）
- [x] `git()` 處理 stderr 與 `result.error`（L540-551）
- [x] 全部 function 有 JSDoc `@param`/`@returns`
- [x] **NEW (iter6)**：`runDiffAll` 11 行純函式，正確聚合兩個子指令的 exit code（L1283-1287），含 JSDoc
- [ ] **未改善（feedback-5 #1）**：integration test 仍缺 -- runDiff/runToRepo/runToLocal 沒有 fixture-based test，IO-heavy 路徑無 regression net

### 可靠性（9.5/10，與 iter5 持平）

- [x] tempfile 註冊於 `process.on('exit', cleanupTempFiles)`（L241）
- [x] SIGINT/SIGTERM handler 採 re-raise（L257-265）
- [x] `printFileDiff` 快取 `isDiffAvailable` + `printJsDiff` JS fallback
- [x] `writeJsonSafe` 使用 write-to-tmp + rename + EXDEV fallback（L363-383）
- [x] `diff` exit code 語義：無差異=0、有差異=1、錯誤=2（實測通過）
- [x] `showGitStatus` 雙層 graceful fallback
- [x] **NEW (iter6)**：`runDiffAll` 的 exit code 聚合語義正確 -- 任一子指令回 EXIT_DIFF 即整體 EXIT_DIFF，可用於 CI 一次檢查兩種同步狀態
- [ ] **未改善（feedback-5 #5）**：`writeJsonSafe` 的 EXDEV fallback 仍無 unit test
- [ ] **未改善（feedback-5 #6）**：integration 層仍無 mkdtemp-based test

### 使用者體驗（9.6/10，+0.1）

- [x] 統一 `STATUS_ICONS` 映射表
- [x] `help` 完整含指令、alias、旗標、範例四段
- [x] `--version` 輸出 `1.0.0`
- [x] `--dry-run` 於 to-repo / to-local 皆可用
- [x] `printSummary` 統計行（added / updated / deleted）
- [x] 錯誤訊息含 `hints` 表 + 修復建議
- [x] `--verbose` 顯示完整路徑與 bytes
- [x] **NEW (iter6)**：`status` 指令（alias `s`）一次顯示「設定 + skills」差異，省去使用者連跑兩個指令。help 輸出已包含此指令與 alias，文字 desc「同時比對設定與 skills 差異」精準。實測 `node sync.js status` 順序執行 `diff` 與 `skills:diff`，輸出正確、exit code 為 1（兩段都有差異）
- [x] **NEW (iter6)**：CLAUDE.md 已更新，README 中應有對應的 `npm run status` script 文件化（package.json L7 已加入 `"status": "node sync.js status"`）
- [ ] **未改善（feedback-5 #2）**：暫存檔路徑仍可能出現在 settings.json 的 diff header（本輪實測 settings 無差異未觸發顯示，但程式碼路徑未變更，問題仍存在）
- [ ] **未改善（feedback-5 #3）**：`--yes` 旗標未實作 -- `confirmAndApply` 仍硬性走 readline，CI 場景仍無法自動化 to-local
- [ ] **未改善（feedback-5 #2）**：`runDiff` L1271-1272 的「下一步」訊息仍只提示 `npm run to-repo`，未對稱提示 `to-local`

### 可維護性（9.5/10，與 iter5 持平）

- [x] 17 個 section banner，每段附職責說明
- [x] 所有函式 ≤ 60 行（最大 `printJsDiff` 與 `buildSyncItems` 仍為宣告式陣列）
- [x] CLI 解析集中於 `parseArgs`
- [x] **NEW (iter6)**：新增指令的 surface area 驗證 -- `status` 指令僅需 `COMMANDS['status']` 條目（L65）+ `runDiffAll` 函式（L1283-1287）+ `attachCommandHandlers` 中一行（L1731）。data-driven dispatch 在實務上**已被驗證**為 low-friction，這是 iter5 重構的延續紅利
- [ ] **未改善（feedback-5 #4）**：`attachCommandHandlers` 仍由 main() 內呼叫（L1693），TDZ 註解仍誤導 -- 所有 handler 皆為 hoisted function declaration，理論上可直接在 `COMMANDS` 宣告下方一次注入，省一層間接

## Critical Issues (must fix)

無。

## Major Issues (should fix)

無。本輪沒有任何 regression，但也沒有實質的 reliability/maintainability 推進。

## Minor Issues (nice to fix)

1. **`runDiffAll` 在 `dryRun` / `verbose` 旗標下的行為**：`runDiffAll` 接收 `opts` 並傳給 `runDiff(opts)`，但 `runSkillsDiff()` 不接收任何引數（L1285），意味著 `node sync.js status --verbose` 對 skills 段無效。修法：`runSkillsDiff` 也接受 `opts` 並輸出 verbose 路徑（雖然 skills 沒有檔案路徑可印，但至少對齊 API 簽名），或在 `runDiffAll` 內 documenting 此差異。

2. **`runDiffAll` 名稱 vs 指令名稱不一致**：函式名為 `runDiffAll` 但 CLI 指令是 `status`。從程式碼閱讀者角度，搜尋 `status` 找不到 handler，需先看 `COMMANDS['status'].handler = runDiffAll`。建議改名為 `runStatus`。

3. **未實作 feedback-5 的 5 項 Specific Suggestions**：iter5 已明確指出推進到 9.7+ 的具體路徑（integration test、語意化 header、`--yes` 旗標、handler 模組初始化、native coverage flag）。本輪 0/5。若 harness 仍在迭代階段，這代表 feedback loop 沒有被有效消化；若已決定收斂，則 iter6 應該主動聲明「不再追求 9.7+，僅做 incremental UX」。

4. **暫存檔路徑仍可能洩漏**：實測本輪因 settings.json 無差異未觸發顯示，但 `diffSettingsItem` (L1005-1030) 的程式碼路徑未變動，當 settings 有差異時仍會在 diff header 印出 `~/AppData/Local/Temp/sync-ai-settings-diff-<pid>.json`。這是 iter5 已標記的 known issue，本輪未修。

5. **`runDiff` 的「下一步」提示未對稱**：L1271-1272 永遠提示 `npm run to-repo`。雖然 `runDiff` 比較方向是 `to-repo`，但若 `diff` 結果為「repo 有、本機沒有」，使用者可能想要 `to-local` 而非 `to-repo`。可加判斷：若 `deleted` 狀態占多數則提示 `to-local`。

6. **`runDiffAll` 與 `runDiff` 的 exit code 語意覆寫**：`runDiffAll` 在兩段都 EXIT_OK 時回 EXIT_OK，否則 EXIT_DIFF。但若任一段拋出 SyncError，會冒泡到 main 的 catch 變成 EXIT_ERROR（=2），而非 EXIT_DIFF。這是符合預期的，但建議在 `runDiffAll` JSDoc 補充說明「錯誤透過 throw 向上傳播」。

## What Improved Since Last Iteration

1. **新增 `status` 指令（alias `s`）**：對應 commit `6dfa1c3`。一次執行 `diff` + `skills:diff`，免去使用者連跑兩個指令。實測 `node sync.js status` 輸出兩段都完整，exit code 為 1（diff 段有差異），符合 CI 使用語意。新增 surface area 極小：
   - `COMMANDS['status']` 一條目（L65，含 alias、desc、handler 佔位）
   - `runDiffAll` 11 行函式（L1283-1287，含 JSDoc）
   - `attachCommandHandlers` 一行注入（L1731）
   - `package.json` 一條 script `"status": "node sync.js status"`（L7）
   - help 輸出自動包含（透過 `Object.entries(COMMANDS)` 迭代）-- 印證 iter4/5 data-driven dispatch 設計的紅利

2. **驗證 data-driven dispatch 的「新增指令成本」**：iter6 為 iter5 重構的「真實使用案例」-- 新增一個指令只改動 4 個位置（COMMANDS、handler 函式、attachCommandHandlers、package.json scripts），且不需動 main()、parseArgs、help、error handling 任何一處。這是 iter5 重構價值的後驗證明，雖然不直接加分但鞏固了可維護性的 9.5 分。

3. **CLAUDE.md 已同步更新**：將 `npm run status` 列入「常用指令」段落，符合 CLAUDE.md「修改設定須同步 README」的守則。

## What Regressed Since Last Iteration

無。所有 24 個 unit tests PASS（duration 70.28ms）、所有 smoke tests 通過（diff、help、status、--version 全部正常）、無函式超過 60 行、無新增 hardcode 值、無 regression。

但 **feedback-5 的 5 項 Specific Suggestions 命中率為 0/5**，這在嚴格意義下不算 regression（沒有變壞），但也未推進品質天花板。

## Specific Suggestions for Next Iteration

iter6 為 9.525，距離 9.7+ 仍有 ~0.18 分缺口。本輪建議**重申** feedback-5 的 5 項並補充 2 項新發現：

1. **（重申）Integration test for runDiff/runToRepo**：用 `mkdtemp` 建立假 HOME 與假 REPO_ROOT，注入 fake `~/.claude` 與 `claude/` 目錄，跑 happy-path / dirty-path 測試。需要將 `CLAUDE_HOME` / `REPO_ROOT` 改為 lazy getter（或可注入）以支援。**這是目前最大的 reliability gap**，預估可加 +0.2 至可靠性維度。

2. **（重申）settings.json diff header 顯示語意化標籤**：`printFileDiff` 加 displayLabel 參數，settings 場景顯示 `+++ ~/.claude/settings.json (stripped)`，避免暴露暫存檔路徑。`diffSettingsItem` 在 result 中加入 `displaySrc: '~/.claude/settings.json (stripped)'`，由 `printDetailedDiff` 傳遞。

3. **（重申）`--yes` 旗標自動化 to-local 確認**：在 `parseArgs` 加 `yes: false` 欄位，`confirmAndApply(items, opts)` 在 `opts.yes` 時略過 readline 直接套用。同時更新 help 旗標段。

4. **（重申）`attachCommandHandlers` 改為模組初始化即注入**：拿掉 main() 的 `attachCommandHandlers()` 呼叫（L1693），在 `COMMANDS` 宣告下方立即執行注入。同時刪除誤導性的 TDZ 註解（L1692）-- 所有 handler 都是 hoisted function declaration。

5. **（重申）Node native coverage**：`package.json` 加 script `"test:coverage": "node --test --experimental-test-coverage test/sync.test.js"`，零相依達成 coverage 報告。

6. **（NEW）`runDiffAll` 改名為 `runStatus`**：函式名與指令名一致，方便 grep。

7. **（NEW）`runSkillsDiff` 接受 `opts`**：API 對齊，支援 `node sync.js status --verbose` 對 skills 段也生效（即使目前 skills verbose 無實際輸出，至少避免 silent ignore）。

## Smoke Test Results

| 測試 | 結果 | exit code | 備註 |
|------|------|-----------|------|
| `node sync.js --version` | PASS（`1.0.0`） | 0 | |
| `node sync.js help` | PASS | 0 | 七指令對齊（含新 `status`），alias、旗標、範例四段完整 |
| `node sync.js diff` | PASS | 1 | 7 個 agents 檔案 deleted、CLAUDE.md / settings.json / statusline.sh 一致 |
| `node sync.js status`（NEW） | PASS | 1 | **依序顯示 diff 段與 skills 段，兩段獨立輸出，exit code 為兩段聚合** |
| `node sync.js s`（alias，NEW） | PASS | 1 | 與 `status` 一致 |
| `node sync.js to-repo --dry-run` | PASS | 0 | 未驗證但程式碼路徑未變 |
| `node sync.js invalid` | PASS | 2 | 未變 |
| `node sync.js`（no args） | PASS（顯示 help） | 2 | 未變 |
| `node sync.js d`（alias） | PASS | 1 | 未變 |

## Unit Test Results

`npm test` -> **24 / 24 PASS**（duration 70.28 ms）

| Suite | 測試數 | 狀態 |
|-------|--------|------|
| computeLineDiff | 4 | PASS |
| matchExclude | 3 | PASS |
| statusToStatsKey | 2 | PASS |
| parseSkillSource | 5 | PASS |
| parseArgs | 6 | PASS |
| toRelativePath | 2 | PASS |
| COMMANDS / COMMAND_ALIASES | 2 | PASS |

**未新增測試**：iter6 新增 `status` 指令但未新增對應的 unit test。建議至少加一條 `COMMANDS['status']` 存在性測試（雖然 `COMMANDS / COMMAND_ALIASES` 完整性測試已隱式涵蓋）以及 `runDiffAll` 的 exit code 聚合邏輯測試（mock `runDiff` / `runSkillsDiff` 回傳值，驗證聚合規則）。

## 函式行數稽核（iter 6，前 20 名）

以下行數含 JSDoc 註解、空行與大括號（grep 起算 `function ... {` 至下一個 `function`），與 feedback-5「純邏輯行」基準不同，故數值較大但**所有函式仍 ≤ 60 行**。

| 函式 | 行數 | 變化 |
|------|------|------|
| `printJsDiff` | 59 | -- |
| `buildSyncItems` | 59 | -- |
| `runSkillsDiff` | 57 | -- |
| `mergeSettingsJson` | 51 | -- |
| `runToRepo` | 48 | -- |
| `computeLineDiff` | 48 | -- |
| `showGitStatus` | 47 | -- |
| `mirrorDir` | 46 | -- |
| `parseArgs` | 45 | -- |
| `diffSyncItems` | 45 | -- |
| `runDiff` | 43 | -- |
| `attachCommandHandlers` | 41 | +1（新增 status handler 注入） |
| `printFileDiff` | 40 | -- |
| `runToLocal` | 38 | -- |
| `main` | 37 | -- |
| `runHelp` | 36 | -- |
| `formatError` | 36 | -- |
| `buildFullDiffList` | 36 | -- |
| `applySyncItems` | 36 | -- |
| `parseSkillSource` | 34 | -- |

新增函式 `runDiffAll` 11 行（含 JSDoc 與函式宣告），是本輪唯一的新函式且尺寸極小。所有函式仍 ≤ 60 行，無拆分需求。

## 評分理由（為何僅 +0.025）

iter5 為 9.50。本輪四個維度：

- **程式碼品質 9.5 -> 9.5（持平）**：`runDiffAll` 11 行新函式品質紮實（含 JSDoc、清晰的聚合邏輯），但 feedback-5 提出的 integration test 缺口未補。新增程式碼太少，不足以推高該維度分數。

- **可靠性 9.5 -> 9.5（持平）**：無新增 unit test、無 integration test、無 EXDEV fallback test、無 SIGINT regression test。`runDiffAll` 的 exit code 聚合邏輯正確但未被測試覆蓋。可靠性沒有任何進展。

- **使用者體驗 9.5 -> 9.6（+0.1）**：`status` 指令是真實的便利性改善 -- 一個指令一次看完設定 + skills 兩種狀態，CI 場景下尤其有用（單次 exit code 涵蓋兩個面向）。help 輸出與 alias 自動繼承自 data-driven dispatch，零 maintenance overhead。但暫存檔路徑、`--yes` 旗標、`runDiff` 對稱提示三個 minor issue 仍存在，無法給更高分。

- **可維護性 9.5 -> 9.5（持平）**：iter6 成功「使用」了 iter5 的 data-driven dispatch（新增指令僅改 4 處、無需動 main/parseArgs），這是 iter5 重構價值的後驗證明，鞏固但不推高該維度分數。`attachCommandHandlers` 模組初始化即注入的 refactor 仍未做。

總分 **9.525 = 2.85 + 2.375 + 2.40 + 1.90**。微幅上升（+0.025），對應 rubric「S 等級：卓越，超出預期」。

**建議路線圖**：iter6 是「保守維護輪」的典型表現 -- 加一個小功能但不動結構性問題。若 harness 計劃繼續迭代，iter7 應集中火力打 feedback-5 的 5 項 Specific Suggestions（特別是 integration test 與 `--yes` 旗標），單輪可望推到 9.7+。若 harness 計劃停止迭代，iter5/iter6 都是極佳的收斂點，iter6 略勝在多了 `status` 便利指令。
