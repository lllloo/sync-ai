# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 同步架構

同步流程由 Claude Code 的 Hook 機制驅動，不需手動操作：

- **SessionStart** → 執行 `sync-pull.sh`：
  1. 比對本機 `~/.claude/` 與 repo 的差異（本機 vs repo）
  2. 有差異時，AI 分析變更內容並輸出提示，Claude 會詢問使用者是否推送到 repo
  3. 不論是否有差異，都執行 git pull 並將 repo 最新版覆蓋本機（確保本機永遠同步到最新）
- **Stop** → 已移除（SessionStart 已處理所有同步，包含 git pull 與複製到本機）

`settings.json`（repo 根目錄）即為 hook 的設定來源，部署後由 `install.sh` 複製至 `~/.claude/settings.json` 生效。

## 新裝置部署

```bash
git clone <repo-url> <repo-path>
cd <repo-path>
bash install.sh
```

`install.sh` 只需執行一次，之後 hook 自動接管同步。

執行後需手動將 `settings.json` 裡 hook 指令中的路徑（目前寫死為 `/Users/barney/code/sync-ai`）改為本機實際路徑。

## 關鍵檔案

| 檔案 | 說明 |
|------|------|
| `settings.json` | Hook 設定及權限，複製到 `~/.claude/settings.json` 後生效 |
| `sync-pull.sh` | SessionStart hook 執行的腳本，含 AI diff 分析邏輯 |
| `install.sh` | 新裝置初始化，一次性複製設定到 `~/.claude/` |
| `.claude/settings.local.json` | 本機額外權限（不同步） |

## 注意事項

- Hook 指令中的 repo 路徑為絕對路徑，換機器需更新 `settings.json` 內的路徑
- 使用 `$HOME` 而非 `~` 保持跨平台相容
- `sync-pull.sh` 的 AI 分析使用 `claude -p --no-session-persistence`，失敗時 fallback 顯示原始 diff
- diff 方向：`diff repo local`（- 為 repo 版、+ 為本機版），有助於判斷本機是否有新修改需要推送
- SessionStart 完成後本機永遠是 repo 最新版，不需要 Stop hook 再次同步
