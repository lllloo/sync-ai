# sync-ai 改善計畫

專案 review 後整理的待修項目，依優先度排序。

---

## 優先處理

### 1. 文件殘留的 `conflict-markers` 說明

- **位置**：`.claude/commands/sync-ai.md` 第 348 行
- **問題**：實作細節中仍提到 `conflict-markers` action，但 `sync-ai-apply.js` 已移除此 action（只剩 `check-same` 和 `write-local`）
- **修正**：從 sync-ai.md 的實作細節中刪除 `conflict-markers` 相關描述

### 2. diff / apply 共用程式碼重複

- **位置**：`sync-ai-diff.js` 和 `sync-ai-apply.js`
- **問題**：`readFileSafe`、`stableStringify`、`deepEqual`、`DEVICE_SPECIFIC_KEYS` 各自實作一份，未來修改忽略欄位清單容易漏改
- **修正**：抽出 `sync-ai-utils.js` 共用模組，兩個腳本都 require 它

---

## 建議改進

### 3. `npx skills list` 解析脆弱性

- **位置**：`sync-ai-diff.js:247`
- **問題**：用正則 `^  ([a-z][a-z0-9-]+)\s+(\S+)` 解析 CLI 輸出，格式變動會靜默失敗，所有 skill 被判為 lockOnly
- **修正**：優先使用 `--json` 旗標（若支援）；或在解析結果為空時加 warning

### 4. README 與 CLAUDE.md 的裝置特定欄位描述不一致

- **位置**：`README.md:38`、`CLAUDE.md` 注意事項
- **問題**：README 提到 `statusLine` 為裝置特定設定，但 CLAUDE.md 只提 `model`、`effortLevel`（程式碼中三者皆有）
- **修正**：統一文件描述，明確列出 `model`、`effortLevel`、`statusLine` 三個欄位

### 5. .gitignore 補充

- **位置**：`.gitignore`
- **問題**：目前只有 `.agents/` 和 `.agent/`
- **修正**：補上 `node_modules/` 和 `*.log`

### 6. settings.json 權限補充

- **位置**：`claude/settings.json` 的 `permissions.allow`
- **問題**：同步流程步驟 7 需要 `git push` 和 `hostname`，但未列入允許清單，每次都會觸發確認
- **修正**：視需求加入 `Bash(git push:*)`、`Bash(hostname:*)`

---

## 低優先 / 觀察

### 7. deepEqual 陣列比較使用 Set 語義

- **位置**：`sync-ai-diff.js:85-90`
- **問題**：`[1,2]` 與 `[2,1]` 視為相同，對 `permissions.allow` 合理，但對有序陣列可能假陽性
- **狀態**：目前情境合理，加個程式碼註解標明 intentional design 即可

### 8. LCS Diff 記憶體風險

- **位置**：`sync-ai-diff.js:26-32`
- **問題**：O(m×n) 空間，大檔案會爆
- **狀態**：目前同步的檔案都很小，暫不需處理

### 9. statusline.sh JSON 解析健壯性

- **位置**：`claude/statusline.sh:6-8`
- **問題**：bash regex 抓 JSON 欄位，key 順序不同或值含跳脫引號時會失敗
- **狀態**：Claude Code 輸入格式穩定，暫可接受
