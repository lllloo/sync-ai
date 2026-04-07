# Generator State -- Iteration 003

## What Was Built
- sync.js: 跨裝置 Claude Code 設定同步 CLI 工具（零外部相依、單檔架構）

## What Changed This Iteration
- Fixed #1: 將 `runDiff` 拆分為 `buildFullDiffList()` + `printDetailedDiff()` + `runDiff()`，各函式皆低於 60 行
- Fixed #2: 從 `runSkillsAdd` 抽取 `parseSkillSource(opts)` 函式，回傳 `{name, source}`
- Fixed #3: `to-local --dry-run` 現在於早期 return 前呼叫 `printSummary(previewStats)`
- Fixed #4: `computeSimpleLineDiff` 標記 `isApproximate`，`printJsDiff` 顯示 dim 色近似提示
- Fixed #5: `runToLocal` 改用 `diffSyncItems` 預覽 + 單次 `applySyncItems` 套用
- Fixed #6: `buildSyncItems` 加入 settings.json src/dest 不隨 direction 調換的註解
- Fixed #7: `diffSyncItems` 加入 settings.json 比對方向固定的註解
- Fixed #8: diff 結果新增 `itemType` 欄位，排序改用 `itemType === 'dir'` 取代字串檢查
- Fixed #9: `main()` 中 `--version` 和 `--help` 改為 `return EXIT_OK`，由 `.then()` 統一 `process.exit`

## Known Issues
- 無已知問題

## Dev Server
- N/A（CLI 工具，無 dev server）
- 冒煙測試全部通過：diff, help, --version, to-repo --dry-run, to-local --dry-run
