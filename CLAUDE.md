# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。目前支援同步以下項目：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- 全域 skills（`npx skills list -g` ↔ `skills-lock.json`）

Skills 透過 [vercel-labs/skills](https://github.com/vercel-labs/skills) 安裝與管理。`skills-lock.json` 記錄欲在各裝置全域安裝的 skills 清單（source of truth），與本機 `npx skills list -g` 比對。有差異時永遠先詢問方向：
- lock 有、全域缺少 → 可補裝到全域（新電腦補裝）
- 全域有、lock 缺少 → 可更新 lock（記錄本機新增的 skill）

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `skills-lock.json` | 欲在各裝置全域安裝的 skills 清單，作為跨裝置同步的 source of truth |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 定義 |

## Slash Commands

### `/sync-ai` — 統一設定與 Skills 同步

比對本機與 repo 的設定檔與 skills 差異並同步。整合了設定檔（CLAUDE.md、settings.json）和 skills 同步流程。

流程：
1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 逐檔比對：
   - **設定檔**：CLAUDE.md、settings.json（`~/.claude/` ↔ `claude/`）
     - settings.json 比對時忽略裝置特定欄位（`model`、`effortLevel`）
   - **Skills**：本機全域 skills（`npx skills list -g`）與 `skills-lock.json` 比對
3. 顯示 dry-run 預覽（包含具體 diff 和 skills 清單）
4. 若全部一致：顯示完成訊息
5. 若有差異：依序詢問設定檔和 skills 同步策略
   - 設定檔：用本機覆蓋雲端 / 用雲端覆蓋本機 / 跳過
   - Skills：以 lock 為主補裝到全域 / 以全域為主更新 lock / 跳過
6. 若有 repo 變更，詢問是否自動 commit 並 push

## 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- `claude/settings.json` 不含 hook，同步到新裝置不會影響其他專案
- settings.json 的 `model` 與 `effortLevel` 為裝置特定設定，比對時自動忽略
- `.agents/` 目錄（skill 實體檔案）已加入 `.gitignore`，不進 repo
