執行 Claude Code 設定與 skills 統一同步流程：

## 步驟 1：事前準備（Git Fetch）

執行 `git fetch` 取得 remote 最新資訊。

**若 `git fetch` 失敗**（無網路、remote 不可達）：顯示 `⚠️ git fetch 失敗：<錯誤訊息>`，繼續用現有 repo 狀態執行。

若 remote 有新 commit，直接執行 `git pull --ff-only`，依結果處理：

- **成功**：顯示 `✅ 已 pull 最新 commit`，繼續執行
- **失敗**：顯示 `⚠️ Pull 失敗：<錯誤訊息>`，繼續用本機狀態執行

---

## 步驟 2：比對階段

執行比對腳本，讀取 JSON 輸出作為後續所有步驟的資料來源：

```bash
node .claude/commands/sync-ai-diff.js
```

腳本輸出 JSON 結構：
```json
{
  "claudeMd":    { "same": bool, "diff": "...", "repoContent": "...", "localContent": "..." },
  "settingsJson": { "same": bool, "diff": "..." },
  "skills":      { "same": bool, "lockOnly": [], "localOnly": [], "lockData": {...} },
  "agents":      { "same": bool, "repoOnly": [], "localOnly": [], "conflicts": [], "groups": [...] },
  "commands":    { "same": bool, "repoOnly": [], "localOnly": [], "conflicts": [] }
}
```

各欄位說明：
- `claudeMd.diff`：含 context 的 unified diff 文字（`  ` context、`- ` repo only、`+ ` local only）
- `skills.lockOnly`：在 lock 但未安裝的 skill names；`localOnly`：已安裝但不在 lock 的 skill names
- `agents.groups`：群組化結果，`level` 為 `"package"` 或 `"file"`，`type` 為 `"repoOnly"`、`"localOnly"` 或 `"conflict"`
- `commands.repoOnly`：在 repo 但本機缺少的 command names；`localOnly`：本機有但不在 repo 的；`conflicts`：兩邊都有但內容不同的

---

## 步驟 3：顯示摘要

先顯示整體同步狀態摘要：
```
📋 同步狀態預覽：
  CLAUDE.md        — ✅ 一致
  settings.json    — ⚠️ 有差異
  Skills           — ⚠️ 有差異（詳見下方清單）
  Agents           — ⚠️ 有差異（詳見下方清單）
  Commands         — ⚠️ 有差異（詳見下方清單）
```

### 若 settings.json 有差異，顯示具體 diff

格式示例：
```
--- repo（claude/settings.json）
+++ 本機（~/.claude/settings.json）
  "theme": "dark",
- "autoSave": false,
+ "autoSave": true,
```

### 若 Skills 有差異，顯示清單

格式示例（只列有差異的項目）：
```
📋 Skills 同步詳情：
  skill                        lock    本機(~/.agents)
  ────────────────────────────────────────────────────
  typescript-types             ✅      ❌ 缺少
  my-local-skill               ❌ 缺少  ✅
```

### 若 Agents 有差異，顯示清單

格式示例（只列有差異的項目）：
```
📋 Agents 同步詳情：
  agent                                              repo    本機(~/.claude/agents)
  ────────────────────────────────────────────────────────────────────────────────
  awesome-claude-code-subagents/docker-expert        ✅      ❌ 缺少
  my-custom-package/my-agent                         ❌ 缺少  ✅
  everything-claude-code/code-reviewer               ⚠️ 衝突  ⚠️ 衝突
```

### 若 Commands 有差異，顯示清單

格式示例（只列有差異的項目）：
```
📋 Commands 同步詳情：
  command                    repo    本機(~/.claude/commands)
  ──────────────────────────────────────────────────────────
  ob.md                      ✅      ❌ 缺少
  my-command.md              ❌ 缺少  ✅
  shared-command.md          ⚠️ 衝突  ⚠️ 衝突
```

### 若全部一致

直接顯示 `✅ 同步完成（無差異）` 並結束執行，不執行步驟 4-8。

---

## 步驟 4：執行 — 設定檔同步

若 CLAUDE.md 有差異或 settings.json 有差異，對每個有差異的檔案逐一處理（無差異的檔案跳過）。

### 4.1 詢問合併方式

對每個有差異的檔案，先顯示 diff，再使用 AskUserQuestion 詢問合併方式：

- **question**: `"<檔名>" 有差異，如何處理？`
- **header**: `<檔名>`
- 選項：**以下 4 個選項缺一不可，必須全部傳入 AskUserQuestion 的 options 陣列**

#### 1. 用 repo 版（建議）
- label: `用 repo 版`
- description: `repo ✅ 本機 ⚠️ → ✅　以 claude/ 的版本覆蓋本機`
- 動作：直接以 repo 版內容作為合併結果，跳至 4.2

#### 2. 用本機版
- label: `用本機版`
- description: `repo ⚠️ → ✅ 本機 ✅　以本機版本覆蓋 repo`
- 動作：直接以本機版內容作為合併結果，跳至 4.2

#### 3. 用 VS Code 手動合併（⚠️ 此選項容易被遺漏，務必包含）
- label: `用 VS Code 手動合併`
- description: `開啟 VS Code diff editor，左側本機（唯讀），右側 repo（可編輯），關閉後繼續`
- 動作（CLAUDE.md）：
  1. 執行 `code --wait --diff ~/.claude/CLAUDE.md claude/CLAUDE.md`，阻塞等待用戶在 VS Code diff editor 中編輯右側並關閉 tab
  2. 讀取 `claude/CLAUDE.md` 內容作為合併結果
- 動作（settings.json）：
  1. 執行 `code --wait --diff ~/.claude/settings.json claude/settings.json`，阻塞等待用戶在 VS Code diff editor 中編輯右側並關閉 tab
  2. 讀取 `claude/settings.json` 內容作為合併結果

#### 4. 略過
- label: `略過`
- description: `保持現狀，跳過此檔案`
- 動作：跳過此檔案，不寫入 repo 或本機

### 4.2 寫入合併結果到 repo

- 將合併結果寫入：
  - `claude/CLAUDE.md`
  - `claude/settings.json`
- 完成後顯示 `✅ 設定已合併至 repo`

### 4.3 確認並覆蓋本機

**先判斷是否需要覆蓋**：執行 `node .claude/commands/sync-ai-apply.js --action check-same`（settings.json）或 `--file claude-md`（CLAUDE.md），若回傳 `{ "same": true }` 則顯示 `ℹ️ 本機設定已是最新，無需覆蓋` 並直接跳至步驟 5

若合併結果 ≠ 本機內容，使用 AskUserQuestion 詢問：

- **question**: `合併完成，是否將結果覆蓋到本機？`
- **header**: `覆蓋本機`
- 選項：

#### 1. 確認覆蓋（建議）
- label: `確認覆蓋（建議）`
- description: `將 repo 的合併結果複製到 ~/.claude/`
- 動作：
  1. 執行 `node .claude/commands/sync-ai-apply.js --action write-local --file claude-md` 將 `claude/CLAUDE.md` 複製到 `~/.claude/CLAUDE.md`
  2. 執行 `node .claude/commands/sync-ai-apply.js --action write-local` 將 `claude/settings.json` 寫入 `~/.claude/settings.json`
  3. 執行 `cp claude/statusline.sh ~/.claude/statusline.sh`（無條件複製，確保各裝置都有此檔案）
- 完成後顯示 `✅ 已覆蓋本機設定檔`

#### 2. 跳過
- label: `跳過，稍後手動同步`
- description: `不覆蓋本機，repo 已保存合併結果，可稍後手動複製`

---

## 步驟 5：執行 — Skills 同步

若 skills-lock.json 與全域有差異，使用 **一個 multiSelect 問題** 讓用戶勾選要執行的同步動作。

先顯示差異清單，再用 AskUserQuestion（multiSelect true）詢問：

- **question**: `Skills 有 <N> 個差異，勾選要執行的同步：`
- **header**: `Skills`
- **options**（只列出有差異的類型，最多 2 個選項）：
  - 若有 lockOnly：label `安裝 <N> 個到本機`，description `<name1>, <name2>, ...`
  - 若有 localOnly：label `加入 lock <N> 個`，description `<name1>, <name2>, ...`
- 用戶勾選的項目執行對應動作，未勾選的略過

### 執行動作

- **安裝**：`npx skills add <source> -g -y --skill <name> --agent claude-code`
- **加入 lock**：寫入 `skills-lock.json`，`source` 填 `"TODO: <owner>/<repo>"`，`sourceType: "github"`，`computedHash` 留空字串；完成後顯示 `⚠️ 請手動補充 skills-lock.json 中 <name> 的 source 欄位`

### 操作回饋

- `⏳ 安裝/加入 <skill-name>...` → `✅ <動作> <skill-name>` 或 `❌ 失敗：<skill-name>（<錯誤訊息>）`，失敗不中止流程

---

## 步驟 6：執行 — 目錄同步（Agents & Commands）

依序對 **Agents**（`claude/agents/` ↔ `~/.claude/agents/`）和 **Commands**（`claude/commands/` ↔ `~/.claude/commands/`）執行相同的目錄同步流程。以下用 `<DIR>` 代表目錄名（`agents` 或 `commands`）。

若該目錄有差異，使用 **一個 multiSelect 問題** 讓用戶勾選要執行的同步動作。

先顯示差異清單，再用 AskUserQuestion（multiSelect true）詢問：

- **question**: `<DIR> 有 <N> 個差異，勾選要執行的同步：`
- **header**: `<DIR>`
- **options**（只列出有差異的類型，最多 3 個選項）：
  - 若有 repoOnly：label `複製 <N> 個到本機`，description `repo → 本機：<item1>, <item2>, ...`
  - 若有 localOnly：label `加入 repo <N> 個`，description `本機 → repo：<item1>, <item2>, ...`
  - 若有 conflicts：label `衝突 <N> 個用 repo 版`，description `repo 覆蓋本機：<item1>, <item2>, ...`
- 用戶勾選的項目執行對應動作，未勾選的略過
- **衝突若不選 repo 版**，用戶可透過「Other」輸入指定用本機版的項目名

**Agents 特殊處理**：agents 使用步驟 2 的 `groups` 群組化結果，若整個 package 同類型差異則以 package 單位處理（`cp -r` / `rm -rf`）。Commands 為扁平結構，逐檔處理。

### 執行動作

| 類型 | 動作 |
|------|------|
| repoOnly | `mkdir -p` 目標目錄 → `cp claude/<DIR>/<item> ~/.claude/<DIR>/<item>` |
| localOnly | `cp ~/.claude/<DIR>/<item> claude/<DIR>/<item>` |
| conflicts（repo 版） | `cp claude/<DIR>/<item> ~/.claude/<DIR>/<item>` |
| conflicts（本機版） | `cp ~/.claude/<DIR>/<item> claude/<DIR>/<item>` |

### 操作回饋

- `⏳ 複製 <item>...` → `✅ <動作> <item>` 或 `❌ 失敗：<item>（<錯誤訊息>）`

---

## 步驟 7：Commit & Push

若步驟 4-6 中有任何實際寫入 repo 的操作（`claude/CLAUDE.md`、`claude/settings.json`、`skills-lock.json`、`claude/agents/`、`claude/commands/` 有檔案新增/修改/刪除），使用 AskUserQuestion 詢問：

- **question**: `repo 有變更，如何處理？`
- **header**: `Commit & Push`
- 選項：

#### 1. 自動 commit 並 push（建議）
- label: `自動 commit 並 push（建議）`
- description: `git add → commit → push，一鍵完成`
- 動作：`git add claude/ skills-lock.json && git commit -m "sync: 從 <hostname> 同步 <YYMMDDHHmm>" && git push`
- 成功後顯示 `✅ 已 push 到 remote`
- 失敗則顯示 `❌ Push 失敗：<錯誤訊息>，請手動處理`

#### 2. 自行處理
- label: `自行處理`
- description: `不執行 git 操作，稍後自行 commit 與 push`

---

## 步驟 8：完成摘要

顯示最終同步結果摘要，格式示例：
```
✅ sync-ai 完成

📋 最終狀態：
  CLAUDE.md     — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  settings.json — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  Skills        — 已安裝 2 個 / 已更新 skills-lock.json / 無差異
  Agents        — 已複製 3 個到本機 / 已加入 repo 1 個 / 無差異
  Commands      — 已複製 1 個到本機 / 已加入 repo 2 個 / 無差異
```

---

## 實作細節

- **Hostname 取得**：使用 `hostname` 指令取得裝置名稱（Windows 上 `hostname`，macOS/Linux 上 `uname -n`，或透過環境變數 `$HOSTNAME`）
- **時間戳記格式**：YYMMDDHHmm（例 2603061430）
- **比對腳本**：`.claude/commands/sync-ai-diff.js` 負責所有比對邏輯（LCS diff、JSON deep compare、skills 解析、agents 掃描與群組化）
- **套用腳本**：`.claude/commands/sync-ai-apply.js` 負責寫入操作，以 `--action` 指定動作，`--file` 指定檔案（預設 `settings-json`，可用 `claude-md`）：
  - `check-same`：比對 repo 與本機內容是否相同，回傳 `{ "same": bool }`
  - `write-local`：將 repo 合併結果寫入本機
- **skills-lock.json 格式**：
  ```json
  {
    "version": 1,
    "skills": {
      "<skill-name>": {
        "source": "<owner>/<repo>",
        "sourceType": "github",
        "computedHash": ""
      }
    }
  }
  ```
  加入 lock 時，`source` 填入 `"TODO: <owner>/<repo>"` 佔位，並提示用戶事後手動補充。`computedHash` 留空字串（無法自動計算，不影響安裝）
- **Agents 路徑**：使用相對路徑（如 `awesome-claude-code-subagents/backend-developer.md`）；複製前若目標目錄不存在自動 `mkdir -p`
- **Commands 路徑**：`claude/commands/` ↔ `~/.claude/commands/`，扁平結構（不需 package 群組化）；複製前若目標目錄不存在自動 `mkdir -p`
