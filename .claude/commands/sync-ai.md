執行 Claude Code 設定與 skills 統一同步流程：

## 步驟 1：事前準備（Git Fetch）

執行 `git fetch` 取得 remote 最新資訊。

**若 `git fetch` 失敗**（無網路、remote 不可達）：顯示 `⚠️ git fetch 失敗：<錯誤訊息>`，繼續用現有 repo 狀態執行。

若 remote 有新 commit，直接執行 `git pull --ff-only`，依結果處理：

- **成功**：顯示 `✅ 已 pull 最新 commit`，繼續執行
- **失敗**：顯示 `⚠️ Pull 失敗：<錯誤訊息>`，繼續用本機狀態執行

---

## 步驟 2：比對階段

### 設定檔比對

- **CLAUDE.md**：比對 `~/.claude/CLAUDE.md` 與 `claude/CLAUDE.md` 的完整內容
- **settings.json**：載入兩邊 JSON，移除裝置特定欄位（`model`、`effortLevel`、`statusLine`）後比較

### Skills 比對

1. 讀取 `skills-lock.json`；若檔案不存在，視為空清單（`{ "version": 1, "skills": {} }`）繼續執行
2. 執行 `npx skills list -g --agent claude-code` 取得**全域** skills（`~/.agents/skills/`）
3. 比對差異，分類為：
   - lock 有、全域缺少的 skills（新機器需補裝）
   - 全域有、lock 缺少的 skills（本機新增，可更新 lock 或忽略）

### Agents 比對

1. 遞迴掃描 `claude/agents/` 所有 `.md` 檔案，記錄相對路徑（如 `awesome-claude-code-subagents/backend-developer.md`）
2. 遞迴掃描 `~/.claude/agents/` 所有 `.md` 檔案，記錄相對路徑；**若目錄不存在，視為空清單（本機無任何 agent），跳過掃描**
3. 比對差異，分類為：
   - repo 有、本機缺少（需複製到本機）
   - 本機有、repo 缺少（本機新增，可加入 repo 或刪除）
   - 兩邊都有但內容不同（衝突）
4. **群組化**：某 package 下所有差異同屬一種類型（全部「repo 有本機無」或全部「本機有 repo 無」）且無任何衝突時，以整個 package 為單位詢問一次；否則逐檔詢問。

---

## 步驟 3：顯示摘要

先顯示整體同步狀態摘要：
```
📋 同步狀態預覽：
  CLAUDE.md        — ✅ 一致
  settings.json    — ⚠️ 有差異
  Skills           — ⚠️ 有差異（詳見下方清單）
  Agents           — ⚠️ 有差異（詳見下方清單）
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

### 若全部一致

直接顯示 `✅ 同步完成（無差異）` 並結束執行，不執行步驟 4-8。

---

## 步驟 4：執行 — 設定檔同步

若 CLAUDE.md 有差異或 settings.json 有差異，進行以下操作（無差異的檔案跳過）：

### 4.1 用 vim 手動合併

#### CLAUDE.md

1. 建立暫存檔（Windows: `$TEMP/claude-merge-CLAUDE.md`，macOS/Linux: `/tmp/claude-merge-CLAUDE.md`）
2. 將兩版本合併寫入暫存檔：
   - 無差異行直接寫入
   - 差異 hunk 以標準 git 衝突標記格式寫入：
     ```
     <<<<<<< repo (claude/CLAUDE.md)
     <repo 版本行>
     =======
     <本機版本行>
     >>>>>>> local (~/.claude/CLAUDE.md)
     ```
3. 執行 `vim <暫存檔路徑>`，同步阻塞等待用戶編輯完成存檔離開
4. 讀取暫存檔內容作為合併結果
5. 刪除暫存檔

#### settings.json

1. 建立兩個暫存檔（移除裝置特定欄位後）：
   - `$TEMP/settings-repo.json`：repo 版（`claude/settings.json`）
   - `$TEMP/settings-local.json`：本機版（`~/.claude/settings.json`）
2. 執行 `vim -d $TEMP/settings-repo.json $TEMP/settings-local.json`（vimdiff 兩欄對比），同步阻塞等待用戶編輯完成離開
3. 讀取 `$TEMP/settings-repo.json`（左欄）作為合併結果
4. 刪除兩個暫存檔

### 4.2 寫入合併結果到 repo

- 將 vim 編輯後的合併結果寫入：
  - `claude/CLAUDE.md`
  - `claude/settings.json`（**裝置特定欄位 `model`、`effortLevel`、`statusLine` 不寫入 repo**）
- 完成後顯示 `✅ 設定已合併至 repo`

### 4.3 確認並覆蓋本機

**先判斷是否需要覆蓋**：比對合併結果與本機現有內容是否相同。
- 若合併結果 === 本機內容：顯示 `ℹ️ 本機設定已是最新，無需覆蓋` 並直接跳至步驟 5

若合併結果 ≠ 本機內容，使用 AskUserQuestion 詢問：

- **question**: `合併完成，是否將結果覆蓋到本機？`
- **header**: `覆蓋本機`
- 選項：

#### 1. 確認覆蓋（建議）
- label: `確認覆蓋（建議）`
- description: `將 repo 的合併結果複製到 ~/.claude/（裝置特定欄位保持本機值不變）`
- 動作：
  1. 複製 `claude/CLAUDE.md` 到 `~/.claude/CLAUDE.md`
  2. 讀取 `claude/settings.json` 合併結果，再從本機 `~/.claude/settings.json` 取出 `model`、`effortLevel`、`statusLine` 的現有值，注入回合併結果後，寫入 `~/.claude/settings.json`（確保裝置特定欄位不遺失）
- 完成後顯示 `✅ 已覆蓋本機設定檔`

#### 2. 跳過
- label: `跳過，稍後手動同步`
- description: `不覆蓋本機，repo 已保存合併結果，可稍後手動複製`

---

## 步驟 5：執行 — Skills 同步

若 skills-lock.json 與全域有差異，先顯示 `📋 Skills 差異（共 <N> 個），逐一處理：`，再對每個有差異的 skill 逐一詢問（使用 AskUserQuestion，multiSelect false）。

### 5.1 lock 有、本機缺少的 skill

- **question**: `"<skill-name>" 在 lock 中但本機未安裝，如何處理？`
- **header**: `<skill-name>`
- 選項（repo/安裝 排第一）：

#### 1. 安裝到本機（同步）
- label: `安裝到本機（同步）`
- description: `lock ✅ → 本機 ❌ → ✅　安裝此 skill 到 ~/.agents/`

#### 2. 從 lock 移除
- label: `從 lock 移除`
- description: `lock ✅ → ❌　從 skills-lock.json 刪除，本機不安裝`

#### 3. 略過
- label: `略過`
- description: `lock ✅ 本機 ❌　保持現狀`

- 執行動作：
  - 安裝：`npx skills add <source> -g -y --skill <name> --agent claude-code`
  - 從 lock 移除：更新 `skills-lock.json`，刪除對應 key

### 5.2 本機有、lock 缺少的 skill

- **question**: `"<skill-name>" 已安裝但不在 lock 中，如何處理？`
- **header**: `<skill-name>`
- 選項（加入 lock 排第一）：

#### 1. 加入 lock（同步）
- label: `加入 lock（同步）`
- description: `lock ❌ → ✅ 本機 ✅　寫入 skills-lock.json 供其他裝置同步`

#### 2. 從本機刪除
- label: `從本機刪除`
- description: `lock ❌ 本機 ✅ → ❌　從 ~/.agents/ 移除此 skill`

#### 3. 略過
- label: `略過`
- description: `lock ❌ 本機 ✅　保持現狀`

- 執行動作：
  - 加入 lock：將 skill 寫入 `skills-lock.json`，`source` 填入 `"TODO: <owner>/<repo>"`，`sourceType: "github"`，`computedHash` 留空字串；完成後顯示 `⚠️ 請手動補充 skills-lock.json 中 <name> 的 source 欄位（格式：<owner>/<repo>）`
  - 從本機刪除：`npx skills remove <name> -g -y`

- 操作回饋：
  - 安裝中：`⏳ 安裝 <skill-name>...`
  - 刪除中：`⏳ 刪除 <skill-name>...`
  - 成功：`✅ <動作> <skill-name>`
  - 失敗：`❌ 失敗：<skill-name>（<錯誤訊息>）`，顯示後繼續處理下一個 skill（不中止整個流程）

---

## 步驟 6：執行 — Agents 同步

若 `claude/agents/` 與 `~/.claude/agents/` 有差異，先顯示 `📋 Agents 差異（共 <N> 項），逐一處理：`，再依步驟 2 群組化結果逐一詢問（使用 AskUserQuestion，multiSelect false）。

### 6.1 repo 有、本機缺少的 agent（或整個 package）

- **question**（package 單位）: `"<package-name>/" package 在 repo 中但本機缺少，如何處理？`
- **question**（單一檔案）: `"<package/agent-name>" 在 repo 中但本機缺少，如何處理？`
- **header**: `<package-name>` 或 `<package/agent-name>`
- 選項（複製到本機 排第一）：

#### 1. 複製到本機（同步）
- label: `複製到本機（同步）`
- description: `repo ✅ → 本機 ❌ → ✅　將 repo 的 agent 複製到 ~/.claude/agents/`
- 動作：
  - package 單位：`cp -r claude/agents/<package-name>/ ~/.claude/agents/<package-name>/`（若 `~/.claude/agents/` 不存在先 `mkdir -p`）
  - 單一檔案：`cp claude/agents/<path>.md ~/.claude/agents/<path>.md`（確保目標目錄存在，`mkdir -p`）

#### 2. 從 repo 移除
- label: `從 repo 移除`
- description: `repo ✅ → ❌ 本機 ❌　從 claude/agents/ 刪除，本機不新增`
- 動作：刪除 `claude/agents/<path>` 對應檔案或目錄

#### 3. 略過
- label: `略過`
- description: `repo ✅ 本機 ❌　保持現狀`

### 6.2 本機有、repo 缺少的 agent（或整個 package）

- **question**（package 單位）: `"<package-name>/" package 已安裝但不在 repo 中，如何處理？`
- **question**（單一檔案）: `"<package/agent-name>" 已安裝但不在 repo 中，如何處理？`
- **header**: `<package-name>` 或 `<package/agent-name>`
- 選項（加入 repo 排第一）：

#### 1. 加入 repo（同步）
- label: `加入 repo（同步）`
- description: `repo ❌ → ✅ 本機 ✅　將本機 agent 複製到 claude/agents/`
- 動作：
  - package 單位：`cp -r ~/.claude/agents/<package-name>/ claude/agents/<package-name>/`
  - 單一檔案：`cp ~/.claude/agents/<path>.md claude/agents/<path>.md`

#### 2. 從本機刪除
- label: `從本機刪除`
- description: `repo ❌ 本機 ✅ → ❌　從 ~/.claude/agents/ 移除此 agent`
- 動作：
  - package 單位：`rm -rf ~/.claude/agents/<package-name>/`
  - 單一檔案：`rm ~/.claude/agents/<path>.md`；刪除後若 package 目錄已空，自動 `rm -rf ~/.claude/agents/<package-name>/`

#### 3. 略過
- label: `略過`
- description: `repo ❌ 本機 ✅　保持現狀`

### 6.3 兩邊都有但內容不同的 agent

顯示 diff 後再詢問：

```
📌 <package/agent-name> 差異：
- <只在 repo 的行...>
+ <只在本機的行...>
（最多顯示 10 行差異，超過則顯示「...共 N 行差異」）
```

- **question**: `"<package/agent-name>" 內容不同，保留哪個版本？`
- **header**: `<package/agent-name>`
- 選項（repo 版 排第一）：

#### 1. 用 repo 版（同步到本機）
- label: `用 repo 版`
- description: `repo ✅ 本機 ⚠️ → ✅　以 claude/agents/ 的版本覆蓋本機`
- 動作：`cp claude/agents/<path>.md ~/.claude/agents/<path>.md`

#### 2. 用本機版（同步到 repo）
- label: `用本機版`
- description: `repo ⚠️ → ✅ 本機 ✅　以本機版本覆蓋 repo`
- 動作：`cp ~/.claude/agents/<path>.md claude/agents/<path>.md`

#### 3. 略過
- label: `略過`
- description: `repo ⚠️ 本機 ⚠️　保持現狀`

- 操作回饋：
  - 複製中：`⏳ 複製 <path>...`
  - 成功：`✅ <動作> <path>`
  - 失敗：`❌ 失敗：<path>（<錯誤訊息>）`

---

## 步驟 7：Commit & Push

若步驟 4-6 中有任何實際寫入 repo 的操作（`claude/CLAUDE.md`、`claude/settings.json`、`skills-lock.json`、`claude/agents/` 有檔案新增/修改/刪除），使用 AskUserQuestion 詢問：

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
```

---

## 實作細節

- **Hostname 取得**：使用 `hostname` 指令取得裝置名稱（Windows 上 `hostname`，macOS/Linux 上 `uname -n`，或透過環境變數 `$HOSTNAME`）
- **時間戳記格式**：YYMMDDHHmm（例 2603061430）
- **json 比對**：用 `Read` 工具讀取兩個 JSON 檔，在 context 中 parse 後逐欄位比對（deep comparison）：
  1. 移除裝置特定欄位（`model`、`effortLevel`、`statusLine`）
  2. 逐 key 遞迴比較所有欄位值
  3. **key 順序差異不視為差異**（只比較值）
  4. 陣列欄位：以項目集合比較（找出只在一邊的項目），順序不同不視為差異
  5. `null`、`{}`、`[]` 視為不同的值，不自動轉換
- **`npx skills list -g` 輸出格式**（純文字，無 JSON 選項）：
  ```
  <群組名稱>（粗體）
    <skill-name>  ~/.agents/skills/<skill-name>
      Agents: Claude Code   （或 "not linked"）
  ```
  輸出**不包含 source 資訊**。加入 lock 時，`source` 填入 `"TODO: <owner>/<repo>"` 佔位，並提示用戶事後手動補充
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
  `computedHash` 留空字串（無法自動計算，不影響安裝）
- **Agents**：使用相對路徑比對（如 `awesome-claude-code-subagents/backend-developer.md`）；複製前若目標目錄不存在自動 `mkdir -p`
