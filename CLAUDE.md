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
     → 有差異：hook 輸出 "sync:diff" 及 diff 內容

合併同步（Claude 執行，使用者確認後）:
  合併兩版 → 寫入本機 + cp 到 repo → git add / commit / push
```

## SessionStart 行為指令

### 無差異時（hook 輸出包含 `sync:ok`）

Hook 已自動執行完畢（git pull + cp）。Claude 只需顯示 hook 輸出的結果，**不需自己執行任何命令**。

Hook 輸出順序：`git pull` 結果（最多 3 行）→ `sync:ok（本機設定已更新）`

格式：
```
同步完成（無差異）
<git pull 輸出>
sync:ok（本機設定已更新）
```

### 偵測到差異時（hook 輸出包含 `sync:diff`）

**立即執行以下合併流程**：

1. 從 hook 輸出（system-reminder）取得 diff 內容
2. 讀取兩個版本完整內容：
   - 本機版：`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`
   - Repo 版：`<repo 根目錄>/claude/CLAUDE.md` 與 `<repo 根目錄>/claude/settings.json`（路徑以目前 repo 實際位置為準，不寫死）
3. 將兩版內容**智慧合併**：
   - CLAUDE.md：保留雙方有、對方無的內容；有衝突時以本機版為主並標註
   - settings.json：合併 `permissions.allow` 陣列（去除重複項）；其他欄位衝突以本機版為主
4. 向使用者呈現合併後的結果，**主動詢問**：「是否以此合併結果覆蓋本機與 repo？」
5. 使用者確認後執行：

```bash
# Claude 直接寫入合併後內容到本機檔案（用 Write tool），然後執行：
# REPO 為目前 repo 的絕對路徑（動態取得，不寫死）
cp $HOME/.claude/CLAUDE.md $REPO/claude/CLAUDE.md
cp $HOME/.claude/settings.json $REPO/claude/settings.json
cd $REPO && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
```

6. **強制顯示同步結果**，格式如下：

```
同步完成
commit: <hash>
push: <成功 / 失敗訊息>
```

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時要求手動同步。

## 新裝置部署

clone repo 後，請 Claude 執行初始化（將 `$REPO` 替換為實際路徑）：

```bash
mkdir -p $HOME/.claude
cp $REPO/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
cp $REPO/claude/settings.json $HOME/.claude/settings.json
```

完成後需將 `.claude/settings.json` 內的路徑改為本機實際路徑。

## 注意事項

- `.claude/settings.json` hook 使用 `$PWD` 動態取得 repo 路徑，換機器無需修改
- `claude/settings.json` 不含 hook，同步到新裝置後不會影響其他專案
- diff 方向：`-` 為 repo 版、`+` 為本機版
