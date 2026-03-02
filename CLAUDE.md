# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | **同步的全域 Claude 指示**，對應 `~/.claude/CLAUDE.md`；內含 SessionStart 同步行為指令 |
| `claude/settings.json` | **同步的 Claude Code 設定**，對應 `~/.claude/settings.json`；含 SessionStart hook 與預設允許的 Bash 權限 |
| `sync-pull.sh` | SessionStart hook 執行的腳本，負責 diff 比對、AI 分析、git pull、更新本機設定 |
| `install.sh` | 新裝置初始化，一次性複製設定到 `~/.claude/` |
| `.claude/settings.local.json` | 本機額外權限（不同步） |
| `plan.md` | 原始設計文件（參考用，不再維護） |

## 同步架構

```
SessionStart（自動）:
  ① sync-pull.sh 比對 local (~/.claude/) vs repo (claude/CLAUDE.md + claude/settings.json)
     → 有差異：claude -p AI 分析 diff → Claude 詢問使用者是否 push（不自動覆蓋本機）
     → 無差異：git pull → cp claude/* → ~/.claude/（更新本機）

Push 同步（手動，由 Claude 代為執行）:
  使用者確認後 → cp 本機設定到 repo → git add / commit / push
```

## 新裝置部署

```bash
git clone <repo-url> <repo-path>
cd <repo-path>
bash install.sh
```

`install.sh` 只需執行一次，之後 hook 自動接管同步。執行後需將 `settings.json` 內 hook 指令中的路徑（目前寫死為 `/Users/barney/code/sync-ai`）改為本機實際路徑。

## 注意事項

- Hook 路徑為絕對路徑，換機器需同步更新 `settings.json` 與 `.claude/CLAUDE.md` 內的路徑
- 使用 `$HOME` 而非 `~` 保持跨平台相容
- diff 方向：`diff repo local`（`-` 為 repo 版、`+` 為本機版）
- `sync-pull.sh` AI 分析使用 `claude -p --no-session-persistence`，失敗時 fallback 顯示原始 diff
- 修改 `settings.json` 後需重新執行 `cp settings.json ~/.claude/settings.json` 才能生效
