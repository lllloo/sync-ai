# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。

**同步指令：**
- `npm run to-repo` — 本機 → repo（上傳本機設定）
- `npm run to-local` — repo → 本機（套用 repo 設定）

**同步項目：**
- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`（排除裝置特定欄位：`model`、`effortLevel`、`statusLine`）
- `~/.claude/statusline.sh`
- 全域 skills（`~/.agents/.skill-lock.json` ↔ `skills-lock.json`）
- 全域 agents（`~/.claude/agents/` ↔ `claude/agents/`）
- 全域 commands（`~/.claude/commands/` ↔ `claude/commands/`）

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `sync.js` | 主腳本，實作 to-repo / to-local 邏輯（無外部相依） |
| `package.json` | 定義 `npm run to-repo` / `npm run to-local` |
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `claude/statusline.sh` | statusLine 使用的 shell script，對應 `~/.claude/statusline.sh` |
| `claude/agents/` | 同步的全域 agents，對應 `~/.claude/agents/`（以 package 子目錄組織） |
| `claude/commands/` | 同步的全域 commands，對應 `~/.claude/commands/` |
| `skills-lock.json` | 欲在各裝置全域安裝的 skills 清單（source of truth） |

## 注意事項

- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
- agents 以檔案形式直接儲存於 `claude/agents/`，以 package 子目錄分組（如 `claude/agents/awesome-claude-code-subagents/`）
- to-repo 時 `~/.claude/commands/sync-ai*` 系列檔案不會複製進 repo
