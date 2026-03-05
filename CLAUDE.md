# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 讓多台裝置的 Claude Code 設定保持一致。目前支援同步以下檔案：

- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- `~/.agents/.skill-lock.json`（AI 工具 skills 安裝清單）

Skills 透過 [vercel-labs/skills](https://github.com/vercel-labs/skills) 安裝與管理，`.skill-lock.json` 記錄已安裝的 skill 清單與來源，同步後可讓各裝置擁有相同的 skill 環境。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `agents/.skill-lock.json` | 同步的 skills 安裝清單，對應 `~/.agents/.skill-lock.json` |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 定義 |

## Slash Commands

### `/sync-ai` — 日常同步

日常使用，比對本機與 repo 差異並同步。

流程：
1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 逐檔比對本機與 repo 的所有同步檔案：
   - CLAUDE.md、settings.json（`~/.claude/` ↔ `claude/`）
   - `.skill-lock.json`（`~/.agents/` ↔ `agents/`）
   - settings.json 比對時忽略裝置特定欄位（`model`、`effortLevel`）
   - `.skill-lock.json` 比對時忽略裝置特定欄位（`lastSelectedAgents`、`dismissed`），同步時仍複製完整檔案
3. 顯示逐檔狀態摘要（✅ 一致 / ⚠️ 有差異）
4. 若全部一致：顯示「同步完成（無差異）」
5. 若有差異：顯示各檔 diff（標明檔名），詢問策略
   - **1. 用本機設定覆蓋雲端**：將本機版複製到 repo 的 `claude/` 目錄，顯示 diff，再詢問是否自動 commit 並 push（commit 訊息格式：`sync: 從 <hostname> 同步設定 <YYMMDDHHmm>`）
   - **2. 用雲端設定覆蓋本機**：直接複製 repo 版到本機
   - **3. 取消**：不執行任何操作

## 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- `claude/settings.json` 不含 hook，同步到新裝置不會影響其他專案
- settings.json 的 `model` 與 `effortLevel` 為裝置特定設定，比對時自動忽略
- `.skill-lock.json` 的 `lastSelectedAgents` 與 `dismissed` 為裝置特定 UI 狀態，比對時自動忽略
- 同步 `.skill-lock.json` 後，skills 不會自動安裝，需手動執行 `skills experimental_install` 還原
