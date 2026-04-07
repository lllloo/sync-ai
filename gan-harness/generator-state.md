# Generator State -- Iteration 2

## What Was Built
- sync-ai CLI 工具（單檔 sync.js，零外部相依）

## What Changed This Iteration

### Critical Fixes
- Fixed: `to-repo --dry-run` 誤報 bug -- `copyFile` 在 dry-run 模式下現在無論 force 為何都比對檔案內容，相同回傳 false
- Fixed: `mirrorDir` 在 dry-run 模式下同樣無論 force 為何都比對內容
- Fixed: `mergeSettingsJson` 在 dry-run 時比對 stripped JSON 是否真的有差異，不再一律回傳 true
- Fixed: 大函式拆分 -- 抽取 `buildSyncItems(direction)`, `diffSyncItems(items, direction)`, `applySyncItems(items, direction, opts)`, `showGitStatus()` 四個共用函式，三個指令共用同一套邏輯

### Major Fixes
- Fixed: 快取 diff 可用性 -- 新增 `isDiffAvailable()` lazy getter，避免 Windows 上每次都嘗試 spawn 失敗
- Fixed: `runSkillsAdd` 引數解析 -- 將額外 positional args 納入 `parseArgs` 的 `extraArgs` 陣列
- Fixed: `readPackageJson` 改用 `readJson` 而非自己做 try-catch

### Minor Fixes
- Fixed: `handleSignal` 改用 re-raise signal 方式退出
- Fixed: `VALID_COMMANDS` 與 `COMMAND_ALIASES` 合併為 `COMMANDS` 物件統一管理
- Fixed: 補齊 `cleanEmptyDirs`, `matchExclude`, `runHelp` 的 `@returns` JSDoc
- Fixed: `computeSimpleLineDiff` 加上近似結果的 JSDoc 說明
- Fixed: `getStrippedSettings()` 輔助函式抽取，減少 settings.json 處理的重複程式碼

## Known Issues
- `computeSimpleLineDiff` 使用 Set 比對仍為近似結果（大檔案限制），已加註說明

## Dev Server
- URL: N/A（CLI 工具，非 web 應用）
- Status: N/A
- Command: node sync.js <command>
