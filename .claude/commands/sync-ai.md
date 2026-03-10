執行 Claude Code 設定與 skills 統一同步流程：

## 步驟 1：事前準備（Git Fetch）

1. 執行 `git fetch` 取得 remote 最新資訊
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「1. Pull（建議）」、「2. 略過」
   - 若選「Pull」：執行 `git pull --ff-only`
   - 若 pull 失敗（如 conflict）：顯示 `❌ Pull 失敗：<錯誤訊息>` 並停止執行

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
                    lock    全域(~/.agents)
  frontend-design — ✅      ✅
  typescript-types— ✅      ❌ 缺少
  my-local-skill  — ❌ 缺少  ✅
```

### 若全部一致

直接顯示：
```
✅ 同步完成（無差異）
```

然後結束執行，不再詢問任何操作。

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
- 對每個差異行詢問一次（使用 AskUserQuestion，multiSelect false）：
  ```
  「第 <line> 行衝突，選擇保留版本？」
    1. 用本機版（~/.claude/CLAUDE.md）：<local_line>
    2. 用 repo 版（claude/CLAUDE.md）：<repo_line>
  ```
- 詢問順序：按行號遞增
- 無差異行：自動保留（不詢問）

#### settings.json 衝突解決
- 對每個差異欄位詢問一次（使用 AskUserQuestion，multiSelect false）：
  ```
  「<key> 欄位衝突，選擇保留值？」
    1. 用本機值（~/.claude/settings.json）：<local_value>
    2. 用 repo 值（claude/settings.json）：<repo_value>
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
- 若合併結果 === 本機內容（例如：差異全來自「本機獨有 key 自動加入」，或所有衝突均選了本機版）：
  - 顯示 `ℹ️ 本機設定已是最新，無需覆蓋` 並直接跳至步驟 5
- 若合併結果 ≠ 本機內容：
  - 詢問「確認無誤，是否覆蓋本機設定檔？」
    - **1. 確認並覆蓋（建議）**：
      - 將 repo 的 `claude/CLAUDE.md` 和 `claude/settings.json` 複製到 `~/.claude/`
      - 顯示 `✅ 已覆蓋本機設定檔`
    - **2. 跳過**：不覆蓋本機，保留 repo 的合併結果（可稍後手動同步本機），繼續到 skills 同步步驟

## 步驟 5：執行 — Skills 同步

若 skills-lock.json 與全域有差異，使用 AskUserQuestion 詢問同步方向：

**選項：**

#### 1. 以 lock 為主 → 補裝缺少的 skills 到全域（建議）
- `skills-lock.json` 為 source of truth，全域多出的 skills 不會被加入 lock
- 對 lock 中全域缺少的每個 skill 執行：
  `npx skills add <source> -g -y --skill <name> --agent claude-code`
- 安裝中：顯示 `⏳ 安裝 <skill-name> 到全域...`
- 成功：顯示 `✅ 已安裝 <skill-name>（全域）`
- 失敗：顯示 `❌ 安裝失敗：<skill-name>（<錯誤訊息>）`

#### 2. 以全域為主 → 更新 skills-lock.json
- 將 `npx skills list -g --agent claude-code` 的輸出完整寫入 `skills-lock.json`
- 顯示 `✅ 已更新 skills-lock.json`

#### 3. 跳過

> **注意**：若 lock 缺少 + 全域多出同時存在，選「以 lock 為主」只補裝缺少的，全域多出的忽略；選「以全域為主」則全部以全域為準更新 lock。

## 步驟 6：Commit & Push

若有任何 repo 變更（設定檔或 skills-lock.json），使用 AskUserQuestion 詢問：

**選項：**

### 1. 自動 commit 並 push（建議）
執行以下操作：
```bash
git add claude/ skills-lock.json
```

Commit 訊息格式：
```
sync: 從 <hostname> 同步設定 <YYMMDDHHmm>
```

或若只有 skills 變更：
```
sync: 從 <hostname> 同步 skills <YYMMDDHHmm>
```

然後 `git push`。

結果反饋：
- 成功：`✅ 已 push 到 remote`
- 失敗：`❌ Push 失敗：<錯誤訊息>，請手動處理`

### 2. 自行處理
不執行任何 git 操作，提示使用者自行執行 commit 與 push。

## 步驟 7：完成摘要

顯示最終同步結果摘要，格式示例：
```
✅ sync-ai 完成

📋 最終狀態：
  CLAUDE.md     — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  settings.json — 已更新 repo（claude/） / 已更新本機（~/.claude/） / 無差異
  Skills        — 已安裝 2 個 / 已更新 skills-lock.json / 無差異
```

## 實作細節

- **Hostname 取得**：使用 `hostname` 指令取得裝置名稱（Windows 上 `hostname`，macOS/Linux 上 `uname -n`，或透過環境變數 `$HOSTNAME`）
- **時間戳記格式**：YYMMDDHHmm（例 2603061430）
- **json 比對**：忽略 `model`、`effortLevel`、`statusLine` 欄位（裝置特定設定），比較其他所有鍵值
- **Skills 來源**：從 `skills-lock.json` 中取得 `<source>`，格式為 `<owner>/<name>` 或完整 URL
