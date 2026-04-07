# Generator State -- Iteration 004

## What Was Built
- 單檔 CLI 同步工具 `sync.js`，五個指令（diff、to-repo、to-local、skills:diff、skills:add）+ help
- 零外部相依，僅用 Node.js 內建模組
- 全程繁體中文輸出，含 ANSI 色碼、JSDoc、SyncError 統一錯誤處理

## What Changed This Iteration

### Major fixes
- **拆分 `runToLocal`（70 -> 29 行）**：新增 `printToLocalPreview(diffResults)` 回傳 `previewStats`，新增 `confirmAndApply(items)` 處理確認與套用流程。`runToLocal` 主流程現在僅負責標頭、取得 diff、決定是否 dry-run。
- **拆分 `diffSyncItems`（62 -> 38 行）**：抽出 `diffSettingsItem(item)` 處理 settings.json 比對分支（含 strip device fields、tmpfile、status 判斷）。

### Minor fixes
- **`runHelp` 對齊改用 `String#padEnd`**：移除魔術數字 14、8，新增常數 `CMD_COL_WIDTH = 14` 與 `ALIAS_COL_WIDTH = 8`。
- **新增 `statusToStatsKey(status)` helper**：消除 `'new'/'changed'/'deleted'` -> `'added'/'updated'/'deleted'` 的對應重複；`printToLocalPreview` 已改用此 helper。
- **`buildFullDiffList` 改為純函式**：先 `[...diffItems]` 複製陣列再 push/sort，不再 mutate 傳入的 `diffItems`。
- **`computeLineDiff` 抽常數 `LCS_MAX_LINES = 2000`**：含註解說明「超過此行數改用近似 diff 以避免 O(mn) 記憶體爆炸」。
- **`--version`/`--help` 風格統一**：新增 `printVersion()` 函式，main() 中的 `--version` inline 邏輯改為呼叫 `printVersion()`，與 `runHelp()` 對稱。

## 函式行數稽核（本次）

| 函式 | 行數 |
|------|------|
| `buildSyncItems` | 54 |
| `main` | 52 |
| `runSkillsDiff` | 51 |
| `printJsDiff` | 47 |
| `runToRepo` | 43 |
| `mirrorDir` | 41 |
| `computeLineDiff` | 41 |
| `parseArgs` | 41 |
| `mergeSettingsJson` | 40 |
| `diffSyncItems` | 38 |
| `runDiff` | 38 |
| `showGitStatus` | 36 |
| `applySyncItems` | 32 |
| `buildFullDiffList` | 31 |
| `runToLocal` | 29 |

**所有函式皆 <= 60 行**（最大 54 行）。

## Smoke Test Results

| 測試 | 結果 | exit code |
|------|------|-----------|
| `node sync.js --version` | PASS（`1.0.0`） | 0 |
| `node sync.js help` | PASS（指令與 alias 對齊正確） | 0 |
| `node sync.js diff` | PASS（顯示 2 項差異 + 詳細 diff） | 1 |
| `node sync.js to-repo --dry-run` | PASS（摘要：2 個更新） | 0 |
| `node sync.js to-local --dry-run` | PASS（摘要：2 個更新） | 0 |

## Known Issues
- 無已知 regression
- `previewStats` 仍由 `printToLocalPreview` 計算後回傳；尚未把 stats 計算下沉到 `diffSyncItems` 本身（feedback minor #2 的 alternative 方案），但現有 helper 已消除重複的 status->key 對應邏輯，已符合修復目標。

## Dev Server
N/A -- 此專案為 CLI 工具，無 dev server。執行方式：
- `node sync.js <command>` 或 `npm run <script>`
