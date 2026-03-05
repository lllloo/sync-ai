# sync-ai

跨裝置同步 Claude Code 設定的私有 Git repo 工具。目前支援同步以下項目：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- 全域 skills（`npx skills list -g` ↔ `skills-lock.json`）

Skills 透過 [vercel-labs/skills](https://github.com/vercel-labs/skills) 安裝與管理，`skills-lock.json` 作為跨裝置的 source of truth。

## 快速開始

### 新裝置部署

```bash
git clone <your-repo-url>
```

clone 後，請 Claude 執行初始化：

> 「請初始化 sync-ai，將 repo 設定複製到本機」

初始化時，Claude 會讀取 `skills-lock.json`，對每個 skill 執行：

```bash
npx skills add <source> -g --skill <name> --agent claude-code
```

### 日常同步

在此專案目錄中輸入：

```
/sync-ai
```

同步 skills：

```
/sync-skills
```

## 同步邏輯

### `/sync-ai` — config 檔案同步

1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 逐檔比對 CLAUDE.md、settings.json（`~/.claude/` ↔ `claude/`）
   - settings.json 比對時忽略裝置特定欄位（`model`、`effortLevel`）
3. 顯示逐項狀態摘要：
   ```
   📋 同步狀態：
     CLAUDE.md     — ✅ 一致
     settings.json — ⚠️ 有差異
   ```
4. 若全部一致：顯示「同步完成（無差異）」
5. 若有差異：詢問策略
   - **1. 用本機設定覆蓋雲端**：複製本機版到 repo `claude/`，詢問是否自動 commit 並 push
   - **2. 用雲端設定覆蓋本機**：複製 repo 版到本機
   - **3. 取消**：不執行任何操作

### `/sync-skills` — Skills 同步

1. 讀取 repo `skills-lock.json`，與 `npx skills list -g` 比對
2. 顯示差異摘要：
   ```
   📋 Skills 同步狀態：
     frontend-design — ✅ 一致
     typescript-types — ⚠️ repo 有，本機缺少
   ```
3. 若有差異：詢問策略
   - **1. 更新 skills-lock.json（以本機為準）**：將本機全域 skills 寫入 `skills-lock.json`，詢問是否自動 commit 並 push
   - **2. 補裝缺少的 skills（以雲端為準）**：對缺少的 skills 執行 `npx skills add <source> -g --skill <name> --agent claude-code`
   - **3. 取消**：不執行任何操作

### 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- settings.json 的 `model` 與 `effortLevel` 為裝置特定設定，比對時自動忽略
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo

## 檔案結構

```
claude/
  CLAUDE.md        # 同步的全域 Claude 指示
  settings.json    # 同步的 Claude Code 設定
skills-lock.json   # skills 安裝清單（source of truth）
.claude/
  commands/
    sync-ai.md     # /sync-ai slash command 定義
    sync-skills.md # /sync-skills slash command 定義
```
