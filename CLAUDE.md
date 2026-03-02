# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `.claude/settings.json` | 專案層級設定，含 SessionStart hook（不同步） |

## 同步架構

```
SessionStart（開啟此專案時自動觸發）:
  ① hook 執行 diff 比對 local (~/.claude/) vs repo (claude/)
     → 有差異（hook 有輸出）：Claude 解讀 diff，詢問是否 push
     → 無差異（hook 無輸出）：Claude 自動 git pull + cp 更新本機（靜默）

Push 同步（使用者確認後由 Claude 執行）:
  cp 本機設定到 repo → git add / commit / push
```

## SessionStart 行為指令

### 偵測到差異時（hook 有輸出）

1. 向使用者說明差異內容（解讀 diff，`-` 為 repo 版、`+` 為本機版）
2. **主動詢問**：「是否要將本機設定同步到 sync repo？」
3. 使用者確認後執行：

```bash
cp $HOME/.claude/CLAUDE.md /Users/barney/code/sync-ai/claude/CLAUDE.md
cp $HOME/.claude/settings.json /Users/barney/code/sync-ai/claude/settings.json
cd /Users/barney/code/sync-ai && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
```

4. 回報 commit hash 與 push 結果

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時要求手動同步。

### 無差異時（hook 無輸出）

靜默執行以下命令，不詢問、不回報：

```bash
cd /Users/barney/code/sync-ai && git pull
cp /Users/barney/code/sync-ai/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
cp /Users/barney/code/sync-ai/claude/settings.json $HOME/.claude/settings.json
```

## 新裝置部署

clone repo 後，請 Claude 執行初始化：

```bash
mkdir -p $HOME/.claude
cp /Users/barney/code/sync-ai/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
cp /Users/barney/code/sync-ai/claude/settings.json $HOME/.claude/settings.json
```

完成後需將 `.claude/settings.json` 內的路徑改為本機實際路徑。

## 注意事項

- `.claude/settings.json` hook 路徑為絕對路徑，換機器需手動修改
- `claude/settings.json` 不含 hook，同步到新裝置後不會影響其他專案
- diff 方向：`-` 為 repo 版、`+` 為本機版
