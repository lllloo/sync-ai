# 全域 Claude Code 指示

此檔案定義所有專案通用的全域規則與慣例。

## 語言規範

**一律使用繁體中文**撰寫所有內容、註解、文件、溝通訊息與 commit 訊息。技術術語可保留英文。

## Bash 指令規範

**禁止在 Bash 工具呼叫中使用 `$()` 命令替換** — 會觸發 Claude Code 安全確認提示。

改以兩步執行：
1. 先用獨立 Bash 呼叫取得值（例如 `date +%y%m%d%H%M`）
2. 再將取得的字面值帶入下一個指令

## 構建與打包規則

**預設禁止執行打包命令** — 除非明確要求，否則不執行：

- `npm run build` / `yarn build` / `pnpm build`
- `npm run docs:build` 或類似構建命令

**例外**：只有在明確指示「請打包」、「執行打包」時才可執行。

## 計畫完成後的操作

當完成計畫模式並準備執行時，**應主動詢問是否將計畫內容記錄到專案的 `plan.md` 檔案中**。

## Obsidian

用戶說「ob」即指 Obsidian。

### 筆記操作（日記、建立筆記、搜尋）

當用戶想記錄、建立筆記或搜尋 vault 時（觸發詞：「ob」、「筆記」、「日記」、「daily」、「記一下」、「找筆記」），**使用 Agent tool 委派給 `~/.claude/agents/obsidian.md`**。

### 網頁抓取

**直接使用 WebFetch，不要觸發 `obsidian:defuddle` 技能。**

原因：`obsidian:defuddle` 會呼叫本機未安裝的 Defuddle CLI，必定失敗（由 Obsidian skill 內部觸發）。

### CLI 已知問題

`daily:append` 有 bug，會回傳 exit code 127。改用兩步驟：

1. `obsidian daily:path` 取得今日路徑
2. `obsidian append path="<date>.md" content="內容"`
