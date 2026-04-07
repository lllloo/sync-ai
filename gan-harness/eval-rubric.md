# Evaluation Rubric: sync-ai 品質優化

> eval-mode: code-only (no playwright)

## 評分方式

每個維度 0-10 分，乘以權重後加總得出總分（滿分 10）。

---

## 1. 程式碼品質 (weight: 0.30)

| 分數 | 標準 |
|------|------|
| 9-10 | 所有 fs/git 操作都有 try-catch；自訂 SyncError class 含 code+context；零裸 process.exit；所有公開函式有 JSDoc；常數集中管理（EXIT_CODE、STATUS_ICONS 等） |
| 7-8  | 大部分操作有錯誤處理；有自訂 Error class 但不完整；JSDoc 覆蓋率 >70%；大部分常數已抽出 |
| 5-6  | 部分錯誤處理改善；有些 JSDoc；仍有散落的 hardcode 值 |
| 3-4  | 少量改善；多數問題未修 |
| 0-2  | 幾乎沒有改善或引入新 bug |

### 具體檢查項

- [ ] `SyncError` class 存在，含 `code` 與 `context` 屬性
- [ ] `readJson()` 區分 ENOENT vs JSON parse error
- [ ] 沒有裸 `console.error() + process.exit(1)` 模式（應統一走 throw）
- [ ] exit code 常數化（`EXIT_OK`、`EXIT_DIFF`、`EXIT_ERROR`）
- [ ] `run()`/`git()` 函式檢查 stderr 並處理
- [ ] 所有函式有 JSDoc 或至少有 `@param`/`@returns` 註解

---

## 2. 可靠性 (weight: 0.25)

| 分數 | 標準 |
|------|------|
| 9-10 | tempfile 用 process.on('exit') 清理；JSON 寫入用 write-then-rename；不依賴外部 diff 指令；exit code 語義正確；SIGINT 處理完善 |
| 7-8  | tempfile 清理可靠；大部分 JSON 寫入安全；有基本 signal handling |
| 5-6  | tempfile 清理有改善；移除了對外部 diff 的依賴 |
| 3-4  | 少量可靠性改善 |
| 0-2  | 無改善或退化 |

### 具體檢查項

- [ ] tempfile 在 process.on('exit') 或 finally 中清理
- [ ] SIGINT handler 已註冊（`process.on('SIGINT', ...)`)
- [ ] `printFileDiff` 不再硬性依賴外部 `diff` 指令（有 JS fallback）
- [ ] JSON 寫入函式使用 write-to-tmp + rename 模式（`writeJsonSafe` 或類似）
- [ ] `diff` 指令：有差異 exit 1、無差異 exit 0、錯誤 exit 2
- [ ] git 不可用時有 graceful fallback 而非 crash

---

## 3. 使用者體驗 (weight: 0.25)

| 分數 | 標準 |
|------|------|
| 9-10 | 輸出對齊完美；help 指令完整含所有子指令與旗標說明；dry-run 可用；操作摘要統計清晰；錯誤訊息含修復建議 |
| 7-8  | 輸出對齊改善；help 可用；有 dry-run 或 verbose 其一；有操作摘要 |
| 5-6  | 輸出有改善；有 help 但不完整 |
| 3-4  | 少量 UX 改善 |
| 0-2  | 無改善或退化 |

### 具體檢查項

- [ ] 統一 icon 映射表存在（如 `STATUS_ICONS` object）
- [ ] `help` 或 `--help` 可顯示所有指令與說明
- [ ] `--version` 可顯示版本號
- [ ] `--dry-run` 旗標在 to-repo/to-local 可用，不寫入任何檔案
- [ ] 操作結束有統計摘要行（X 新增、Y 更新、Z 刪除）
- [ ] 錯誤訊息包含「如何修復」的提示（如 "請確認檔案存在" 或 "請檢查權限"）

---

## 4. 可維護性 (weight: 0.20)

| 分數 | 標準 |
|------|------|
| 9-10 | 清晰的 section 分隔與 banner 註解；函式職責單一（<40 行）；重複邏輯已抽取；命名語義清楚；新開發者能快速定位功能 |
| 7-8  | 大部分有分區；多數函式職責清晰；部分重複已消除 |
| 5-6  | 有些分區改善；部分重構 |
| 3-4  | 少量重構 |
| 0-2  | 無改善或結構更亂 |

### 具體檢查項

- [ ] 程式碼有清楚的 section banner（Constants、Errors、Utilities、Commands、CLI、Main）
- [ ] 每個 section 有一行說明其職責
- [ ] 沒有超過 60 行的單一函式（或已適當拆分）
- [ ] `diffFile`/`diffDir` 的重複模式（在 runDiff 和 to-local 中）已抽取為共用邏輯
- [ ] CLI 引數解析集中在一處，而非散落在 main() 各處
- [ ] 函式命名一致（如動詞開頭：run*, diff*, copy*, mirror*）

---

## 不可違反的約束（違反任一項直接扣至該維度 0 分）

1. **零外部相依** — package.json 不可新增 dependencies/devDependencies
2. **單檔架構** — 所有程式碼在 sync.js 中
3. **核心功能不變** — 五個指令的語義行為不改變
4. **繁體中文** — 使用者可見文字（含錯誤訊息）維持繁體中文
5. **程式碼可執行** — `node sync.js diff` 不 crash（基本冒煙測試）

---

## 總分計算

```
total = (程式碼品質 * 0.30) + (可靠性 * 0.25) + (使用者體驗 * 0.25) + (可維護性 * 0.20)
```

| 等級 | 分數區間 | 說明 |
|------|---------|------|
| S    | 9.0-10  | 卓越，超出預期 |
| A    | 7.5-8.9 | 優秀，全面改善 |
| B    | 6.0-7.4 | 良好，多數項目有改善 |
| C    | 4.0-5.9 | 及格，有基本改善但不完整 |
| D    | <4.0    | 不及格 |
