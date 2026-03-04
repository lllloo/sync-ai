# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 定義 |

## Slash Commands

### `/sync-ai` — 日常同步

日常使用，比對本機與 repo 差異並同步。

流程：
1. `git fetch`，若 remote 有新 commit 詢問是否 `git pull --ff-only`
2. 逐檔比對 `~/.claude/` 與 `claude/` 的 CLAUDE.md 與 settings.json
   - settings.json 比對時忽略裝置特定欄位（`model`、`effortLevel`），同步時仍複製完整檔案
3. 顯示逐檔狀態摘要（✅ 一致 / ⚠️ 有差異）
4. 若全部一致：顯示「同步完成（無差異）」
5. 若有差異：顯示各檔 diff（標明檔名），詢問策略
   - **1. 用本機設定覆蓋雲端**：將本機版複製到 repo 的 `claude/` 目錄，顯示 diff，由使用者自行決定是否 commit 與 push
   - **2. 用雲端設定覆蓋本機**：直接複製 repo 版到本機
   - **3. 取消**：不執行任何操作

## 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- `claude/settings.json` 不含 hook，同步到新裝置不會影響其他專案
- settings.json 的 `model` 與 `effortLevel` 為裝置特定設定，比對時自動忽略
