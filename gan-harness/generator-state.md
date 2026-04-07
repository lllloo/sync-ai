# Generator State -- Iteration 005

## What Was Built
- 單檔 CLI 同步工具 `sync.js`，五個指令（diff、to-repo、to-local、skills:diff、skills:add）+ help
- 零外部相依，僅用 Node.js 內建模組
- 全程繁體中文輸出，含 ANSI 色碼、JSDoc、SyncError 統一錯誤處理
- **新增**：`test/sync.test.js` 使用 `node:test` 進行純函式單元測試（24 個 test case）

## What Changed This Iteration（追求 9.5+）

### 1. 新增 `node:test` 單元測試（feedback #1，最高優先）
- 新增 `test/sync.test.js`，共 24 個 test case，涵蓋：
  - `computeLineDiff`：相同字串、全新、刪除、中間修改四種情境
  - `matchExclude`：精確比對、尾部萬用、非尾部 `*` 當字面字元
  - `statusToStatsKey`：三種有效狀態 + null/unknown/undefined
  - `parseSkillSource`：URL 解析、雙引數、缺引數、URL 格式錯誤、單一引數
  - `parseArgs`：指令、別名、旗標、extraArgs、未知指令
  - `toRelativePath`：非絕對路徑、REPO_ROOT 內的路徑
  - `COMMANDS` / `COMMAND_ALIASES` 完整性
- `sync.js` 底部新增 `if (require.main === module)` 條件匯出：被 `require` 時 export 純函式給測試，直接執行時走原本 main()
- `package.json` 新增 `"test": "node --test test/sync.test.js"`（Node 24 不接受目錄 arg，改指定檔案）
- **結果**：`npm test` 全部 24 個 PASS

### 2. `formatError` 顯示全部 `context` 欄位（feedback #3）
- 原本只印 `context.path` 一欄，現在遍歷所有 context 欄位以 `key：value` dim 行顯示
- `stack` 欄位被排除（內部欄位），`undefined`/`null` 跳過
- `path` 欄位特殊處理：經過 `toRelativePath` 遮罩
- 驗證：`skills:add https://skills.sh/broken` 現在會額外顯示 `url：https://skills.sh/broken`

### 3. `COMMANDS` 改為 data-driven dispatch（feedback #2）
- `COMMANDS` 物件每個 entry 新增 `handler` 欄位
- 新增 `attachCommandHandlers()` 函式，於 `main()` 一開始呼叫（延遲到執行階段避免宣告順序 TDZ）
- `main()` 的 switch 徹底消失，改為 `return await entry.handler(opts)`
- sync / async 混合以 `await` 統一處理
- `help` 的特殊邏輯保留在 `main()`（因為影響 exit code 分支），但 `COMMANDS['help'].handler` 也存在以保持對稱

### 4. `printFileDiff` header 使用 relative 路徑（feedback #4）
- 覆寫 `diff -u` 輸出的 `--- / +++` 前綴行，改用 `toRelativePath(destPath)` / `toRelativePath(srcPath)`
- 強化 `toRelativePath`：
  - 若在 `REPO_ROOT` 內：顯示相對路徑（如 `claude\CLAUDE.md`）
  - 若在 `HOME` 內：以 `~/...` 代替（如 `~/.claude/CLAUDE.md`）
  - 其它情況保留原路徑
- 驗證：`node sync.js diff` 的 header 不再暴露 `C:\Users\Roy\...`

### 5. `ParsedArgs` typedef 移到 top-level（feedback #5）
- `ParsedArgs` 與 `SyncItem` typedef 集中到 Section: Constants 後方的「Type definitions」小節
- 原本散落在 `buildSyncItems` / `parseArgs` 附近的兩份 typedef 已刪除

### 額外：錯誤格式化對暫存檔路徑的遮罩
- `toRelativePath` 的 HOME 分支在 Windows 上對 `C:\Users\Roy\AppData\Local\Temp\...` 也有效，進一步隱藏使用者名稱

## 函式行數稽核（本次）

| 函式 | 行數 | 狀態 |
|------|------|------|
| `buildSyncItems` | 54 | OK |
| `runSkillsDiff` | 51 | OK |
| `printJsDiff` | 47 | OK |
| `runToRepo` | 43 | OK |
| `mirrorDir` | 41 | OK |
| `computeLineDiff` | 41 | OK |
| `parseArgs` | 41 | OK |
| `mergeSettingsJson` | 40 | OK |
| `diffSyncItems` | 38 | OK |
| `runDiff` | 38 | OK |
| `printFileDiff` | 33 | +3 for relative header override |
| `main` | 33 | -19 thanks to data-driven dispatch |
| `formatError` | 30 | +8 for context iteration + hint/toRelativePath helper |
| `toRelativePath` | 14 | NEW |

**所有函式皆 ≤ 60 行**。`main()` 從 52 降至 33。

## Smoke Test Results

| 測試 | 結果 | exit code |
|------|------|-----------|
| `node sync.js --version` | PASS（`1.0.0`） | 0 |
| `node sync.js help` | PASS | 0 |
| `node sync.js diff` | PASS | 1 |
| `node sync.js to-repo --dry-run` | PASS | 0 |
| `node sync.js to-local --dry-run` | PASS | 0 |
| `node sync.js invalid` | PASS | 2 |
| `node sync.js`（no args） | PASS | 2 |
| `node sync.js d`（alias） | PASS | 1 |
| `node sync.js diff --verbose` | PASS | 1 |
| `node sync.js skills:add`（no args） | PASS | 2 |

## Unit Test Results

`npm test` → **24 / 24 PASS**（duration ~70ms）

涵蓋五個純函式 + toRelativePath + COMMANDS 對應表完整性。

## Known Issues
- 無已知 regression
- `~/AppData/Local/Temp/sync-ai-settings-diff-<pid>.json` 暫存檔路徑仍會出現在 diff header，但已遮掉使用者名稱（用 `~` 取代 HOME）

## Dev Server
N/A -- 此專案為 CLI 工具，無 dev server。執行方式：
- `node sync.js <command>` 或 `npm run <script>`
- 測試：`npm test`
