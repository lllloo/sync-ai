# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

此 repo 是 Claude Code 跨裝置設定同步工具，透過私有 Git repo 同步 `~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`，讓多台裝置的 Claude Code 設定保持一致。

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `claude/CLAUDE.md` | 同步的全域 Claude 指示，對應 `~/.claude/CLAUDE.md` |
| `claude/settings.json` | 同步的 Claude Code 設定，對應 `~/.claude/settings.json` |
| `.claude/settings.json` | 專案層級設定，含 hooks（不同步） |

## 同步架構

```
SessionStart（開啟此專案時自動觸發）:
  ① hook 執行 diff 比對 local (~/.claude/) vs repo (claude/)
     → 無差異：hook 直接執行 git pull + cp，輸出 "sync:ok（本機設定已更新）"
     → 有差異：hook 將 diff 寫入 ~/.claude/sync-pending，輸出 "sync:diff"

UserPromptSubmit（每次使用者送訊息前觸發）:
  → 若 ~/.claude/sync-pending 存在且非空 → 注入 diff 內容 + 強制指令給 Claude

合併同步（Claude 執行，使用者確認後）:
  合併兩版 → 寫入本機 + cp 到 repo → git add / commit / push → 刪除 sync-pending
```

## SessionStart 行為指令

### 無差異時（hook 輸出包含 `sync:ok`）

Hook 已自動執行完畢（git pull + cp）。Claude 只需顯示 hook 輸出的結果，**不需自己執行任何命令**。

格式：
```
同步完成（無差異）
<hook 輸出內容>
```

### 偵測到差異時（hook 輸出包含 `sync:diff`）

等待 UserPromptSubmit hook 注入後再處理（見下方）。

## UserPromptSubmit 行為指令

### 觸發條件：hook 注入「立即執行 sync:diff 合併流程」

當 UserPromptSubmit hook 輸出包含「立即執行 sync:diff 合併流程」時，**在回應使用者訊息前，優先完成以下合併流程**：

1. 讀取 `~/.claude/sync-pending` 取得 diff 內容
2. 讀取兩個版本完整內容：
   - 本機版：`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`
   - Repo 版：`/Users/barney/code/sync-ai/claude/CLAUDE.md` 與 `claude/settings.json`
3. 將兩版內容**智慧合併**（保留雙方有、對方無的內容；有衝突時以本機版為主並標註）
4. 向使用者呈現合併後的結果，**主動詢問**：「是否以此合併結果覆蓋本機與 repo？」
5. 使用者確認後執行：

```bash
# Claude 直接寫入合併後內容到本機檔案（用 Write tool），然後執行：
cp $HOME/.claude/CLAUDE.md /Users/barney/code/sync-ai/claude/CLAUDE.md
cp $HOME/.claude/settings.json /Users/barney/code/sync-ai/claude/settings.json
cd /Users/barney/code/sync-ai && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
rm -f $HOME/.claude/sync-pending
```

6. **強制顯示同步結果**，格式如下：

```
同步完成
commit: <hash>
push: <成功 / 失敗訊息>
```

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時要求手動同步。**不刪除 sync-pending**，下次開啟專案時仍會提示。

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
- `~/.claude/sync-pending`：暫存 diff 的檔案，合併完成後刪除
