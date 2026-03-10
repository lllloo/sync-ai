執行 Claude Code 設定與 skills 統一同步流程：

## 步驟 1：事前準備（Git Fetch）

執行 `git fetch` 取得 remote 最新資訊。

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
- 若 pull 失敗：顯示 `❌ Pull 失敗：<錯誤訊息>` 並停止執行

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

1. 讀取 `skills-lock.json`
2. 執行 `npx skills list -g --agent claude-code` 取得**全域** skills（`~/.agents/skills/`）
3. 比對差異，分類為：
   - lock 有、全域缺少的 skills（新機器需補裝）
   - 全域有、lock 缺少的 skills（本機新增，可更新 lock 或忽略）

---

## 步驟 3：顯示摘要（Dry-run 預覽）

先顯示整體同步狀態摘要：
```
📋 同步狀態預覽：
  CLAUDE.md        — ✅ 一致
  settings.json    — ⚠️ 有差異
  Skills           — ⚠️ 有差異（詳見下方清單）
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

### 若全部一致

直接顯示：
```
✅ 同步完成（無差異）
```

然後結束執行，不再詢問任何操作。

---

## 步驟 4：執行 — 設定檔同步（Smart Merge）

若有設定檔差異（CLAUDE.md 或 settings.json），進行以下操作：

### 4.1 偵測並分析衝突

#### CLAUDE.md 衝突分析
- 逐行比對 repo `claude/CLAUDE.md` 與本機 `~/.claude/CLAUDE.md`
- 列出所有差異行（包含上下文）：
  ```
  📌 CLAUDE.md 差異行（共 3 處）：

  第 5 行：
  - ## 語言規範（claude/CLAUDE.md）
  + ## Language Rules（~/.claude/CLAUDE.md）

  第 8 行：
  - **一律使用繁體中文**撰寫所有內容
  + **Always use Traditional Chinese**

  第 15 行：
  - `npm run build` / `yarn build` / `pnpm build`
  + `npm build` / `yarn build`
  ```

#### settings.json 衝突分析
- 載入 repo `claude/settings.json` 和本機 `~/.claude/settings.json` JSON
- 移除裝置特定欄位（`model`、`effortLevel`、`statusLine`）
- 列出所有差異欄位：
  ```
  📌 settings.json 差異（已排除 model、effortLevel、statusLine）：
    • autoSave：claude/ 為 false | ~/.claude/ 為 true
    • theme：claude/ 為 "dark" | ~/.claude/ 為 "light"
  ```

### 4.2 逐項詢問衝突

#### CLAUDE.md 衝突解決

對每個差異行詢問一次（使用 AskUserQuestion，multiSelect false）：

- **question**: `第 <line> 行衝突，保留哪個版本？`
- **header**: `第 <line> 行`
- 選項：

##### 選項 A：用本機版
- label: `用本機版`
- description: `~/.claude/CLAUDE.md 的內容`
- preview:
  ```
  第 <line-2> 行  <context_line>
  第 <line-1> 行  <context_line>
  ▶ 第 <line> 行  <local_line>        ← 保留此行
  第 <line+1> 行  <context_line>
  第 <line+2> 行  <context_line>
  ```

##### 選項 B：用 repo 版
- label: `用 repo 版`
- description: `claude/CLAUDE.md 的內容`
- preview:
  ```
  第 <line-2> 行  <context_line>
  第 <line-1> 行  <context_line>
  ▶ 第 <line> 行  <repo_line>         ← 保留此行
  第 <line+1> 行  <context_line>
  第 <line+2> 行  <context_line>
  ```

- 詢問順序：按行號遞增
- 無差異行：自動保留（不詢問）

#### settings.json 衝突解決

對每個差異欄位詢問一次（使用 AskUserQuestion，multiSelect false）：

- **question**: `"<key>" 欄位衝突，保留哪個值？`
- **header**: `<key>`
- 選項：

##### 選項 A：用本機值
- label: `用本機值`
- description: `~/.claude/settings.json 的值`
- preview:
  ```
  {
    ...
    "<key>": <local_value>    ← 保留此值（本機）
    ...
  }
  ```

##### 選項 B：用 repo 值
- label: `用 repo 值`
- description: `claude/settings.json 的值`
- preview:
  ```
  {
    ...
    "<key>": <repo_value>     ← 保留此值（repo）
    ...
  }
  ```

- 只有 repo 有的 key：自動保留 repo 值（不詢問）
- 只有本機有的 key：自動加入合併結果（不詢問）

### 4.3 寫入合併結果到 repo

- 根據上述選擇，將合併後的內容寫入：
  - `claude/CLAUDE.md`（按行合併）
  - `claude/settings.json`（按欄位合併，保留裝置特定欄位的本機原始值）
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

  ~/.claude/CLAUDE.md      ← claude/CLAUDE.md（已合併）
  ~/.claude/settings.json  ← claude/settings.json（已合併）

  裝置特定欄位（model、effortLevel、statusLine）保持本機值不變
  ```
- 動作：複製 `claude/CLAUDE.md` 和 `claude/settings.json` 到 `~/.claude/`
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

若 skills-lock.json 與全域有差異，使用 AskUserQuestion 詢問同步方向。

- **question**: `Skills 有差異，請選擇同步方向？`
- **header**: `Skills 同步`
- 選項：

#### 1. 安裝缺少的 skill（建議）
- label: `安裝缺少的 skill（建議）`
- description: `補裝 lock 中本機尚未安裝的 skill，本機多出的保持不動`
- preview: 顯示完整 skills 表格，lock 有但本機缺的標 `❌ → ✅ 安裝`，格式：
  ```
  skill                        lock    本機(~/.agents)
  ────────────────────────────────────────────────────
  create-adaptable-composable  ✅      ✅
  frontend-design              ✅      ❌ → ✅ 安裝
  vue-best-practices           ✅      ✅
  ```
- 動作：對 lock 中全域缺少的每個 skill 執行：
  `npx skills add <source> -g -y --skill <name> --agent claude-code`
- 安裝中：顯示 `⏳ 安裝 <skill-name>...`
- 成功：顯示 `✅ 已安裝 <skill-name>`
- 失敗：顯示 `❌ 安裝失敗：<skill-name>（<錯誤訊息>）`

#### 2. 以本機為準更新 lock
- label: `以本機為準更新 lock`
- description: `用本機已安裝的 skills 覆蓋 skills-lock.json，lock 多出的項目會被移除`
- preview: 顯示完整 skills 表格，本機缺但 lock 有的標 `✅ → ❌ 從 lock 移除`，格式：
  ```
  skill                        lock      本機(~/.agents)
  ──────────────────────────────────────────────────────
  create-adaptable-composable  ✅        ✅
  frontend-design              ✅ → ❌   ❌  從 lock 移除
  vue-best-practices           ✅        ✅
  ```
- 動作：將 `npx skills list -g --agent claude-code` 的輸出完整寫入 `skills-lock.json`
- 完成後顯示 `✅ 已更新 skills-lock.json`

#### 3. 跳過
- label: `跳過`
- description: `保持現狀，不做任何變更`
- preview: 顯示完整 skills 表格，所有差異行標 `（保持現狀）`

---

## 步驟 6：Commit & Push

若有任何 repo 變更（設定檔或 skills-lock.json），使用 AskUserQuestion 詢問：

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
  └ skills-lock.json        （已更新）

  然後 git push → origin/main
  ```
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

## 步驟 7：完成摘要

顯示最終同步結果摘要，格式示例：
```
✅ sync-ai 完成

📋 最終狀態：
  CLAUDE.md     — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  settings.json — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  Skills        — 已安裝 2 個 / 已更新 skills-lock.json / 無差異
```

---

## 實作細節

- **Hostname 取得**：使用 `hostname` 指令取得裝置名稱（Windows 上 `hostname`，macOS/Linux 上 `uname -n`，或透過環境變數 `$HOSTNAME`）
- **時間戳記格式**：YYMMDDHHmm（例 2603061430）
- **json 比對**：忽略 `model`、`effortLevel`、`statusLine` 欄位（裝置特定設定），比較其他所有鍵值
- **Skills 來源**：從 `skills-lock.json` 中取得 `<source>`，格式為 `<owner>/<name>` 或完整 URL
