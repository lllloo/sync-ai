# Product Specification: sync-ai 品質優化

> Generated from brief: "優化 sync-ai 同步系統：改善程式碼品質、可靠性、錯誤處理、使用者體驗、可維護性"

## Vision

將 sync-ai 從一個「能用就好」的 CLI 工具，提升為一個健壯、優雅、可維護的同步系統。保持零外部相依與單檔架構，透過更好的錯誤處理、防禦性程式碼、一致的 UX 回饋、以及清晰的程式碼結構，讓日常同步操作更可靠、更安心。

## 設計方向（CLI 輸出風格）

- **配色原則**: 維持現有 ANSI 色碼，但確保語義一致 — 紅色=錯誤/刪除、綠色=成功/新增、黃色=警告/變更、青色=資訊、dim=輔助說明
- **排版層次**: 標題用 bold，主要資訊正常色，次要說明用 dim，所有縮排統一為 2 空格
- **圖示系統**: 統一 emoji 用法，避免 emoji 寬度不一致導致的對齊問題
- **輸出密度**: 無差異時簡潔一行帶過；有差異時分層展示摘要+細節

## 約束

- **零外部相依** — 只用 Node.js 內建模組
- **單檔架構** — 所有程式碼保持在 sync.js 中
- **核心邏輯不變** — 五個指令（diff、to-repo、to-local、skills:diff、skills:add）的功能語義不變
- **繁體中文** — 所有使用者可見文字維持繁體中文
- **eval-mode: code-only** — 不使用 playwright，只做程式碼品質評估

## Features（按優先級）

### Must-Have（Sprint 1）

1. **統一錯誤處理框架**: 定義 `SyncError` class 繼承 `Error`，包含 `code`（如 `FILE_NOT_FOUND`、`JSON_PARSE`、`GIT_ERROR`、`PERMISSION`）與 `context` 欄位。所有 catch 區塊統一使用此 class，main() 的 catch 根據 error code 輸出友善訊息。驗收標準：所有 `process.exit(1)` 呼叫都有對應的錯誤類型；不再有裸 `console.error` + `process.exit`。

2. **檔案操作防禦性處理**: `copyFile`、`mirrorDir`、`mergeSettingsJson` 等函式在 read/write 前檢查權限（`fs.accessSync`），遇到 EACCES/EPERM 時拋出 `SyncError`。`readJson` 區分「檔案不存在」vs「JSON 解析失敗」給不同錯誤訊息。驗收標準：readJson 處理 ENOENT 不 crash；寫入唯讀檔案時給出明確錯誤。

3. **Git 操作安全性**: `run()` 函式改名為 `git()`，加入 stderr 處理；`to-repo` 模式在執行前檢查是否在 git repo 內（`git rev-parse --is-inside-work-tree`）；若 git 不可用，給出友善提示而非空白輸出。驗收標準：git 不可用時顯示 "Git 不可用，跳過狀態顯示"。

4. **Process exit code 語義化**: 定義常數 `EXIT_OK = 0`、`EXIT_DIFF = 1`、`EXIT_ERROR = 2`。`diff` 模式有差異時回傳 1（可用於 CI）、無差異回傳 0、出錯回傳 2。其他模式：成功=0、錯誤=2。驗收標準：`diff` 模式回傳值可被 shell script 判斷。

5. **輸出對齊與一致性**: 所有 status icon 使用固定寬度（以空格補齊 emoji 寬度差異）；統一 icon 映射表（`STATUS_ICONS`），避免散落在各處的 emoji 字串。摘要行格式統一為 `  [icon]  [label]  [description]`。驗收標準：diff 與 skills:diff 的輸出格式視覺一致。

6. **tempfile 清理可靠性**: 使用 `process.on('exit')` 註冊清理 callback，確保 settings diff 的暫存檔在任何退出路徑都被清理（包含 SIGINT）。驗收標準：即使 Ctrl+C 中斷也不殘留暫存檔。

### Should-Have（Sprint 2）

7. **Dry-run 模式**: `to-repo` 和 `to-local` 支援 `--dry-run` 旗標，只顯示將要執行的操作而不實際寫入。驗收標準：`node sync.js to-repo --dry-run` 顯示操作清單但不修改任何檔案。

8. **Verbose 模式**: 支援 `--verbose` 旗標，在正常輸出之外顯示每個檔案操作的完整路徑與大小。驗收標準：`node sync.js diff --verbose` 顯示每個比較的完整路徑。

9. **操作摘要統計**: 每次同步結束後顯示統計摘要（如 `3 個檔案更新，1 個新增，0 個刪除`），不只是列表。驗收標準：to-repo 和 to-local 結束時有統計行。

10. **settings.json diff 改進**: 不再依賴外部 `diff` 指令（Windows 上可能沒有），改用純 JS 實作簡易 line diff。至少能顯示哪些 key 有變動。驗收標準：在沒有 `diff` 指令的環境下仍能顯示 settings.json 差異。

11. **指令別名與 help**: 支援 `--help` 或 `help` 顯示所有可用指令與說明；支援常見別名如 `d` -> `diff`、`tr` -> `to-repo`、`tl` -> `to-local`。驗收標準：`node sync.js help` 顯示格式化的指令清單。

12. **版本顯示**: 支援 `--version` 從 package.json 讀取版本號顯示。驗收標準：`node sync.js --version` 輸出版本號。

### Nice-to-Have（Sprint 3）

13. **Signal handling**: 攔截 SIGINT/SIGTERM，在 to-local 寫入過程中若被中斷，顯示警告「同步中斷，部分檔案可能未更新」。驗收標準：Ctrl+C 中斷同步時有警告訊息。

14. **操作日誌**: 每次 to-repo/to-local 成功後，將操作記錄（時間、方向、變更清單）追加到 `.sync-history.log`（加入 .gitignore）。驗收標準：執行同步後 .sync-history.log 有新記錄。

15. **程式碼結構重組**: 在單檔內以清晰的 section 註解分隔：Constants、Errors、FS Utilities、Diff Engine、Settings Handler、Skills Handler、Commands（diff/to-repo/to-local/skills:diff/skills:add）、CLI Parser、Main。每個 section 有 JSDoc 說明。驗收標準：程式碼區塊有明確的 section 標記與 JSDoc。

16. **JSON 安全寫入**: 寫入 JSON 檔案（settings.json、skills-lock.json）時先寫到 `.tmp` 再 rename，避免寫入中途斷電導致檔案損壞。驗收標準：writeJson 函式使用 write-then-rename 模式。

## Technical Stack

- **Runtime**: Node.js (>=18)
- **依賴**: 零外部依賴，僅使用 `fs`、`path`、`os`、`readline`、`child_process`
- **架構**: 單檔 `sync.js`
- **測試**: 可選用 Node.js 內建 `node:test` 模組

## Evaluation Criteria

### 程式碼品質（weight: 0.30）
- 錯誤處理是否完整：所有 fs/git 操作都有 try-catch，錯誤訊息友善且具體
- 防禦性程式碼：null/undefined 檢查、檔案存在性檢查、權限檢查
- 沒有裸 `process.exit` — 都經過統一的錯誤處理路徑
- JSDoc 註解覆蓋所有公開函式
- 常數不 hardcode（如 exit code、icon 映射）

### 可靠性（weight: 0.25）
- tempfile 一定會被清理（包含異常退出）
- JSON 寫入使用 atomic write 模式
- 不依賴外部指令（如 `diff`）做核心功能
- exit code 語義正確可被 CI 使用
- SIGINT 處理得當

### 使用者體驗（weight: 0.25）
- 輸出對齊整齊、icon 語義一致
- 錯誤訊息告訴使用者「怎麼修」而不只是「壞了」
- help 指令完整清晰
- dry-run 讓使用者安心
- 操作摘要統計一目瞭然

### 可維護性（weight: 0.20）
- 程式碼分區清晰，新增功能知道該放哪裡
- 函式職責單一，命名清楚
- 常數集中管理
- 重複邏輯已抽取為共用函式
- 保持單檔但不犧牲可讀性

## Sprint Plan

### Sprint 1: 健壯基礎
- **目標**: 建立錯誤處理框架、強化檔案操作安全性、統一輸出格式
- **Features**: #1, #2, #3, #4, #5, #6, #15
- **Definition of done**: 所有現有指令正常運作；無裸 process.exit；tempfile 必定清理；輸出格式統一

### Sprint 2: UX 強化
- **目標**: 加入 dry-run、verbose、help、摘要統計，移除對外部 diff 指令的依賴
- **Features**: #7, #8, #9, #10, #11, #12
- **Definition of done**: help 指令可用；dry-run 不寫入任何檔案；Windows 上 diff 功能正常

### Sprint 3: 進階可靠性
- **目標**: Signal handling、操作日誌、atomic write
- **Features**: #13, #14, #16
- **Definition of done**: SIGINT 有警告；JSON 寫入為 atomic；操作有日誌追蹤
