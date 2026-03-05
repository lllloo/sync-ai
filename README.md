# sync-ai

跨裝置同步 Claude Code 設定的私有 Git repo 工具。目前支援同步以下檔案：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- `~/.agents/.skill-lock.json`（AI 工具 skills 安裝清單）

Skills 透過 [vercel-labs/skills](https://github.com/vercel-labs/skills) 安裝與管理，同步 `.skill-lock.json` 可讓各裝置擁有相同的 skill 環境。

## 快速開始

### 新裝置部署

```bash
git clone <your-repo-url>
```

clone 後，請 Claude 執行初始化：

> 「請初始化 sync-ai，將 repo 設定複製到本機」

初始化完成後，執行以下指令還原 skills：

```bash
skills experimental_install
```

此指令會讀取 `~/.agents/.skill-lock.json` 並從 GitHub 下載所有已記錄的 skills，讓新裝置與其他裝置擁有相同的 skill 環境。

### 日常同步

在此專案目錄中輸入：

```
/sync-ai
```

## 同步邏輯

1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 逐檔比對本機與 repo 的所有同步檔案：
   - CLAUDE.md、settings.json（`~/.claude/` ↔ `claude/`）
   - `.skill-lock.json`（`~/.agents/` ↔ `agents/`）
   - settings.json 比對時忽略裝置特定欄位（`model`、`effortLevel`）
   - `.skill-lock.json` 比對時忽略裝置特定欄位（`lastSelectedAgents`、`dismissed`）
3. 顯示逐檔狀態摘要：
   ```
   📋 同步狀態：
     CLAUDE.md      — ✅ 一致
     settings.json  — ⚠️ 有差異
   ```
4. 若全部一致：顯示「同步完成（無差異）」
5. 若有差異：顯示各檔 diff（標明檔名），詢問策略
   - **1. 用本機設定覆蓋雲端**：將本機版複製到 repo 的 `claude/` 目錄，顯示 diff，再詢問是否自動 commit 並 push（commit 訊息格式：`sync: 從 <hostname> 同步設定 <YYMMDDHHmm>`）
   - **2. 用雲端設定覆蓋本機**：直接複製 repo 版到本機
   - **3. 取消**：不執行任何操作

### 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- settings.json 的 `model` 與 `effortLevel` 為裝置特定設定，比對時自動忽略
- `.skill-lock.json` 的 `lastSelectedAgents` 與 `dismissed` 為裝置特定 UI 狀態，比對時自動忽略
- 同步 `.skill-lock.json` 後，skills 不會自動安裝，需手動執行 `skills experimental_install` 還原

## 檔案結構

```
claude/
  CLAUDE.md        # 同步的全域 Claude 指示
  settings.json    # 同步的 Claude Code 設定
agents/
  .skill-lock.json # 同步的 skills 安裝清單
.claude/
  commands/
    sync-ai.md     # /sync-ai slash command 定義
```
