# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。

**同步指令：**
- `npm run diff` — 純比較本機 vs repo，顯示差異（不寫任何東西）
- `npm run to-repo` — 本機 → repo（上傳本機設定，完成後顯示 git diff）
- `npm run to-local` — repo → 本機（先顯示預覽，確認後才套用）

**Skills 指令（獨立管理，不自動同步）：**
- `npm run skills:diff` — 比較本機已安裝 vs repo 記錄的 skills，列出差異並提供安裝／移除指令

**同步項目：**
- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`（排除裝置特定欄位：`model`、`effortLevel`）
- `~/.claude/statusline.sh`
- 全域 agents（`~/.claude/agents/` ↔ `claude/agents/`）
- 全域 commands（`~/.claude/commands/` ↔ `claude/commands/`）

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `sync.js` | 主腳本，實作所有指令邏輯（無外部相依） |
| `package.json` | 定義所有 npm 指令 |
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `claude/statusline.sh` | statusLine 使用的 shell script，對應 `~/.claude/statusline.sh` |
| `claude/agents/` | 同步的全域 agents，對應 `~/.claude/agents/`（以 package 子目錄組織） |
| `claude/commands/` | 同步的全域 commands，對應 `~/.claude/commands/` |
| `skills-lock.json` | 各裝置已安裝的 skills 參考清單（僅供查閱，不自動同步） |

## 注意事項

- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
- agents 以檔案形式直接儲存於 `claude/agents/`，以 package 子目錄分組（如 `claude/agents/awesome-claude-code-subagents/`）
- `.DS_Store` 檔案自動排除，不會同步進 repo
- Skills（`~/.agents/`）不在自動同步範圍內，用 `npm run skills:diff` 查看差異，再自行執行建議的 `npx skills` 指令
