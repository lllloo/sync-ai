# Evaluation Feedback -- Iteration 5

## Scores

| 維度 | 分數 | 權重 | 加權分 |
|------|------|------|--------|
| 程式碼品質 | 9.5 | 0.30 | 2.85 |
| 可靠性 | 9.5 | 0.25 | 2.375 |
| 使用者體驗 | 9.5 | 0.25 | 2.375 |
| 可維護性 | 9.5 | 0.20 | 1.90 |
| **總分** | | | **9.50** |

## Verdict: PASS (threshold: 7.0) -- 等級 S

iter4 為 9.00（S 等級下緣）。本輪 Generator 不僅完成 feedback-4 全部 5 項 Specific Suggestions，且品質紮實：unit tests 不是膚淺的 smoke wrapper、data-driven dispatch 真的拿掉了 main() 的 switch（行數從 52 → 33）、printFileDiff 的 header 路徑遮罩有實際效果、formatError 的 context 迭代邏輯正確排除 stack。每個維度同步 +0.5 至 9.5。

未給 10 的理由：(1) 整合測試仍缺（unit tests 只覆蓋純函式，runDiff/runToRepo 等 IO-heavy 的指令沒有 fixture-based test）；(2) 暫存檔路徑 `~/AppData/Local/Temp/sync-ai-settings-diff-<pid>.json` 仍會出現在 settings.json 的 diff header（user name 已遮，但暫存檔的存在仍洩漏給讀者）；(3) confirmAndApply 仍無 `--yes` 自動化旗標。

## Checklist

### 程式碼品質（9.5/10）
- [x] `SyncError` class 含 `code` + `context`（L130-142）
- [x] `readJson()` 區分 ENOENT / EACCES / JSON_PARSE（L332-354）
- [x] 無裸 `console.error + process.exit` -- 統一走 `formatError` + 檔尾 `.catch`（L1730-1737）
- [x] exit code 常數化（`EXIT_OK`/`EXIT_DIFF`/`EXIT_ERROR` L21-23）
- [x] `git()` 處理 stderr 與 `result.error`（L539-550）
- [x] 全部 function 有 JSDoc `@param`/`@returns`
- [x] **NEW**：`formatError` 顯示全部 context 欄位（L176-187），排除 `stack`，path 走 `toRelativePath` 遮罩
- [x] **NEW**：`COMMANDS` 加入 `handler` 欄位 + `attachCommandHandlers()`（L1717-1724），main() 的 switch 完全消失，改為 `await entry.handler(opts)`（L1710）
- [x] **NEW**：純函式單元測試 24 個 PASS（`test/sync.test.js`）

### 可靠性（9.5/10）
- [x] tempfile 註冊於 `process.on('exit', cleanupTempFiles)`（L240）
- [x] SIGINT/SIGTERM handler 採 re-raise（L256-264），中斷時顯示警告
- [x] `printFileDiff` 快取 `isDiffAvailable` + `printJsDiff` JS fallback
- [x] `writeJsonSafe` 使用 write-to-tmp + rename + EXDEV fallback（L362-382）
- [x] `diff` exit code 語義：無差異=0、有差異=1、錯誤=2（實測通過）
- [x] `showGitStatus` 雙層 graceful fallback
- [x] **NEW**：`computeLineDiff`、`matchExclude`、`statusToStatsKey`、`parseSkillSource`、`parseArgs` 五個純函式有 unit tests，未來 refactor 風險顯著下降
- [x] **NEW**：`COMMANDS` 對應表完整性測試（每個指令都驗證 `VALID_COMMANDS` 包含、別名能反查回正式指令）

### 使用者體驗（9.5/10）
- [x] 統一 `STATUS_ICONS` 映射表
- [x] `help` 完整含指令、alias、旗標、範例四段
- [x] `--version` 輸出 `1.0.0`
- [x] `--dry-run` 於 to-repo / to-local 皆可用，含預覽摘要
- [x] `printSummary` 統計行（added / updated / deleted）
- [x] 錯誤訊息含 `hints` 表 + 修復建議
- [x] `--verbose` 顯示完整路徑與 bytes
- [x] **NEW**：`printFileDiff` 的 `--- / +++` header 路徑改用 `toRelativePath`，REPO_ROOT 內顯示 `claude\CLAUDE.md`、HOME 內顯示 `~/.claude/CLAUDE.md`，user name `Roy` 不再外洩
- [x] **NEW**：`formatError` 對所有 context 欄位（含 `url`、`parseError`）以 dim 行顯示，debug 體驗顯著提升（實測 `skills:add https://skills.sh/onlyone` 會額外印 `url：...`）

### 可維護性（9.5/10）
- [x] 17 個 section banner，每段附職責說明
- [x] 所有函式 ≤ 60 行（最大 `buildSyncItems` 54）
- [x] `diffSyncItems` 抽 `diffSettingsItem`
- [x] `runToLocal` 抽 `printToLocalPreview` + `confirmAndApply`
- [x] `buildFullDiffList` 為純函式
- [x] CLI 解析集中於 `parseArgs`
- [x] **NEW**：`ParsedArgs` 與 `SyncItem` typedef 集中於 Section: Constants 後方的 Type definitions 小節（L82-104），從 `buildSyncItems` / `parseArgs` 附近的散落定義整併
- [x] **NEW**：`main()` 從 52 → 33 行，data-driven dispatch 移除 switch，新增指令只需在 `COMMANDS` + `attachCommandHandlers` 兩處
- [x] **NEW**：`toRelativePath()` 14 行的 helper 抽出，formatError 與 printFileDiff 共用

## Critical Issues (must fix)

無。

## Major Issues (should fix)

無。本輪沒有任何 regression。

## Minor Issues (nice to fix)

1. **暫存檔路徑仍出現在 settings.json diff header**：實測 `node sync.js diff` 顯示 `+++ ~/AppData/Local/Temp/sync-ai-settings-diff-5280.json`。雖然 `Roy` 已遮成 `~`，但讀者仍能看出這是 spawn 暫存檔。理想做法是 `printFileDiff` 對 settings 項目特殊處理 header，顯示 `+++ ~/.claude/settings.json (stripped)` 之類的語意化標籤。需要在 caller 端傳入 displayLabel，refactor 成本中等。

2. **`runDiff` 的「下一步」訊息對 `to-local` 場景不對稱**：L1270-1271 永遠提示 `npm run to-repo`，但若使用者跑 `diff` 後想做反向同步，沒有提示 `to-local`。可改為兩行提示，或根據 diff 內容判斷方向。

3. **`attachCommandHandlers` 註解提到「避免 TDZ」但其實所有 handler 都是 function declarations，不會有 TDZ**：L1680 註解寫「延遲到 main 執行階段，避免宣告順序 TDZ 問題」，但實測 `runDiff` / `runToRepo` 等都是 hoisted function，並無 TDZ 風險。註解略誤導。建議改為「延遲到執行階段以方便未來 swap handler」，或直接在模組頂層立即注入。

4. **`runHelp` 與 `COMMANDS['help'].handler` 雙路徑**：L1692-1695 main() 仍直接呼叫 `runHelp()`，繞過了 dispatch 表。雖然這是因為 help 不算錯誤、要回 `EXIT_OK`，但可以將 `COMMANDS['help'].handler` 設定為 `() => { runHelp(); return EXIT_OK; }`（已存在於 L1723），讓 main() 走統一 dispatch 路徑而非特例。

5. **`writeJsonSafe` 的 EXDEV fallback 未經測試**：L374-376 的 cross-device rename fallback 沒有 unit test 覆蓋，僅靠註解保證。可加入一個 mocked filesystem test 或至少在 README 文件化此 invariant。

6. **單元測試覆蓋集中在純函式**：integration 層（runDiff、runToRepo、runToLocal）尚無測試。建議用 `node:test` + `mkdtemp` 建立 tempdir 作為假 HOME / REPO_ROOT，跑 happy-path integration test。但這會大幅增加 sync.js 的可注入性需求（目前 `REPO_ROOT` / `HOME` 是 module-level const），refactor 成本高。

## What Improved Since Last Iteration

1. **新增 24 個 node:test 單元測試 + npm test script**：覆蓋 `computeLineDiff`（4 case）、`matchExclude`（3 case）、`statusToStatsKey`（2 case）、`parseSkillSource`（5 case）、`parseArgs`（6 case）、`toRelativePath`（2 case）、`COMMANDS` 對應表完整性（2 case）。實測 `npm test` 全數 PASS，duration 69ms。Test cases 不是膚淺的「assert truthy」，而是包含 negative case（缺引數、URL 格式錯誤、未知狀態）以及 invariant 驗證（`COMMANDS` 與 `VALID_COMMANDS` 一致性）。修復 feedback-4 #1。

2. **`formatError` 顯示全部 context 欄位**：L176-187 從只印 `context.path` 改為遍歷整個 context object，排除 `stack` 等內部欄位、跳過 `undefined`/`null`、`path` 走 `toRelativePath` 遮罩。實測 `skills:add https://skills.sh/onlyone` 額外顯示 `url：https://skills.sh/onlyone`。修復 feedback-4 #3。

3. **`COMMANDS` 改為 data-driven dispatch**：L63-70 為每個指令新增 `handler` 欄位（null 佔位），L1717-1724 的 `attachCommandHandlers()` 注入實際 handler，main() L1709-1710 從 switch 改為 `await entry.handler(opts)`。`main()` 函式從 52 行降到 33 行（-19 行）。新增指令只需改兩處而非三處（COMMANDS、handler 函式、main switch）。修復 feedback-4 #2。

4. **`printFileDiff` header 改用 relative path**：L708-715 覆寫 `--- / +++` 行，使用 `toRelativePath(destPath)` / `toRelativePath(srcPath)`。實測 `node sync.js diff` 輸出 `--- claude\CLAUDE.md` 與 `+++ ~/.claude/CLAUDE.md`，user name `Roy` 不再外洩。修復 feedback-4 #4。

5. **新增 `toRelativePath()` helper（L196-209，14 行）**：三層 fallback：(a) REPO_ROOT 內顯示 relative path、(b) HOME 內以 `~` 取代、(c) 其他保留原值。被 `formatError` 與 `printFileDiff` 共用，是本輪最有價值的 helper 抽取。

6. **`ParsedArgs` typedef 移到 top-level Type definitions 小節**：L82-104 統一管理 `SyncItem` 與 `ParsedArgs`，原本散落於 `buildSyncItems` 與 `parseArgs` 上方的兩份 typedef 已刪除。修復 feedback-4 #5。

7. **`require.main === module` 條件 export**：L1730-1757 讓 sync.js 可同時作為 CLI 入口與 testable module。直接執行時走 main() + process.exit，被 require 時 export 純函式 + 常數供 unit test 使用。這個設計避免了引入 lib/ 目錄打破單檔架構的 trade-off。

8. **README.md 更新**：L26-27、L72 加入 `npm test` 與 `test/sync.test.js` 的說明，與本輪程式碼變更同步。符合 CLAUDE.md「修改設定須判斷 README 是否需同步」的守則。

## What Regressed Since Last Iteration

無。所有 10 項 smoke tests 通過、所有 24 個 unit tests 通過、無函式超過 60 行。

## Specific Suggestions for Next Iteration

iter5 已達 9.5。若要追求 9.7+（極接近天花板），建議：

1. **Integration test for runDiff/runToRepo**：用 `mkdtemp` 建立假 HOME 與假 REPO_ROOT，注入 fake `~/.claude` 與 `claude/` 目錄，跑 happy-path 與 dirty-path 測試。需要將 `CLAUDE_HOME` / `REPO_ROOT` 改為 lazy（或可注入）以支援。這是目前最大的 reliability gap。

2. **settings.json diff header 顯示語意化標籤**：傳遞 displayLabel 到 `printFileDiff`，settings 場景顯示 `+++ ~/.claude/settings.json (stripped)`，避免暴露暫存檔路徑。

3. **`--yes` 旗標自動化 to-local 確認**：CI 或腳本場景下無法互動回答 `y/N`。在 `parseArgs` 加 `yes` 欄位，`confirmAndApply` 在 `opts.yes` 時略過 readline。

4. **`attachCommandHandlers` 改為模組初始化即注入**：拿掉 main() 內的 `attachCommandHandlers()` 呼叫，改在 `COMMANDS` 宣告下方立即注入。註解中的 TDZ 擔憂對 function declarations 不成立，可刪除這個延遲設計。

5. **覆蓋率工具**：引入 `c8` 或 Node 24+ 的 `--experimental-test-coverage` 報告 coverage。但這會破壞「零外部相依」原則（c8 是 devDependency），故只推薦 Node native flag。

## Smoke Test Results

| 測試 | 結果 | exit code | 備註 |
|------|------|-----------|------|
| `node sync.js --version` | PASS（`1.0.0`） | 0 | |
| `node sync.js help` | PASS | 0 | 指令、alias、旗標、範例四段對齊完整 |
| `node sync.js diff` | PASS（2 項差異 + 詳細 diff） | 1 | header 顯示 `claude\CLAUDE.md` 與 `~/.claude/CLAUDE.md`，user name 已遮 |
| `node sync.js to-repo --dry-run` | PASS（摘要 2 個更新） | 0 | 未實際寫入 |
| `node sync.js to-local --dry-run` | PASS（摘要 2 個更新） | 0 | 含 `printSummary` 統計 |
| `node sync.js invalid` | PASS | 2 | `[!] 未知指令：invalid` + hint |
| `node sync.js`（no args） | PASS（顯示 help） | 2 | 符合語意 |
| `node sync.js d`（alias） | PASS（與 diff 一致） | 1 | |
| `node sync.js diff --verbose` | PASS | 1 | 每項顯示 `src:`/`dest:` 完整路徑與 bytes |
| `node sync.js skills:add`（no args） | PASS | 2 | 兩種用法提示 + hint |
| `node sync.js skills:add https://skills.sh/onlyone`（額外） | PASS | 2 | **顯示 `url：https://skills.sh/onlyone`，驗證 formatError context 迭代** |

## Unit Test Results

`npm test` -> **24 / 24 PASS**（duration 69.002 ms）

| Suite | 測試數 | 狀態 |
|-------|--------|------|
| computeLineDiff | 4 | PASS |
| matchExclude | 3 | PASS |
| statusToStatsKey | 2 | PASS |
| parseSkillSource | 5 | PASS |
| parseArgs | 6 | PASS |
| toRelativePath | 2 | PASS |
| COMMANDS / COMMAND_ALIASES | 2 | PASS |

測試品質評估：
- 包含 negative case（throws SyncError 含正確 code）
- 包含 boundary case（空字串、null、undefined）
- 包含 invariant 驗證（COMMANDS 與 VALID_COMMANDS 一致性、別名雙向對應）
- 不是膚淺的 `assert.ok(result)` 包裝，而是 `assert.deepEqual` 比對具體陣列
- 透過 `withArgv` helper 隔離 process.argv mutation，避免 test pollution

## 函式行數稽核（iter 5）

所有函式皆 ≤ 60 行。前 20 名：

| 函式 | 行數 | 變化 |
|------|------|------|
| `buildSyncItems` | 54 | -- |
| `runSkillsDiff` | 51 | -- |
| `printJsDiff` | 47 | -- |
| `runToRepo` | 43 | -- |
| `mirrorDir` | 41 | -- |
| `computeLineDiff` | 41 | -- |
| `parseArgs` | 41 | -- |
| `mergeSettingsJson` | 40 | -- |
| `diffSyncItems` | 38 | -- |
| `runDiff` | 38 | -- |
| `showGitStatus` | 36 | -- |
| `printFileDiff` | 33 | +3（relative header override） |
| `main` | 33 | **-19（data-driven dispatch）** |
| `applySyncItems` | 32 | -- |
| `buildFullDiffList` | 31 | -- |
| `formatError` | 30 | +8（context 迭代） |
| `runToLocal` | 29 | -- |
| `parseSkillSource` | 29 | -- |
| `confirmAndApply` | 28 | -- |
| `runSkillsAdd` | 28 | -- |

`toRelativePath` 14 行（NEW）。最大邏輯函式 `main` 從 iter4 的 52 行降至 33 行，是本輪最顯著的可維護性改善。

## 評分理由（為何跨越 9.5 門檻）

iter4 為 9.00。本輪在四個維度都有具體可驗證的改進，每維度同步 +0.5：

- **程式碼品質 9 -> 9.5**：unit tests 直接補上 iter4 該維度未達 10 的最大障礙；formatError context 迭代修復了 iter4 提出的「其他 context 欄位未顯示」問題。未給 10 的理由：integration tests 仍缺。

- **可靠性 9 -> 9.5**：unit tests 為 5 個關鍵純函式建立 regression net。`computeLineDiff` 的 LCS 邏輯複雜（41 行 + DP table），有了 4 個 case 後未來重構安全許多。`COMMANDS` invariant test 確保 dispatch 表結構不會悄悄損壞。未給 10 的理由：runDiff/runToRepo 等 IO 路徑無 integration test、SIGINT 中斷時 partial state 仍無 rollback。

- **使用者體驗 9 -> 9.5**：printFileDiff header 路徑遮罩是實際 user-facing 改進（複製 diff 輸出到公開場合不再洩漏 user name）；formatError 額外顯示 context 欄位讓 debug 體驗顯著提升，實測 `url：...` 等資訊在錯誤時直接出現。未給 10 的理由：暫存檔路徑仍出現在 settings.json 的 header（雖已遮 user name）；`--yes` 自動化旗標仍缺。

- **可維護性 9 -> 9.5**：data-driven dispatch 是真正的結構改善（main 從 52 → 33 行），不是 cosmetic refactor；新增指令的 surface area 從 3 處（COMMANDS、handler、main switch）降到 2 處；`ParsedArgs` typedef 集中管理；`toRelativePath` helper 抽取消除 formatError 與 printFileDiff 之間的潛在重複。未給 10 的理由：`buildSyncItems` 仍 54 行（宣告式陣列，難拆）、`attachCommandHandlers` 延遲注入的設計理由（TDZ）對 function declarations 不成立、可刪除這層間接。

總分 **9.50 = 2.85 + 2.375 + 2.375 + 1.90**，對應 rubric「S 等級：卓越，超出預期」。本輪是 iter3 → iter4 → iter5 三輪複利的成果：每輪都精準命中前次 feedback 的 actionable 建議且未引入 regression。

建議：若 harness 計劃停止迭代，iter5 是極佳的收尾點。進一步追求 9.7+ 需要 integration test 與 fake filesystem injection，這會增加 sync.js 的可注入性負擔，與「單檔零相依」哲學的 trade-off 已不利。
