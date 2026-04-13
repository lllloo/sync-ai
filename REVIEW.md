# sync-ai Code Review

**審查日期：** 2026-04-13
**深度：** standard（全檔閱讀 + 語言特定檢查）
**審查檔案：** `sync.js`、`test/sync.test.js`、`test/settings.test.js`、`package.json`、`skills-lock.json`

---

## 摘要

整體程式碼品質良好，架構設計嚴謹（data-driven dispatch、SyncError 統一錯誤處理、atomic write 等）。無嚴重安全漏洞或資料損毀風險。發現 4 個 Warning 級別的邏輯問題與 5 個 Info 級別的改善建議。

---

## Critical Issues

無。

---

## Warnings（邏輯錯誤或潛在 bug）

### WR-01：`diffDir` 未傳遞 `excludePatterns`，`to-local` 預覽與實際套用結果不一致

**檔案：** `sync.js:1087`

**問題：**
`diffSyncItems` 呼叫 `diffDir(item.src, item.dest)` 時沒有傳 `excludePatterns`，但 `mirrorDir` 在實際套用時也沒有傳（`mirrorDir(item.src, item.dest, [], false, dryRun)`，傳的是空陣列）。目前兩者都傳空陣列，行為一致，但 `diffDir` 支援 `excludePatterns` 參數卻從未被利用，若日後需要排除某些目錄檔案，`diffDir` 這一路徑不會套用——導致預覽顯示「無差異」但實際同步卻刪除檔案（或反之）。

更明確的 bug 路徑：`mirrorDir` 在 delete 階段（第 506 行）呼叫 `getFiles(dest)` 時，**沒有過濾 `GLOBAL_EXCLUDE`**（`.DS_Store` 等），但 `getFiles` 本身有過濾 `GLOBAL_EXCLUDE`（第 439 行）。這兩段邏輯是一致的，但如果 `dest` 端存在 `.DS_Store` 這類被 `GLOBAL_EXCLUDE` 過濾掉的檔案，`mirrorDir` 的刪除迴圈不會嘗試刪它（因為 `getFiles` 不回傳），這個邏輯是對的。但 `diffDir` 第 619 行對 `destFiles` 的迴圈同樣依賴 `getFiles`（第 608 行），兩者一致，所以這條路不算 bug。

**真正的問題**：`diffDir` 在 `diffSyncItems`（第 1087 行）被呼叫時未傳 `excludePatterns`，未來要新增排除規則時此處很容易被遺忘。

**修復建議：**
```js
// sync.js:1087 — 傳入 excludePatterns，與 mirrorDir 保持對稱
const diffs = diffDir(item.src, item.dest, item.excludePatterns || []);
```
並在 `SyncItem` typedef 加上 `excludePatterns?: string[]`。

---

### WR-02：`handleSignal` 在 Windows 上呼叫 `process.kill(process.pid, signal)` 會崩潰

**檔案：** `sync.js:265`

**問題：**
Windows 不支援以訊號 re-raise 的方式退出。`process.kill(process.pid, 'SIGINT')` 在 Node.js on Windows 會拋出 `Error: kill ESRCH`，導致程式以未預期的 uncaught error 退出，而不是乾淨地結束。專案主力平台是 Windows 11，這條路徑在用戶按 Ctrl+C 時一定會觸發。

```js
// 現況：第 264-265 行
process.removeListener(signal, handleSignal);
process.kill(process.pid, signal);   // Windows 會丟 ESRCH
```

**修復建議：**
```js
function handleSignal(signal) {
  cleanupTempFiles();
  if (isWriting) {
    console.error(col.yellow('\n  [!] 同步中斷，部分檔案可能未更新'));
  }
  process.removeListener(signal, handleSignal);
  // Windows 不支援 re-raise signal；直接以 EXIT_ERROR 退出
  if (process.platform === 'win32') {
    process.exit(130); // 128 + SIGINT(2)，慣例 exit code
  } else {
    process.kill(process.pid, signal);
  }
}
```

---

### WR-03：`writeJsonSafe` EXDEV fallback 無原子性保證，且 tmpPath 已被刪除卻未從 registry 清除

**檔案：** `sync.js:374-383`

**問題：**
當 `rename` 因跨磁碟失敗（`EXDEV`）時，fallback 直接 `writeFileSync(filePath, content)`——這條路徑沒有原子性，若此刻斷電，`filePath` 會是空檔案或不完整內容。此外第 375 行 `fs.unlinkSync(tmpPath)` 刪除暫存檔後，`finally` 塊第 383 行才 `tempFiles.delete(tmpPath)`；但如果 `writeFileSync(filePath)` 拋出，`tmpPath` 已被刪除，`tempFiles` 仍持有該路徑（minore，但語意不正確）。

```js
// 現況：第 376-378 行
try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
if (e.code === 'EXDEV') {
  fs.writeFileSync(filePath, content);  // 無原子性
```

**修復建議：**
EXDEV fallback 改用同磁碟的 tmpPath 再 rename：
```js
if (e.code === 'EXDEV') {
  // 在目標目錄建立 tmpPath，確保同磁碟，rename 必定成功
  const localTmp = filePath + `.tmp.${process.pid}`;
  registerTempFile(localTmp);
  try {
    fs.writeFileSync(localTmp, content);
    fs.renameSync(localTmp, filePath);
  } finally {
    tempFiles.delete(localTmp);
    try { fs.unlinkSync(localTmp); } catch (_) {}
  }
} else { ... }
```

---

### WR-04：`main()` 的 JSDoc 回傳型別宣告為 `Promise<void>`，實際回傳 `Promise<number>`

**檔案：** `sync.js:1801`

**問題：**
`main()` 的 JSDoc 寫 `@returns {Promise<void>}`，但實際上 return 的是 `EXIT_OK`、`EXIT_DIFF`、`EXIT_ERROR` 等數字，由呼叫端 `main().then(exitCode => process.exit(exitCode))` 使用。型別不符不影響執行，但如果開啟 TypeScript `checkJs`，會出現型別錯誤，且對閱讀者有誤導性。

**修復建議：**
```js
/**
 * @returns {Promise<number>}
 */
async function main() { ... }
```

---

## Info（建議改善，不影響正確性）

### IN-01：`skills-lock.json` 第 28 行縮排錯誤（`obsidian-bases` 縮排多一層）

**檔案：** `skills-lock.json:28`

**問題：**
```json
  "defuddle": { ... },
"obsidian-bases": {          ← 少了 2 格縮排
      "source": "kepano/obsidian-skills",
```
JSON 語意正確（解析不影響），但 `writeJsonSafe` 序列化後會自動修正縮排，下一次執行 `skills:add` / `skills:remove` 就會改掉這行，造成非功能性的 git diff 噪音。

**修復建議：** 手動補齊縮排，或執行任一 `skills:*` 指令讓 `writeJsonSafe` 自動重新格式化。

---

### IN-02：`runSkillsDiff` 直接讀取 `.agents/.skill-lock.json`，但 AGENTS_HOME 路徑未統一為常數

**檔案：** `sync.js:1508`

**問題：**
`localLockPath` 硬寫為 `path.join(AGENTS_HOME, '.skill-lock.json')`，路徑 `.skill-lock.json` 是 magic string，日後 skills 工具改路徑時需要多處修改。建議提取為常數。

**修復建議：**
```js
const LOCAL_SKILL_LOCK = path.join(AGENTS_HOME, '.skill-lock.json');
// 並在 runSkillsDiff 中使用
```

---

### IN-03：`computeSimpleLineDiff` 對重複行的處理語意模糊

**檔案：** `sync.js:681-699`

**問題：**
`computeSimpleLineDiff` 以 `Set` 做集合比對，若舊文字有 3 行 `"foo"` 而新文字有 1 行 `"foo"`，Set 比對會認為「`"foo"` 存在」，不顯示任何刪除行——但實際上刪了 2 行。函式本身已標記 `isApproximate` 且 CLAUDE.md 有說明，但呼叫端 `printJsDiff` 的警告文字（第 763 行）只在整個 ops 前顯示一次，可能被使用者誤解為只有少數行不準確。這是已知的設計取捨，記錄為 info 供後續改善。

---

### IN-04：`parseArgs` 不處理 `--` 分隔符號

**檔案：** `sync.js:1720-1757`

**問題：**
若使用者傳入 `node sync.js skills:add -- --some-flag`，`parseArgs` 會因 `arg.startsWith('--')` 而跳過 `--some-flag`，無法收集到 `extraArgs`。`skills:add` 的用法說明（第 1576 行）已建議用 `npm run skills:add -- <url>` 帶入，但 `npm run -- ` 的 `--` 是 npm 的分隔符，不會傳進 `process.argv`，所以實際上不影響正常用法。記錄為 info，若未來需要支援名稱以 `-` 開頭的 skill，需要處理此情境。

---

### IN-05：測試缺少對 `mirrorDir` delete 行為的覆蓋

**檔案：** `test/sync.test.js`

**問題：**
目前測試只涵蓋純函式（`computeLineDiff`、`matchExclude`、`parseArgs` 等）。`mirrorDir` 的「dest 多餘檔案刪除」路徑（第 505-513 行）只能靠人工 smoke test 驗證。這個路徑在 `to-local` 時會刪除本機現有的 agent 或 command 檔案，若邏輯有誤後果較嚴重。CLAUDE.md 已說明 IO 路徑靠 smoke test，此處僅記錄為 info 提醒風險。

---

## 統計

| 嚴重程度 | 數量 |
|----------|------|
| Critical | 0    |
| Warning  | 4    |
| Info     | 5    |
| **合計** | **9** |

---

## 架構規範合規性

| 規範 | 狀態 |
|------|------|
| 函式 ≤ 60 行 | 合規（所有函式均符合）|
| 零外部相依 | 合規 |
| Exit code 語義（0/1/2）| 合規 |
| 統一 SyncError + formatError | 合規，無裸 `console.error + process.exit` |
| Atomic write（writeJsonSafe）| 部分合規（EXDEV fallback 無原子性，見 WR-03）|
| Relative path 遮罩（toRelativePath）| 合規 |
| Data-driven dispatch（COMMANDS）| 合規 |

---

_審查者：Claude (gsd-code-reviewer)_
_深度：standard_
