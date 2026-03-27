# sync-ai

跨裝置同步 Claude Code 設定的私有 Git repo 工具。

**同步項目**：`~/.claude/CLAUDE.md`、`~/.claude/settings.json`、`~/.claude/statusline.sh`、全域 skills、全域 agents、全域 commands

## 使用方式

```bash
# 本機設定 → repo（上傳）
npm run to-repo

# repo 設定 → 本機（套用）
npm run to-local
```

## 新裝置部署

```bash
git clone <your-repo-url>
cd sync-ai
npm run to-local
```

## 檔案說明

| 檔案 | 說明 |
|------|------|
| `sync.js` | 主腳本，實作 to-repo / to-local 邏輯 |
| `package.json` | 定義 `npm run to-repo` / `npm run to-local` |
| `claude/CLAUDE.md` | 對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 對應 `~/.claude/settings.json` |
| `claude/statusline.sh` | 對應 `~/.claude/statusline.sh` |
| `claude/agents/` | 對應 `~/.claude/agents/`（以 package 子目錄組織） |
| `claude/commands/` | 對應 `~/.claude/commands/` |
| `skills-lock.json` | 全域 skills 清單（跨裝置 source of truth） |

## 注意事項

- `settings.json` 的 `model`、`effortLevel` 為裝置特定設定，to-repo 時自動排除，to-local 時保留本機值
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
- agents 儲存於 `claude/agents/`，以 package 子目錄分組
- to-repo 時依 `~/.agents/.skill-lock.json` 更新 `skills-lock.json`；to-local 時自動安裝缺少的 skills
