# 全域 Claude Code 指示

此檔案定義所有專案通用的全域規則與慣例。

## 語言規範

**一律使用繁體中文**撰寫所有內容、註解、文件、溝通訊息與 commit 訊息。技術術語可保留英文。輸出 Markdown 文件時亦同。

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

## README.md 規範

所有軟體專案**必須撰寫 `README.md`**，最低需包含：專案說明、安裝方式、常用指令。

## 沙箱模式注意事項

依賴 macOS XPC/IPC 的 CLI 工具在沙箱模式下無法執行，需用 `/sandbox` 關閉，或由使用者自行在終端機執行（`! <command>`）。

## Obsidian

用戶說「ob」即指 Obsidian。

### 筆記操作（日記、建立筆記、搜尋）

當用戶想記錄、建立筆記或搜尋 vault 時（觸發詞：「ob」、「筆記」、「日記」、「daily」、「記一下」、「找筆記」），**使用 Agent tool 委派給 `~/.claude/agents/obsidian.md`**。

### CLI 用法

`daily:append` 正常運作，正確格式：

```
obsidian daily:append content="<內容>"
```

注意：Obsidian CLI 依賴 macOS XPC/IPC，屬於需關閉沙箱才能執行的工具（參見上方沙箱說明）。
