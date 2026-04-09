# 技術債與關注領域

**分析日期：** 2026-04-09

## 技術債

### writeJsonSafe 檔案寫入的 checkWriteAccess 時序問題

**問題：** `writeJsonSafe()` 在 `sync.js` 第 364 行會檢查目標檔案的寫入權限，但對於不存在的檔案，`checkWriteAccess()` 會試圖用 `fs.accessSync(filePath, fs.constants.W_OK)` 檢查權限。在某些系統上，對不存在檔案的權限檢查行為不一致（例如 Windows 與 POSIX 系統差異）。

**檔案：** `sync.js` 行 363-383

**影響：** 
- 建立新的 JSON 檔案可能在某些環境中誤判為權限錯誤
- 雖然 `ensureDir()` 會先建立目錄，但檔案本身仍不存在

**修復方式：** 
將 `checkWriteAccess()` 改為檢查父目錄的寫入權限，而不是目標檔案本身。或者，在 `writeJsonSafe()` 中移除 `checkWriteAccess()` 的前置檢查，改為在寫入失敗時捕捉異常並轉換為 `SyncError`。

---

### 互動確認的 TTY 檢測缺失

**問題：** `askConfirm()` 在 `sync.js` 第 1717-1725 行會使用 `readline.createInterface()` 建立互動提示，但不檢查 `process.stdin.isTTY` 或 `process.stdout.isTTY`。

**檔案：** `sync.js` 行 1717-1725

**影響：** 
- 在非互動環境（如 CI pipeline、後台執行、管道重導向）中，`readline.question()` 會無限等待或行為異常
- `to-local` 指令會在 CI 環境中掛起

**修復方式：** 
在 `askConfirm()` 開頭檢查 `!process.stdin.isTTY`，若為非互動環境應拋出 `SyncError` 或提前回傳 `false`，並提示使用者使用 `--dry-run` 預覽。

---

### 暫存檔清理的競態條件

**問題：** `registerTempFile()` 與 `cleanupTempFiles()` 的實作中，若多個並發操作（虛擬）或信號處理時，可能導致重複清理或清理已刪除檔案。

**檔案：** `sync.js` 行 218-241

**影響：** 
- 低風險，因為此工具單執行緒執行
- 但若未來改為異步操作，此邏輯會有問題

**修復方式：** 
暫存檔路徑中已含 `process.pid`，理論上不會衝突。對於 `fs.unlinkSync()` 的錯誤，現有程式碼已用 `try-catch` 忽略，這是可接受的防禦性設計。無需改變。

---

### LCS Diff 引擎的記憶體臨界值硬編碼

**問題：** `LCS_MAX_LINES = 2000`（`sync.js` 第 42 行）是硬編碼的臨界值。超過此值會切換到簡易逐行比對，但簡易比對的結果品質較差（會忽略行的位置資訊）。

**檔案：** `sync.js` 行 42, 635-637, 675-694

**影響：** 
- 2000 行閾值對於 Node.js 18+ 較為保守（現代機器通常有充足記憶體）
- 超大檔案（如 agents 套件）的 diff 結果可能不精確

**修復方式：** 
考慮提升臨界值到 5000-10000 行，或使用環境變數 `SYNC_AI_LCS_MAX_LINES` 讓使用者調整。

---

## 已知 Bug

### 暫無已知 Bug

最近幾個迭代（iter4/iter5）已修復以下問題：
- `applySyncItems` 不再強制覆寫（commit 7eaed4d）
- settings.json 序列化對稱性確保（commit b5bf284）
- `to-repo` 完成後正確顯示 git diff（commit b5bf284）

---

## 安全考量

### 環境變數與敏感路徑洩漏

**風險：** 雖然程式碼已在 `toRelativePath()` 中處理使用者主目錄遮罩，但以下場景仍可能洩漏敏感資訊：

**檔案：** `sync.js` 行 197-209

**目前保護：**
- diff header 輸出使用相對路徑（行 710-711）
- 錯誤訊息中的路徑使用 `toRelativePath()` 遮罩（行 181）

**潛在缺口：**
- `.sync-history.log` 已寫入的日誌可能包含絕對路徑（但被列入 `.gitignore`）
- verbose 模式下的路徑顯示已正確使用相對路徑（行 1189-1190）

**建議：** 
定期審查 `.sync-history.log` 內容不上傳，`.gitignore` 應維持現狀。

---

### 檔案權限與跨平台問題

**風險：** `checkWriteAccess()` 在 Windows 與 POSIX 系統上的行為差異。

**檔案：** `sync.js` 行 318-325

**受影響的系統：**
- Windows：某些情況下 `fs.accessSync()` 無法準確偵測實際可寫性
- macOS/Linux：行為一致

**建議：** 
考慮改用 `fs.statSync()` + 位元檢查，但這會增加複雜度。目前的作法（嘗試寫入後捕捉異常）更可靠。

---

## 測試覆蓋缺口

### 缺乏 I/O 相關的集成測試

**涉及範圍：**
- `copyFile()` / `mirrorDir()` 的實際檔案操作
- `mergeSettingsJson()` 的 `to-repo` 與 `to-local` 路徑
- `runToLocal()` 的互動確認流程

**檔案：** `test/sync.test.js` 只包含純函式單元測試

**目前依賴：** 人工 smoke test（在文件中提及）

**改進方式：** 
由於零外部相依的限制，無法使用 Jest/Vitest 的 mock。可以：
1. 新增 `test/integration.test.js` 使用 Node.js 內建 `node:test` 搭配臨時目錄進行 I/O 測試
2. 或維持現狀，依賴人工驗證（目前可接受）

---

### JSON 解析錯誤的邊界測試不足

**問題：** `readJson()` 只有單元測試但無集成測試。

**檔案：** `sync.js` 行 333-355

**缺口：**
- 損壞 JSON 檔案的處理（目前只有錯誤訊息）
- BOM 或非 UTF-8 編碼的檔案

**建議：** 
若 settings.json 損壞，使用者應手動修復。目前錯誤訊息明確，可接受。

---

## 可靠性問題

### 無提交鎖定機制

**問題：** `to-repo` 完成後會顯示 `git add -A && git commit` 建議，但不自動執行，依賴使用者手動執行。

**檔案：** `sync.js` 行 1138-1173

**風險：**
- 使用者忘記 push，多裝置同步失敗
- 另一台裝置同步時覆寫未 push 的變更

**緩解方式：** 
文件中已明確說明 skills 不自動同步，使用者應理解工具只到 git add 為止。

**改進方式：** 
可新增 `--auto-commit` 旗標或 hook 支援，但會增加複雜度，不符合當前「輕量級」設計。

---

### 目錄鏡像的刪除邏輯

**問題：** `mirrorDir()` 會刪除目的目錄中 src 沒有的檔案（行 499-507）。

**檔案：** `sync.js` 行 470-510

**風險：**
- `to-local` 時，若 repo 中刪除了某檔案，本機對應檔案會被刪除（符合預期）
- `to-repo` 時，本機刪除的檔案會從 repo 移除（符合預期，已實現完整鏡像）

**現況：** 行為正確且已審核（CLAUDE.md 無留言），無需改變。

---

## 擴展性限制

### 單檔設計導致函式增長

**問題：** 所有邏輯集中在 `sync.js`（~1800 行），雖然遵守「≤60 行函式」原則，但檔案本身難以維護。

**檔案：** `sync.js` 全部

**目前組織：** section banner 分段（18+ 個 section）

**限制：**
- IDE 導航困難
- 無法按功能模塊化載入
- 測試時必須 `require()` 整個檔案

**取捨：** 零外部相依的約束下，這是合理的設計。若要改進，需評估引入模塊系統的收益。

---

### 沒有配置檔支援

**問題：** 所有設定（排除模式、臨界值、設備欄位）都硬編碼在程式碼中。

**檔案：** `sync.js` 行 32-46

**影響：**
- 若要調整 `DEVICE_FIELDS`，需修改源碼 + 單元測試
- 無法自訂 `LCS_MAX_LINES` 或排除模式

**建議：** 
如果將來需要更靈活的配置，可考慮讀取 `.sync-ai.json` 或環境變數，但目前功能足夠，無需改變。

---

## 性能考量

### diff 外部指令依賴

**問題：** `printFileDiff()` 優先使用外部 `diff` 指令，如不可用才用純 JS fallback。

**檔案：** `sync.js` 行 703-735

**現狀：**
- `isDiffAvailable()` 快取結果（行 282-288）
- Windows 環境下 `diff` 通常不可用，會用 JS fallback
- 純 JS 實作使用 LCS，性能可接受

**改進方向：** 
考慮預載所有大檔案的 diff 結果並快取，但成本不值。

---

### 遞迴目錄掃描的效率

**問題：** `getFiles()` 遞迴掃描目錄（行 429-447），在深層目錄結構上可能較慢。

**檔案：** `sync.js` 行 429-447

**現狀：**
- agents / commands 目錄通常不會很深或很大
- 每次 diff / apply 都會重新掃描

**影響：** 低。若有大量檔案（>1000），可考慮快取，但目前不必要。

---

## 技術負債總結

| 項目 | 優先級 | 複雜度 | 建議 |
|------|--------|--------|------|
| `writeJsonSafe` checkWriteAccess 時序 | 中 | 低 | 下個迭代修復 |
| `askConfirm` TTY 檢測 | 高 | 低 | 優先修復（CI 環境可用性） |
| LCS 記憶體臨界值 | 低 | 低 | 可選改進 |
| 單檔設計可維護性 | 低 | 高 | 暫不改變 |
| 配置檔支援 | 低 | 中 | 需求驅動 |

---

*技術債審計：2026-04-09*
