# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。同步項目：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- 全域 skills（`npx skills list -g` ↔ `skills-lock.json`）

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `skills-lock.json` | 欲在各裝置全域安裝的 skills 清單（source of truth） |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 完整定義 |

## 注意事項

- settings.json 的 `model`、`effortLevel`、`statusLine` 為裝置特定設定，比對時自動忽略
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
