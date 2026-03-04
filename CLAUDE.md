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
2. 比對 `~/.claude/` 與 `claude/` 的 CLAUDE.md 與 settings.json
3. 若無差異：將 repo 版複製到本機，顯示「同步完成（無差異）」
4. 若有差異：詢問策略
   - **1. 建立本地分支並 commit**：建立 `sync/<hostname>-<YYYYMMDDHHmm>` 分支，複製本機版到 repo，commit 後切回 main，提示使用者自行合併或 push；合併完成後需再執行一次 `/sync-ai` 以將結果同步回本機
   - **2. Repo 版覆蓋本機**：直接複製 repo 版到本機
   - **3. 取消**：不執行任何操作

## 注意事項

- diff 方向：`-` 為 repo 版、`+` 為本機版
- `claude/settings.json` 不含 hook，同步到新裝置不會影響其他專案
- 分支命名格式：`sync/<hostname>-<YYYYMMDDHHmm>`
- commit 訊息格式：`sync: 從 <hostname> 同步設定 <YYYYMMDDHHmm>`
