# 架構

**分析日期：** 2026-04-09

## 模式概述

**整體模式：** 單檔 CLI 工具，資料驅動命令派發

**關鍵特徵：**
- 整個應用邏輯於 `sync.js` 單檔內（~1800 行，零外部相依）
- 所有函式 ≤ 60 行（強制要求，便於可讀性與測試）
- 聲明式 `COMMANDS` 物件驅動命令派發，無條件分支
- `SyncItem` 抽象統一所有同步操作，三條指令共用單一處理管道
- 支援 dry-run 模式，同步前完整預覽

## 層級

**命令層（CLI Entry）：**
- 目的：解析使用者輸入，分派至對應指令
- 位置：`sync.js` 1736-1782 行（`main()` 與 `attachCommandHandlers()`）
- 包含：指令解析、引數驗證、幫助文本
- 依賴：`parseArgs()` / `COMMANDS` 表
- 使用者：終端使用者（npm scripts 或直接呼叫）

**指令層（Command Handlers）：**
- 目的：各指令的業務邏輯（diff / to-repo / to-local / skills 管理）
- 位置：`sync.js` 1274-1531 行（`runDiff` / `runToRepo` / `runToLocal` / `runSkillsDiff` 等）
- 包含：flow control、使用者互動、統計與日誌
- 依賴：核心同步層、display 層
- 使用者：`main()` 透過 `attachCommandHandlers()` 注入的 handler

**核心同步層（Sync Core）：**
- 目的：同步項目建立、差異計算、套用變更
- 位置：`sync.js` 948-1132 行（`buildSyncItems` / `diffSyncItems` / `applySyncItems`）
- 包含：`SyncItem` 聲明、方向性同步邏輯
- 依賴：FS utilities、Settings handler
- 使用者：指令層的各 handler

**檔案系統層（FS Utilities）：**
- 目的：原子檔案操作、目錄遞迴、權限檢查
- 位置：`sync.js` 291-530 行（`readJson` / `writeJsonSafe` / `copyFile` / `mirrorDir` 等）
- 包含：寫入安全（tmp + rename）、permission 檢查、EXDEV fallback
- 依賴：Node.js 內建 `fs` / `path`
- 使用者：核心同步層、Settings handler

**設定層（Settings Handler）：**
- 目的：settings.json 去除裝置欄位、合併邏輯
- 位置：`sync.js` 831-910 行（`serializeSettings` / `loadStrippedSettings` / `mergeSettingsJson`）
- 包含：DEVICE_FIELDS 排除、序列化對稱性
- 依賴：FS utilities
- 使用者：核心同步層（settings 項目處理）

**Display 層（顯示與格式化）：**
- 目的：統一格式化終端輸出，狀態圖示與色碼
- 位置：`sync.js` 793-828 行 與各指令內（`printStatusLine` / `printSummary` / `printFileDiff`）
- 包含：狀態圖示映射、ANSI 色碼、差異視覺化
- 依賴：`STATUS_ICONS` 常數、`col` 色碼工具函數
- 使用者：所有指令

**錯誤層（Error Handling）：**
- 目的：統一錯誤分類與顯示，含修復建議
- 位置：`sync.js` 123-210 行（`SyncError` class / `formatError()`）
- 包含：錯誤代碼（FILE_NOT_FOUND / JSON_PARSE / GIT_ERROR 等）、路徑遮罩
- 依賴：無
- 使用者：所有層，最終由 `main().catch()` 統一處理

## 資料流

**to-repo 流程（本機 → repo）：**

1. **命令解析**（`main()`）
   - 使用者執行 `npm run to-repo` → `parseArgs()` 提取 `--dry-run` / `--verbose`
   
2. **同步項目建立**（`buildSyncItems('to-repo')`）
   - 產生宣告式 `SyncItem[]`，包含 file / settings / dir 三種類型
   - 項目清單：CLAUDE.md / settings.json / statusline.sh / agents/ / commands/
   
3. **套用變更**（`applySyncItems(items, 'to-repo', {dryRun})`）
   - 遍歷各項目類型：
     - **settings**：`mergeSettingsJson()`，去除 model / effortLevel，寫入 repo
     - **file**：`copyFile()` with content 比對
     - **dir**：`mirrorDir()` with full sync（repo 多餘檔案會被刪除）
   - 每次寫入前檢查 dry-run，dry-run 時仍執行 content 比對
   - 回傳 stats（added/updated/deleted 計數）與 changeLog
   
4. **顯示與日誌**
   - `printStatusLine()` 輸出各檔案狀態（+ / ~ / -）
   - `printSummary()` 輸出摘要統計
   - `appendSyncLog()` 記錄到 `.sync-history.log`
   - `showGitStatus()` 顯示 git diff 預覽

5. **返回 exit code**
   - EXIT_OK（0）：成功
   - EXIT_ERROR（2）：發生錯誤

**to-local 流程（repo → 本機，含互動確認）：**

1. **差異預覽**（`runDiff(opts)` → `diffSyncItems()`）
   - 先執行完整 diff，顯示所有變更項目
   
2. **使用者確認**（`askConfirm()`）
   - 詢問「是否確認套用？」，使用者輸入 'y' 才繼續
   
3. **套用變更**（`applySyncItems()`）
   - 邏輯同 to-repo，但方向相反
   - settings：from repo + 保留本機 device fields
   
4. **記錄與完成**
   - 同 to-repo

**diff 流程（純比對，無寫入）：**

1. **項目建立 & 差異計算**（`buildSyncItems()` → `diffSyncItems()`）
   - 遍歷各項目，計算 status（null / 'new' / 'changed' / 'deleted'）
   
2. **結果補全**（`buildFullDiffList()`）
   - 補上無差異的 file/settings（status=null），便於使用者確認所有項目都已檢查
   
3. **顯示詳細差異**（`printDetailedDiff()`）
   - 對變更的檔案呼叫 `printFileDiff()`
   - 優先使用外部 `diff` 指令（若可用），fallback 為純 JS 實作（`computeLineDiff()`）
   
4. **返回 exit code**
   - EXIT_OK（0）：無差異
   - EXIT_DIFF（1）：有差異（可用於 CI）

**skills:diff 流程（純查詢，無同步）：**

1. **本機 skills 掃描**（`npx skills list`）
   - 透過 spawn 呼叫外部工具，取得 JSON 格式清單
   
2. **repo lock 檔讀取**（`skills-lock.json`）
   - 讀取 source of truth 清單
   
3. **集合比對**
   - 計算 repo 獨有（需安裝）vs 本機多裝（需移除或加入 repo）
   
4. **建議指令輸出**
   - 只輸出建議，不執行任何操作
   - 本機多裝時同時列出：
     - （A）`npm run skills:add -- <name> <source>`（加入 repo）
     - （B）`npx skills remove <name>`（從本機移除）

## 關鍵抽象

**SyncItem：**
- 目的：統一描述各類同步項目（檔案 / 目錄 / settings）
- 結構：`{ label, src, dest, type, verboseSrc, verboseDest }`
- 例子：
  - `{ label: 'CLAUDE.md', src: '~/.claude/CLAUDE.md', dest: './claude/CLAUDE.md', type: 'file' }`
  - `{ label: 'settings', src: '~/.claude/settings.json', dest: './claude/settings.json', type: 'settings' }`
  - `{ label: 'agents', src: '~/.claude/agents/', dest: './claude/agents/', type: 'dir' }`

**ParsedArgs：**
- 目的：封裝 CLI 引數
- 結構：`{ command, dryRun, verbose, showVersion, showHelp, extraArgs }`

**DiffResult：**
- 目的：描述單項差異
- 結構：`{ label, status, src, dest, verboseSrc, verboseDest, itemType }`
- status 值：`null`（一致） / `'new'`（本機有） / `'changed'`（不同） / `'deleted'`（repo 有）

## 進入點

**主進入點：**
- 位置：`sync.js` 1788-1795 行（`if (require.main === module)` 區塊）
- 觸發：直接執行 `node sync.js` 或 npm script
- 責任：呼叫 `main()`，統一捕捉錯誤，呼叫 `process.exit(exitCode)`

**測試進入點：**
- 位置：`sync.js` 1796-1819 行（`else` 區塊）
- 觸發：被 `require('./sync.js')` 引入（單元測試）
- 責任：匯出純函式供 `test/sync.test.js` 使用

## 錯誤處理

**策略：** 所有例外經 `SyncError` class 統一分類，最終由 `main().catch()` 統一處理

**錯誤代碼：**
- `FILE_NOT_FOUND`：檔案不存在，提示檢查路徑
- `JSON_PARSE`：JSON 格式錯誤，提示使用 jsonlint 驗證
- `GIT_ERROR`：Git 操作失敗，提示確認 git 安裝與 repo 狀態
- `PERMISSION`：檔案權限不足
- `INVALID_ARGS`：使用者引數錯誤
- `IO_ERROR`：磁碟操作失敗

**路徑遮罩：**
- `toRelativePath()` 將絕對路徑轉為相對路徑（相對 repo 或 ~ 代替 $HOME）
- 所有錯誤訊息、diff header、verbose 輸出都經此函數，避免洩漏使用者目錄

## 跨切關注

**日誌記錄：**
- 位置：`sync.js` 917-936 行（`appendSyncLog()`）
- 何時：每次 to-repo / to-local 完成後
- 內容：timestamp / hostname / 變更清單
- 檔案：`.sync-history.log`（已 .gitignore）

**驗證：**
- 讀取檔案時：`checkReadAccess()` 檢查權限
- 寫入檔案時：`checkWriteAccess()` 檢查已存在檔案的權限
- settings 合併時：去除 DEVICE_FIELDS（model / effortLevel）

**認證：**
- 無內建認證，依賴 git 層級認證
- to-repo 時檢查是否在 git repo 內（非 dry-run）

---

*架構分析：2026-04-09*
