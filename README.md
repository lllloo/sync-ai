# sync-ai

跨裝置同步 Claude Code 設定的私有 Git repo 工具。

**同步項目**：`~/.claude/CLAUDE.md`、`~/.claude/settings.json`、全域 skills、全域 agents

## 使用方式

在此專案目錄中執行：

```
/sync-ai
```

## 新裝置部署

```bash
git clone <your-repo-url>
cd sync-ai
```

clone 後請 Claude 執行：

> 「請初始化 sync-ai，將 repo 設定複製到本機」

## 檔案說明

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 對應 `~/.claude/settings.json` |
| `claude/agents/` | 對應 `~/.claude/agents/`（以 package 子目錄組織） |
| `skills-lock.json` | 全域 skills 清單（跨裝置 source of truth） |
| `.claude/commands/sync-ai.md` | `/sync-ai` 指令定義 |

## 注意事項

- `settings.json` 的 `model`、`effortLevel`、`statusLine` 為裝置特定設定，不參與同步
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
- agents 儲存於 `claude/agents/`，以 package 子目錄分組
