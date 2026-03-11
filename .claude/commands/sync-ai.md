執行 Claude Code 設定與 skills 統一同步流程：

## 步驟 1：事前準備（Git Fetch）

執行 `git fetch` 取得 remote 最新資訊。

**若 `git fetch` 失敗**（無網路、remote 不可達）：顯示警告 `⚠️ git fetch 失敗：<錯誤訊息>`，並使用 AskUserQuestion 詢問是否繼續：
- 選項 1：`繼續（用現有 repo 狀態）` — 跳過 fetch，繼續執行後續比對
- 選項 2：`中止` — 停止執行

若 remote 有新 commit，使用 AskUserQuestion 詢問：

- **question**: `Remote 有 <N> 個新 commit，是否同步？`
- **header**: `Git Pull`
- 選項：

#### 1. Pull 並更新（建議）
- label: `Pull 並更新（建議）`
- description: `執行 git pull --ff-only，取得 remote 最新設定後繼續`
- preview:
  ```
  動作：git pull --ff-only

  remote 有新 commit（fast-forward 可合併）
  ├ 設定檔可能更新
  └ 繼續執行後續比對
  ```
- 動作：執行 `git pull --ff-only`
- 若 pull 失敗：
  - 若錯誤訊息包含 `not possible to fast-forward`（本機有超前 commit）：顯示 `⚠️ Pull 失敗：本機有未 push 的 commit，無法 fast-forward。請手動解決後重新執行，或選擇「繼續用本機版本」繼續比對`，並提供選項：
    - `繼續用本機版本` — 以現有 repo 狀態繼續（等同「略過」）
    - `中止` — 停止執行
  - 其他失敗：顯示 `❌ Pull 失敗：<錯誤訊息>` 並停止執行

#### 2. 略過
- label: `略過，繼續用本機版本`
- description: `不拉取，以本機現有 repo 狀態繼續比對`
- preview:
  ```
  動作：不執行 pull

  remote 的新 commit 不會套用
  └ 繼續用本機現有 repo 內容比對
  ```

---

## 步驟 2：比對階段（Dry-run 預覽）

### 設定檔比對

- **CLAUDE.md**：比對 `~/.claude/CLAUDE.md` 與 `claude/CLAUDE.md` 的完整內容
- **settings.json**：載入兩邊 JSON，移除裝置特定欄位（`model`、`effortLevel`、`statusLine`）後比較
  - 若有差異，將兩邊 JSON 內容（忽略指定欄位）轉成 diff 格式供後續顯示

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
4. **群組化**：若某 package 目錄下的**所有差異檔案**都處於完全相同的狀態（全部為「repo 有本機無」、或全部為「本機有 repo 無」），**且該 package 內無任何衝突項目**，以整個 package 為單位詢問一次；否則逐一詢問每個差異檔案

---

## 步驟 3：顯示摘要（Dry-run 預覽）

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

**注意**：diff 方向為 `-` 表示 repo（`claude/`）、`+` 表示本機（`~/.claude/`）

### 若 Skills 有差異，顯示清單

格式示例：
```
📋 Skills 同步詳情：
  skill                        lock    本機(~/.agents)
  ────────────────────────────────────────────────────
  frontend-design              ✅      ✅
  typescript-types             ✅      ❌ 缺少
  my-local-skill               ❌ 缺少  ✅
```

### 若 Agents 有差異，顯示清單

格式示例：
```
📋 Agents 同步詳情：
  agent                                              repo    本機(~/.claude/agents)
  ────────────────────────────────────────────────────────────────────────────────
  awesome-claude-code-subagents/backend-developer    ✅      ✅
  awesome-claude-code-subagents/docker-expert        ✅      ❌ 缺少
  everything-claude-code/architect                   ✅      ✅
  my-custom-package/my-agent                         ❌ 缺少  ✅
  everything-claude-code/code-reviewer               ⚠️ 衝突  ⚠️ 衝突
```

### 若全部一致

直接顯示：
```
✅ 同步完成（無差異）
```

然後**直接結束執行**，不執行步驟 4-8，不再詢問任何操作。

---

## 步驟 4：執行 — 設定檔同步（Smart Merge）

若有設定檔差異（CLAUDE.md 或 settings.json），進行以下操作：

### 4.1 偵測並分析衝突

**條件判斷**：
- 若 CLAUDE.md 無差異 → 跳過 CLAUDE.md 衝突分析與詢問
- 若 settings.json 無差異 → 跳過 settings.json 衝突分析與詢問

#### CLAUDE.md 衝突分析
- 逐行比對 repo `claude/CLAUDE.md` 與本機 `~/.claude/CLAUDE.md`
- 將相鄰差異行（間距 ≤ 3 行）合併為同一個 hunk，列出所有 hunk（包含上下文）：
  ```
  📌 CLAUDE.md 差異（共 2 個區塊）：

  區塊 1（第 5-5 行）：
    4  此檔案定義所有專案通用的全域規則與慣例。
  - 5  ## 語言規範（claude/CLAUDE.md）
  + 5  ## Language Rules（~/.claude/CLAUDE.md）
    6  （空行）

  區塊 2（第 13-15 行）：
    12  （空行）
  - 13  - `npm run build` / `yarn build` / `pnpm build`
  - 14  - `npm run docs:build` 或其他類似構建命令
  + 13  - `npm build` / `yarn build`
    15  （空行）
  ```

#### settings.json 衝突分析
- 載入 repo `claude/settings.json` 和本機 `~/.claude/settings.json` JSON
- 移除裝置特定欄位（`model`、`effortLevel`、`statusLine`）
- 對每個差異欄位，根據值的型別進行分析：
  - **純量值**（string、number、boolean、object）：整個值視為一個差異
  - **陣列值**（array）：逐項比較，列出各個差異項目
- 列出所有差異（含陣列內差異項目）：
  ```
  📌 settings.json 差異（已排除 model、effortLevel、statusLine）：
    • autoSave：claude/ 為 false | ~/.claude/ 為 true
    • permissions.allow（陣列）：
      - "Bash(find*)"    只在 repo
      + "Bash(tr:*)"     只在本機
      + "Bash(wc:*)"     只在本機
  ```

### 4.2 逐項詢問衝突

#### CLAUDE.md 衝突解決

對每個 hunk 詢問一次（使用 AskUserQuestion，multiSelect false）：

- **question**: `第 <start>-<end> 行（區塊 <N>/<total>）衝突，保留哪個版本？`
- **header**: `區塊 <N>`
- 選項：

**選項順序固定**：repo 版永遠排第一，本機版排第二，不隨建議變動。若某版本為建議，在其 label 加上 `（建議）`。

##### 選項 A：用 repo 版
- label: `用 repo 版` 或 `用 repo 版（建議）`
- description: `claude/CLAUDE.md 的內容`
- preview:
  ```
  （顯示 hunk 前 2 行 context）
  - <repo 版差異行...>    ← 保留此區塊
  （顯示 hunk 後 2 行 context）
  ```

##### 選項 B：用本機版
- label: `用本機版` 或 `用本機版（建議）`
- description: `~/.claude/CLAUDE.md 的內容`
- preview:
  ```
  （顯示 hunk 前 2 行 context）
  + <本機版差異行...>    ← 保留此區塊
  （顯示 hunk 後 2 行 context）
  ```

- 詢問順序：按 hunk 起始行號遞增
- hunk 內所有行一起替換，不拆分逐行詢問
- 無差異行：自動保留（不詢問）

#### settings.json 衝突解決

根據欄位型別採用不同策略：

##### 純量欄位（string、number、boolean、object）

對每個差異欄位詢問一次（使用 AskUserQuestion，multiSelect false）：

- **question**: `"<key>" 欄位衝突，保留哪個值？`
- **header**: `<key>`
- 選項：

**選項順序固定**：repo 值永遠排第一，本機值排第二，不隨建議變動。若某值為建議，在其 label 加上 `（建議）`。

###### 選項 A：用 repo 值
- label: `用 repo 值` 或 `用 repo 值（建議）`
- description: `claude/settings.json 的值`
- preview:
  ```
  {
    ...
    "<key>": <repo_value>     ← 保留此值（repo）
    ...
  }
  ```

###### 選項 B：用本機值
- label: `用本機值` 或 `用本機值（建議）`
- description: `~/.claude/settings.json 的值`
- preview:
  ```
  {
    ...
    "<key>": <local_value>    ← 保留此值（本機）
    ...
  }
  ```

- 只有 repo 有的 key：自動保留 repo 值（不詢問）
- 只有本機有的 key：自動加入合併結果（不詢問）

##### 陣列欄位（array）

對陣列中每個差異項目逐一詢問（使用 AskUserQuestion，multiSelect false）：

**只在 repo 的項目**

- **question**: `"<item>" 只在 repo 的 <key> 中，如何處理？`
- **header**: `<key>`
- 選項：

###### 選項 A：保留（建議）
- label: `保留（建議）`
- description: `納入合併結果，repo 與本機皆保有此項目`
- preview:
  ```
  "<key>": [
    ...
    "<item>"    ← 保留（repo 有，本機將同步）
    ...
  ]
  ```

###### 選項 B：移除
- label: `移除`
- description: `從合併結果移除，repo 與本機皆刪除此項目`
- preview:
  ```
  "<key>": [
    ...
    // "<item>" 已移除
    ...
  ]
  ```

**只在本機的項目**

- **question**: `"<item>" 只在本機的 <key> 中，如何處理？`
- **header**: `<key>`
- 選項：

###### 選項 A：保留（建議）
- label: `保留（建議）`
- description: `納入合併結果，repo 與本機皆保有此項目`
- preview:
  ```
  "<key>": [
    ...
    "<item>"    ← 保留（本機有，repo 將同步）
    ...
  ]
  ```

###### 選項 B：移除
- label: `移除`
- description: `從合併結果移除，repo 與本機皆刪除此項目`
- preview:
  ```
  "<key>": [
    ...
    // "<item>" 已移除
    ...
  ]
  ```

- 兩邊都有的項目：自動保留（不詢問）
- 合併後陣列順序：先保留兩邊共有的（依 repo 順序），再附加選擇保留的新增項目

### 4.3 寫入合併結果到 repo

- 根據上述選擇，將合併後的內容寫入：
  - `claude/CLAUDE.md`（按行合併）
  - `claude/settings.json`（按欄位合併；**裝置特定欄位 `model`、`effortLevel`、`statusLine` 不寫入 repo**，只保留在本機）
- 顯示最終合併結果供確認：
  ```
  ✅ 設定已合併至 repo

  合併結果（CLAUDE.md）：
  ─── 摘要 ───
  第 5 行：## 語言規範（選本機版）
  第 8 行：**一律使用繁體中文**撰寫所有內容（選 repo 版）
  第 15 行：`npm run build` / `yarn build` / `pnpm build`（選 repo 版）

  合併結果（settings.json）：
  {
    "theme": "light",     ← ~/.claude/
    "autoSave": false,    ← claude/
    "model": "claude-opus-4-6",  ← ~/.claude/（裝置特定，保留）
    ...
  }
  ```

### 4.4 確認並覆蓋本機

**先判斷是否需要覆蓋**：比對合併結果與本機現有內容是否相同。
- 若合併結果 === 本機內容：顯示 `ℹ️ 本機設定已是最新，無需覆蓋` 並直接跳至步驟 5

若合併結果 ≠ 本機內容，使用 AskUserQuestion 詢問：

- **question**: `合併完成，是否將結果覆蓋到本機？`
- **header**: `覆蓋本機`
- 選項：

#### 1. 確認覆蓋（建議）
- label: `確認覆蓋（建議）`
- description: `將 repo 的合併結果複製到 ~/.claude/`
- preview:
  ```
  覆蓋以下檔案：

  claude/CLAUDE.md（已合併）      → ~/.claude/CLAUDE.md
  claude/settings.json（已合併）  → ~/.claude/settings.json

  裝置特定欄位（model、effortLevel、statusLine）保持本機值不變
  ```
- 動作：
  1. 複製 `claude/CLAUDE.md` 到 `~/.claude/CLAUDE.md`
  2. 讀取 `claude/settings.json` 合併結果，再從本機 `~/.claude/settings.json` 取出 `model`、`effortLevel`、`statusLine` 的現有值，注入回合併結果後，寫入 `~/.claude/settings.json`（確保裝置特定欄位不遺失）
- 完成後顯示 `✅ 已覆蓋本機設定檔`

#### 2. 跳過
- label: `跳過，稍後手動同步`
- description: `不覆蓋本機，repo 已保存合併結果，可自行複製`
- preview:
  ```
  本機檔案保持不變：

  ~/.claude/CLAUDE.md      （未更動）
  ~/.claude/settings.json  （未更動）

  repo 的合併結果已寫入 claude/，可稍後手動複製
  ```

---

## 步驟 5：執行 — Skills 同步

若 skills-lock.json 與全域有差異，**對每個有差異的 skill 逐一詢問**（使用 AskUserQuestion，multiSelect false）。

先顯示差異摘要：
```
📋 Skills 差異（共 <N> 個），逐一處理：
```

### 5.1 lock 有、本機缺少的 skill

- **question**: `"<skill-name>" 在 lock 中但本機未安裝，如何處理？`
- **header**: `<skill-name>`
- 選項（repo/安裝 排第一）：

#### 1. 安裝到本機（同步）
- label: `安裝到本機（同步）`
- description: `從 lock 的 source 安裝此 skill 到 ~/.agents/`
- preview:
  ```
  動作：安裝

  npx skills add <source> -g -y --skill <name> --agent claude-code

  安裝後：
  lock    ✅
  本機    ❌ → ✅
  ```

#### 2. 從 lock 移除
- label: `從 lock 移除`
- description: `將此 skill 從 skills-lock.json 中刪除，本機不安裝`
- preview:
  ```
  動作：從 lock 移除

  lock    ✅ → ❌
  本機    ❌（不安裝）
  ```

#### 3. 略過
- label: `略過`
- description: `保持現狀，lock 保留但本機不安裝`
- preview:
  ```
  動作：不處理

  lock    ✅（保留）
  本機    ❌（不安裝）
  ```

- 執行動作：
  - 安裝：`npx skills add <source> -g -y --skill <name> --agent claude-code`
  - 從 lock 移除：更新 `skills-lock.json`，刪除對應 key
  - 略過：不執行任何操作

### 5.2 本機有、lock 缺少的 skill

- **question**: `"<skill-name>" 已安裝但不在 lock 中，如何處理？`
- **header**: `<skill-name>`
- 選項（加入 lock 排第一）：

#### 1. 加入 lock（同步）
- label: `加入 lock（同步）`
- description: `將此 skill 寫入 skills-lock.json，供其他裝置同步`
- preview:
  ```
  動作：加入 lock

  lock    ❌ → ✅
  本機    ✅（保留）
  ```

#### 2. 從本機刪除
- label: `從本機刪除`
- description: `從 ~/.agents/ 移除此 skill，lock 不新增`
- preview:
  ```
  動作：刪除本機

  npx skills remove <name> -g --agent claude-code

  lock    ❌（不新增）
  本機    ✅ → ❌
  ```

#### 3. 略過
- label: `略過`
- description: `保持現狀，本機保留但不加入 lock`
- preview:
  ```
  動作：不處理

  lock    ❌（不新增）
  本機    ✅（保留）
  ```

- 執行動作：
  - 加入 lock：從 `npx skills list -g --agent claude-code` 輸出中找到對應 skill 的 source 資訊，以 `skills-lock.json` 格式寫入（見實作細節）
  - 從本機刪除：`npx skills remove <name> -g --agent claude-code`
  - 略過：不執行任何操作

- 操作回饋：
  - 安裝中：`⏳ 安裝 <skill-name>...`
  - 刪除中：`⏳ 刪除 <skill-name>...`
  - 成功：`✅ <動作> <skill-name>`
  - 失敗：`❌ 失敗：<skill-name>（<錯誤訊息>）`

---

## 步驟 6：執行 — Agents 同步

若 `claude/agents/` 與 `~/.claude/agents/` 有差異，對每個差異項目逐一詢問（使用 AskUserQuestion，multiSelect false）。

**群組化規則**：若某 package 目錄（如 `awesome-claude-code-subagents/`）下的**所有差異檔案**都處於完全相同的狀態（全部為「repo 有本機無」、或全部為「本機有 repo 無」），**且該 package 內無任何衝突項目**，以整個 package 為單位詢問一次；否則逐一詢問每個差異檔案。

先顯示差異摘要：
```
📋 Agents 差異（共 <N> 項），逐一處理：
```

### 6.1 repo 有、本機缺少的 agent（或整個 package）

- **question**（package 單位）: `"<package-name>/" package 在 repo 中但本機缺少，如何處理？`
- **question**（單一檔案）: `"<package/agent-name>" 在 repo 中但本機缺少，如何處理？`
- **header**: `<package-name>` 或 `<package/agent-name>`
- 選項（複製到本機 排第一）：

#### 1. 複製到本機（同步）
- label: `複製到本機（同步）`
- description: `將 repo 的 agent 複製到 ~/.claude/agents/`
- preview（package 單位）:
  ```
  動作：複製整個 package

  claude/agents/<package-name>/  →  ~/.claude/agents/<package-name>/
  （共 <N> 個 agent 檔案）

  repo    ✅
  本機    ❌ → ✅
  ```
- preview（單一檔案）:
  ```
  動作：複製檔案

  claude/agents/<path>.md  →  ~/.claude/agents/<path>.md

  repo    ✅
  本機    ❌ → ✅
  ```
- 動作：
  - package 單位：`cp -r claude/agents/<package-name>/ ~/.claude/agents/<package-name>/`（若 `~/.claude/agents/` 不存在先 `mkdir -p`）
  - 單一檔案：`cp claude/agents/<path>.md ~/.claude/agents/<path>.md`（確保目標目錄存在，`mkdir -p`）

#### 2. 從 repo 移除
- label: `從 repo 移除`
- description: `將此 agent 從 claude/agents/ 中刪除，本機不新增`
- preview:
  ```
  動作：從 repo 移除

  repo    ✅ → ❌
  本機    ❌（不新增）
  ```
- 動作：刪除 `claude/agents/<path>` 對應檔案或目錄

#### 3. 略過
- label: `略過`
- description: `保持現狀，repo 保留但本機不新增`
- preview:
  ```
  動作：不處理

  repo    ✅（保留）
  本機    ❌（不新增）
  ```

### 6.2 本機有、repo 缺少的 agent（或整個 package）

- **question**（package 單位）: `"<package-name>/" package 已安裝但不在 repo 中，如何處理？`
- **question**（單一檔案）: `"<package/agent-name>" 已安裝但不在 repo 中，如何處理？`
- **header**: `<package-name>` 或 `<package/agent-name>`
- 選項（加入 repo 排第一）：

#### 1. 加入 repo（同步）
- label: `加入 repo（同步）`
- description: `將本機 agent 複製到 claude/agents/，供其他裝置同步`
- preview（package 單位）:
  ```
  動作：加入整個 package

  ~/.claude/agents/<package-name>/  →  claude/agents/<package-name>/
  （共 <N> 個 agent 檔案）

  repo    ❌ → ✅
  本機    ✅（保留）
  ```
- 動作：
  - package 單位：`cp -r ~/.claude/agents/<package-name>/ claude/agents/<package-name>/`
  - 單一檔案：`cp ~/.claude/agents/<path>.md claude/agents/<path>.md`

#### 2. 從本機刪除
- label: `從本機刪除`
- description: `從 ~/.claude/agents/ 移除此 agent，repo 不新增`
- preview:
  ```
  動作：刪除本機

  repo    ❌（不新增）
  本機    ✅ → ❌
  ```
- 動作：
  - package 單位：`rm -rf ~/.claude/agents/<package-name>/`
  - 單一檔案：`rm ~/.claude/agents/<path>.md`

#### 3. 略過
- label: `略過`
- description: `保持現狀，本機保留但不加入 repo`
- preview:
  ```
  動作：不處理

  repo    ❌（不新增）
  本機    ✅（保留）
  ```

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
- description: `以 claude/agents/ 的版本覆蓋本機`
- preview:
  ```
  動作：覆蓋本機

  claude/agents/<path>.md  →  ~/.claude/agents/<path>.md

  repo    ✅（保留）
  本機    ⚠️ → ✅（更新）
  ```
- 動作：`cp claude/agents/<path>.md ~/.claude/agents/<path>.md`

#### 2. 用本機版（同步到 repo）
- label: `用本機版`
- description: `以本機版本覆蓋 repo`
- preview:
  ```
  動作：覆蓋 repo

  ~/.claude/agents/<path>.md  →  claude/agents/<path>.md

  repo    ⚠️ → ✅（更新）
  本機    ✅（保留）
  ```
- 動作：`cp ~/.claude/agents/<path>.md claude/agents/<path>.md`

#### 3. 略過
- label: `略過`
- description: `保持現狀，不覆蓋任何一方`
- preview:
  ```
  動作：不處理

  repo    ⚠️（保留原版）
  本機    ⚠️（保留原版）
  ```

- 操作回饋：
  - 複製中：`⏳ 複製 <path>...`
  - 成功：`✅ <動作> <path>`
  - 失敗：`❌ 失敗：<path>（<錯誤訊息>）`

---

## 步驟 7：Commit & Push

若有任何 repo 變更（設定檔、skills-lock.json 或 claude/agents/），使用 AskUserQuestion 詢問：

- **question**: `repo 有變更，如何處理？`
- **header**: `Commit & Push`
- 選項：

#### 1. 自動 commit 並 push（建議）
- label: `自動 commit 並 push（建議）`
- description: `git add → commit → push，一鍵完成`
- preview: 根據變更內容動態產生，格式：
  ```
  git add claude/ skills-lock.json

  commit 訊息：
  sync: 從 <hostname> 同步設定 <YYMMDDHHmm>

  變更檔案：
  ├ claude/CLAUDE.md        （已更新）
  ├ claude/settings.json    （已更新）
  ├ claude/agents/          （已更新）
  └ skills-lock.json        （已更新）

  然後 git push → origin/main
  ```
  若只有 agents 變更，commit 訊息改為：
  `sync: 從 <hostname> 同步 agents <YYMMDDHHmm>`
  若只有 skills 變更，commit 訊息改為：
  `sync: 從 <hostname> 同步 skills <YYMMDDHHmm>`
- 成功後顯示 `✅ 已 push 到 remote`
- 失敗則顯示 `❌ Push 失敗：<錯誤訊息>，請手動處理`

#### 2. 自行處理
- label: `自行處理`
- description: `不執行 git 操作，稍後自行 commit 與 push`
- preview:
  ```
  不執行任何 git 操作

  請自行執行：
  git add claude/ skills-lock.json
  git commit -m "sync: 從 <hostname> 同步設定 <YYMMDDHHmm>"
  git push
  ```

---

## 步驟 8：完成摘要

若有任何操作執行過，顯示最終同步結果摘要，格式示例：
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
- **json 比對**：忽略 `model`、`effortLevel`、`statusLine` 欄位（裝置特定設定），比較其他所有鍵值。**比對方式：直接用 `Read` 工具讀取兩個檔案，在 context 內比對**，不要寫腳本或用 `node -e`（在 Windows 環境下不可靠）
- **skills-lock.json 格式**：
  ```json
  {
    "version": 1,
    "skills": {
      "<skill-name>": {
        "source": "<owner>/<repo>",
        "sourceType": "github",
        "computedHash": "<hash>"
      }
    }
  }
  ```
  加入 lock 時，`source` 和 `sourceType` 從 `npx skills list -g --agent claude-code` 輸出取得（輸出中每個 skill 條目顯示其安裝路徑，source 格式為 `<owner>/<repo>`）；`computedHash` 可省略或留空字串
- **Agents 路徑**：使用相對於 `claude/agents/` 或 `~/.claude/agents/` 的相對路徑（如 `awesome-claude-code-subagents/backend-developer.md`）進行比對
- **Agents 目錄建立**：複製 agent 前，若目標目錄不存在，自動建立（`mkdir -p`）；若 `~/.claude/agents/` 本身不存在，同樣自動建立
