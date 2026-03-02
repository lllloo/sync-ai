# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `.claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `settings.json` | 同步的 Claude Code hook 設定及權限，對應 `~/.claude/settings.json` |
| `sync-pull.sh` | SessionStart hook 執行的腳本 |
| `install.sh` | 新裝置初始化，一次性複製設定到 `~/.claude/` |
| `.claude/settings.local.json` | 本機額外權限（不同步） |

## 同步架構

```
SessionStart:
  ① 比對 local (~/.claude/) vs repo (.claude/CLAUDE.md + settings.json)
     → 有差異：AI 分析 → Claude 詢問使用者是否推送到 repo
  ② git pull（取得 repo 最新版）
  ③ cp .claude/CLAUDE.md + settings.json → ~/.claude/（更新本機）

Stop: 已移除
```

## 新裝置部署

```bash
git clone <repo-url> <repo-path>
cd <repo-path>
bash install.sh
```

`install.sh` 只需執行一次，之後 hook 自動接管同步。執行後需將 `settings.json` 內 hook 指令中的路徑（目前寫死為 `/Users/barney/code/sync-ai`）改為本機實際路徑。

## 注意事項

- Hook 路徑為絕對路徑，換機器需更新 `settings.json` 與 `.claude/CLAUDE.md` 內的路徑
- 使用 `$HOME` 而非 `~` 保持跨平台相容
- diff 方向：`diff repo local`（- 為 repo 版、+ 為本機版）
- `sync-pull.sh` AI 分析使用 `claude -p --no-session-persistence`，失敗時 fallback 顯示原始 diff
- 修改 `settings.json` 後需重新執行 `cp settings.json ~/.claude/settings.json` 才能生效
