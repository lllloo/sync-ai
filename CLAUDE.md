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
   → 有差異：智慧合併 → 詢問確認 → 寫入本機 + cp 到 repo → git add / commit / push
```

## /sync-ai 行為指令

### 無差異時

執行：
```bash
cd $REPO && git pull --ff-only
cp $REPO/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
cp $REPO/claude/settings.json $HOME/.claude/settings.json
```

顯示格式：
```
同步完成（無差異）
<git pull 輸出>
```

### 有差異時

1. 讀取兩個版本完整內容：
   - 本機版：`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`
   - Repo 版：`<repo 根目錄>/claude/CLAUDE.md` 與 `<repo 根目錄>/claude/settings.json`
2. 智慧合併：
   - CLAUDE.md：保留雙方有、對方無的內容；衝突以本機版為主
   - settings.json：合併 `permissions.allow` 陣列（去除重複項，合併後字母排序）；其他欄位衝突以本機版為主
3. 呈現差異後，使用 AskUserQuestion 工具以選項方式詢問，選項為：「以 Repo 版為主合併」、「以本機版為主合併」、「取消」
4. 依選擇調整合併策略後執行合併，呈現合併結果，再次以選項確認：「確認同步」與「取消」
4. 確認後執行：

```bash
# Claude 用 Write tool 寫入本機，然後：
cp $HOME/.claude/CLAUDE.md $REPO/claude/CLAUDE.md
cp $HOME/.claude/settings.json $REPO/claude/settings.json
cd $REPO && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
```

5. 顯示同步結果：

```
同步完成
commit: <hash>
push: <成功 / 失敗訊息>
```

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時執行 `/sync-ai` 手動同步。

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
