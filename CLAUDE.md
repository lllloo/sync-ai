# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `.claude/settings.json` | 專案層級設定（不同步） |
| `.claude/commands/sync-ai.md` | `/sync-ai` slash command 定義 |

## 同步架構

輸入 `/sync-ai` 觸發同步流程：

```
① 比對 local (~/.claude/) vs repo (claude/)
   → 無差異：git pull + cp 本機，顯示「同步完成（無差異）」
   → 有差異：詢問合併策略 → 合併 → 確認 → 寫入本機 + cp 到 repo → git add / commit / push
```

詳細行為指令見 `.claude/commands/sync-ai.md`。

## 新裝置部署

clone repo 後，請 Claude 執行初始化：

```bash
mkdir -p $HOME/.claude
cp $REPO/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
cp $REPO/claude/settings.json $HOME/.claude/settings.json
```

## 注意事項

- `claude/settings.json` 不含 hook，同步到新裝置後不會影響其他專案
- diff 方向：`-` 為 repo 版、`+` 為本機版
