# 編碼慣例

**分析日期：** 2026-04-07

## 命名模式

**檔案：**
- 主程式：`sync.js`（kebab-case 搭配 .js 副檔名）
- 測試檔案：`test/sync.test.js`（採用 `.test.js` 模式）
- 設定檔案：`package.json`、`skills-lock.json`（全小寫 kebab-case）

**函式：**
- camelCase，例如：`matchExclude`、`buildSyncItems`、`mergeSettingsJson`、`writeJsonSafe`
- 名詞前綴搭配動作，例如：`readJson`、`copyFile`、`getFiles`、`printStatusLine`
- 輔助/內部函式：採用相同 camelCase（無特殊前綴區分）

**變數：**
- 常數（模組級別）：全大寫 SNAKE_CASE，例如：`REPO_ROOT`、`CLAUDE_HOME`、`EXIT_OK`、`LCS_MAX_LINES`、`DEVICE_FIELDS`
- 一般變數：camelCase，例如：`tempFiles`、`dryRun`、`isWriting`、`srcContent`
- 布林變數：通常以 `is` 或 `has` 開頭，例如：`isTTY`、`isWriting`、`isDiffAvailable`

**型別與介面：**
- JSDoc typedef：使用 `@typedef` 宣告，名稱採 PascalCase，例如：`SyncItem`、`ParsedArgs`
- 錯誤代碼：全大寫 SNAKE_CASE 在 `ERR` 物件中，例如：`ERR.FILE_NOT_FOUND`、`ERR.JSON_PARSE`

## 程式碼風格

**格式化：**
- 無自動化工具（eslint、prettier 等）
- 採用手工一致的風格：2 空格縮排，Unix 換行符
- JSON 序列化固定使用 2 空格：`JSON.stringify(data, null, 2)`

**JavaScript 特色：**
- 檔案開頭宣告：`'use strict';` 開啟嚴格模式
- 模組架構：單檔案設計，所有邏輯在 `sync.js` 中，區段使用註解橫線分隔
- 區段橫線格式（長 75 個 = 符號）：
  ```javascript
  // =============================================================================
  // Section: [名稱] -- [說明]
  // [用途敘述]
  // =============================================================================
  ```

**注釋與文件化：**
- 使用 JSDoc 註釋所有函式，包含 `@param`、`@returns`、`@throws` 標籤
- 邏輯複雜的段落加上行內註釋，說明「為什麼」而非「做什麼」
- 型別註釋：使用 JSDoc 的 `@type {string}`、`@type {Record<string, unknown>}` 等
- 簡要註釋：短段落使用 `// 註釋` 風格，長段落使用 `/** ... */`

## 導入組織

**順序：**
1. 內建模組（`node:*` 或直接 `require('fs')` 等）
2. 本地相對導入（仅測試檔案有此需求）

**路徑別名：**
- 未使用路徑別名，一律採相對或絕對檔案系統路徑
- `__dirname` 與 `path.join()` 搭配構造絕對路徑

## 錯誤處理

**模式：**
- 統一錯誤類：`SyncError` 擁有 `code` 與 `context` 屬性
- 錯誤代碼定義於 `ERR` 物件：`ERR.FILE_NOT_FOUND`、`ERR.JSON_PARSE`、`ERR.GIT_ERROR`、`ERR.PERMISSION`、`ERR.INVALID_ARGS`、`ERR.IO_ERROR`
- 丟出 SyncError 時總是附帶 code 與 context：
  ```javascript
  throw new SyncError(`檔案不存在：${filePath}`, ERR.FILE_NOT_FOUND, { path: filePath });
  ```

**主程式出口：**
- `main()` 函式經由 `.catch()` 攔截，統一呼叫 `formatError()` 函式
- `formatError()` 根據 error code 展示友善訊息與修復建議
- 敏感資訊遮罩：`toRelativePath()` 隱藏絕對路徑中的使用者目錄

**外部工具（git、diff）：**
- 無法執行時回傳 `{ ok: false }` 結構，不拋出例外
- 由呼叫端判斷可用性，降級處理（例如 diff 不可用時 fallback 為純 JS 實作）

## 日誌與輸出

**框架：**
- 無日誌框架，直接使用 `console.log()` 與 `console.error()`
- ANSI 色碼透過 `col` 物件控制，TTY 檢查在模組頂層：`const isTTY = process.stdout.isTTY`

**輸出模式：**
- 狀態列：使用 `printStatusLine(type, label, desc)` 統一格式，type 對應 `STATUS_ICONS` 映射表
- 摘要：使用 `printSummary(stats)` 印出 `{ added, updated, deleted }` 統計
- Diff 顯示：優先使用外部 `diff` 指令，fallback 為純 JS 實作 `printJsDiff()`
- 建立進度提示：`console.log()` 搭配 `col.bold()` 與 `col.dim()` 加強可讀性

**特殊規則：**
- 路徑顯示時使用 `toRelativePath()` 隱藏使用者名稱
- diff header 中的路徑亦走 `toRelativePath()` 遮罩

## 函式設計

**大小限制：**
- 約定函式 ≤ 60 行，需拆分超過此限的函式
- 例外：`buildSyncItems()` 為宣告式陣列，允許 54 行
- 例外：`computeLineDiff()` 實作完整 LCS 演算法，允許 65 行

**參數風格：**
- 單純參數用位置參數，超過 3 個時改為物件參數
- 可選參數預設值寫在函式簽名，例如：`function getFiles(dir, base = '')`
- dry-run / verbose 等旗標採用物件參數 `opts: ParsedArgs`

**回傳值：**
- 簡單值：直接回傳（`string`、`number`、`boolean`）
- 複合值：回傳物件或陣列，結構在 JSDoc 或 typedef 中定義
- 非同步函式：回傳 `Promise<number>`（exit code）
- 無回傳值：明確註記 `@returns {void}`

**副作用管理：**
- 檔案 I/O：集中在 `readJson`、`writeJsonSafe`、`copyFile` 等函式
- 狀態修改：`isWriting` 與 `tempFiles` 提升至模組級別，由信號處理器管理
- 純函式（測試用）：`computeLineDiff`、`matchExclude`、`parseArgs` 等完全無副作用

## 模組設計

**匯出模式：**
- 直接執行（`node sync.js ...`）：進入 `main()` 分派
- 被 require（單元測試）：匯出純函式與常數，在 `module.exports` 宣告
- 區分條件：`if (require.main === module)` 判斷執行模式

**匯出清單（`module.exports`）：**
```javascript
module.exports = {
  // 純函式
  computeLineDiff,
  computeSimpleLineDiff,
  matchExclude,
  statusToStatsKey,
  parseSkillSource,
  parseArgs,
  toRelativePath,
  // 類與常數（供測試驗證）
  SyncError,
  ERR,
  EXIT_OK,
  EXIT_DIFF,
  EXIT_ERROR,
  COMMANDS,
  COMMAND_ALIASES,
  VALID_COMMANDS,
};
```

**Data-driven dispatch：**
- 指令邏輯集中在 `COMMANDS` 物件，結構為 `{ alias, desc, handler }`
- `main()` 中呼叫 `attachCommandHandlers()` 注入 handler（延遲注入避免 TDZ）
- 分派邏輯簡潔：`await COMMANDS[opts.command].handler(opts)`

## 特殊約定

**暫存檔管理：**
- 所有暫存檔透過 `registerTempFile()` 登記
- `process.exit` 時自動清理，SIGINT/SIGTERM 亦觸發清理
- fallback 寫入失敗時 catch 並記錄（`catch (_) { /* ignore */ }`）

**跨平台相容：**
- 路徑使用 `path` 模組處理（自動相容 Windows / Unix）
- 換行符手工正規化為 Unix 格式（`\n`）
- 字串操作避免依賴特定平台

**型別註釋寬容度：**
- JSDoc `@type` 用於關鍵函式與複雜物件，一般變數不逐一註釋
- 物件結構型別採用 `Record<string, unknown>` 保持彈性

---

*編碼慣例分析：2026-04-07*
