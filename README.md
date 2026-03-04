# sync-ai

跨裝置同步 Claude Code 設定（`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`）的私有 Git repo 工具。

## 快速開始

### 新裝置部署

```bash
git clone <your-repo-url>
```

clone 後，請 Claude 執行初始化：

> 「請初始化 sync-ai，將 repo 設定複製到本機」

### 日常同步

在此專案目錄中輸入：

```
/sync-ai
```

## 同步邏輯

1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
3. 若無差異：顯示「同步完成（無差異）」
4. 若有差異：詢問策略
   - **1. 用本機設定覆蓋雲端**：將本機版複製到 repo 的 `claude/` 目錄，顯示 diff，由使用者自行決定是否 commit 與 push
   - **2. 用雲端設定覆蓋本機**：直接複製 repo 版到本機
   - **3. 取消**：不執行任何操作

### 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版

## 檔案結構

```
claude/
  CLAUDE.md        # 同步的全域 Claude 指示
  settings.json    # 同步的 Claude Code 設定
.claude/
  commands/
    sync-ai.md     # /sync-ai slash command 定義
```
