# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。同步項目：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- 全域 skills（`npx skills list -g` ↔ `skills-lock.json`）
- 全域 agents（`~/.claude/agents/` ↔ `claude/agents/`）

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `claude/statusline.sh` | statusLine 使用的 shell script，對應 `~/.claude/statusline.sh`（write-local 時無條件複製） |
| `claude/agents/` | 同步的全域 agents，對應 `~/.claude/agents/`（以 package 子目錄組織） |
| `skills-lock.json` | 欲在各裝置全域安裝的 skills 清單（source of truth） |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 完整定義 |

## 注意事項

- settings.json 的 `model`、`effortLevel` 為裝置特定設定，比對時自動忽略
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
- agents 以檔案形式直接儲存於 `claude/agents/`，以 package 子目錄分組（如 `claude/agents/awesome-claude-code-subagents/`）
