# 程式碼庫結構

**分析日期：** 2026-04-09

## 目錄佈局

```
sync-ai/
├── sync.js                 # 主應用邏輯（~1800 行，零外部相依）
├── package.json            # NPM 指令與元數據
├── README.md               # 使用文件
├── CLAUDE.md               # 專案修改守則
├── skills-lock.json        # 全域 skills 清單（source of truth）
├── .sync-history.log       # 同步操作日誌（.gitignore）
├── .gitignore              # Git 忽略清單
│
├── test/                   # 測試套件
│   ├── sync.test.js        # 純函式單元測試（node:test）
│   └── settings.test.js    # settings 相關測試
│
├── claude/                 # 同步内容根目錄（映射到 ~/.claude/）
│   ├── CLAUDE.md           # 全域 Claude 指示（同 ~/.claude/CLAUDE.md）
│   ├── settings.json       # Claude Code 設定（去除 model/effortLevel）
│   ├── statusline.sh       # 狀態列腳本
│   │
│   ├── agents/             # agents 儲存區
│   │   ├── everything-claude-code/    # 來源：affaan-m/everything-claude-code
│   │   │   ├── architect.md
│   │   │   ├── build-error-resolver.md
│   │   │   └── ... (20+ agents)
│   │   │
│   │   └── awesome-claude-code-subagents/  # 來源：VoltAgent/awesome-claude-code-subagents
│   │       ├── backend-developer.md
│   │       ├── frontend-developer.md
│   │       └── ... (8+ agents)
│   │
│   └── commands/           # 命令儲存區（鏡射 ~/.claude/commands/）
│       └── gsd/            # GSD 命令集群
│           └── ... (若干 .md 文件)
│
├── .agents/                # 本機安裝 skills 實體（.gitignore，不進 repo）
├── .planning/              # 規劃文件（含此結構分析）
│   └── codebase/
│       └── ARCHITECTURE.md / STRUCTURE.md
│
└── .git/                   # Git 版本控制
```

## 目錄用途

**sync.js：**
- 目的：所有應用邏輯
- 包含：CLI 解析、命令派發、同步核心、FS utilities、settings 處理、display 層
- 關鍵特徵：
  - section banner 分段組織（Constants / Errors / FS Utilities / Commands 等）
  - 所有函式 ≤ 60 行（強制）
  - 無外部相依，只用 Node.js 內建模組

**test/：**
- 目的：單元與集成測試
- 包含：
  - `sync.test.js`：純函式單元測試（computeLineDiff / matchExclude / parseArgs 等）
  - `settings.test.js`：settings 序列化與去除欄位測試
- 框架：Node.js 內建 `node:test`（零相依）
- 執行：`npm test` 或 `node --test test/*.js`

**claude/：**
- 目的：同步内容（映射到 `~/.claude/`）
- 結構：與 `~/.claude/` 鏡像
- 何時更新：`npm run to-repo`
- 何時修改本機：`npm run to-local`

**claude/agents/：**
- 目的：agent 定義檔（.md）
- 組織：
  - `everything-claude-code/`：主要套件來源（affaan-m）
  - `awesome-claude-code-subagents/`：補充來源（VoltAgent），按分類子目錄存放
- 部署：`~/.claude/agents/` 中對應的子目錄
- 注意：實體檔案 (`.agents/`) 不進 repo（.gitignore）

**claude/commands/：**
- 目的：自訂命令定義
- 組織：以功能分組（如 `gsd/` 用於 GSD 命令）
- 部署：`~/.claude/commands/` 鏡像

**skills-lock.json：**
- 目的：全域 skills manifest（跨裝置 source of truth）
- 結構：`{ version: 1, skills: { <name>: { source, sourceType } } }`
- 何時修改：`npm run skills:add`
- 作用：記錄已安裝 skills，供 `npm run skills:diff` 比對

**.sync-history.log：**
- 目的：同步操作日誌
- 內容：每次 to-repo / to-local 的 timestamp / hostname / 變更清單
- 保留：.gitignore（本機檔案，不進 repo）

## 關鍵檔案位置

**進入點：**
- `sync.js:1788-1795`：主應用進入點（if require.main === module）
- `sync.js:1736-1767`：`main()` 命令派發
- `package.json` 的 scripts：npm 指令定義

**配置：**
- `sync.js:20-81`：全域常數（REPO_ROOT / CLAUDE_HOME / DEVICE_FIELDS / COMMANDS 等）
- `sync.js:112-120`：ANSI 色碼工具（col 物件）
- `package.json`：版本號與 npm 腳本

**核心邏輯：**
- `sync.js:291-530`：FS utilities（readJson / writeJsonSafe / copyFile / mirrorDir）
- `sync.js:948-1002`：`buildSyncItems()` 同步項目構建
- `sync.js:1055-1092`：`diffSyncItems()` 差異計算
- `sync.js:1101-1132`：`applySyncItems()` 變更套用
- `sync.js:831-910`：Settings 處理（serializeSettings / mergeSettingsJson）

**指令實現：**
- `sync.js:1274-1311`：`runDiff()` 比對指令
- `sync.js:1329-1365`：`runToRepo()` 上傳指令
- `sync.js:1372-1396`：`runToLocal()` 下載指令（含互動確認）
- `sync.js:1467-1531`：`runSkillsDiff()` / `runSkillsAdd()` skills 管理

**測試：**
- `test/sync.test.js:1-30`：測試框架與匯入
- `test/sync.test.js:28-80`：computeLineDiff 測試
- `test/sync.test.js:56-71`：matchExclude 測試

## 命名規範

**檔案：**
- 主腳本：`sync.js`（單數，非 syncs.js）
- 測試：`<module>.test.js`（e.g. `sync.test.js`）
- 配置：`package.json` / `.gitignore` / `skills-lock.json`
- Markdown：`README.md` / `CLAUDE.md` / 文件名首字大寫

**目錄：**
- 同步目錄：小寫 + 複數（`agents/` / `commands/`）
- 包來源：kebab-case + 複數（`everything-claude-code/` / `awesome-claude-code-subagents/`）
- 測試目錄：`test/`（常規名稱）

**函式：**
- 指令 handler：`run<Command>()` 或 `run<Command><Subcommand>()`
  - e.g. `runDiff()` / `runToRepo()` / `runSkillsDiff()`
- 工具函數：camelCase，動詞優先
  - e.g. `readJson()` / `copyFile()` / `mirrorDir()` / `checkReadAccess()`
- 純函式（單元測試）：camelCase
  - e.g. `computeLineDiff()` / `matchExclude()` / `parseArgs()`
- 顯示函數：`print<What>()` 或 `log<What>()`
  - e.g. `printStatusLine()` / `printFileDiff()` / `logVerbosePaths()`

**變數：**
- 常數：SCREAMING_SNAKE_CASE
  - e.g. `REPO_ROOT`, `CLAUDE_HOME`, `DEVICE_FIELDS`, `LCS_MAX_LINES`
- 物件 / 陣列：camelCase
  - e.g. `syncItems`, `diffItems`, `tempFiles`
- 旗標：camelCase
  - e.g. `dryRun`, `verbose`, `isWriting`

## 新增程式碼的位置

**新功能（指令）：**
- 指令定義：更新 `COMMANDS` 物件（`sync.js:63-71`）
- 指令別名：自動從 `COMMANDS.alias` 產生（sync.js:74-78）
- Handler 實現：在「Commands」section 新增函數（sync.js:1175-1600）
- 注入：在 `attachCommandHandlers()` 中加入（sync.js:1774-1782）
- 測試：`test/sync.test.js` 新增測試
- 文件：更新 `README.md`

**新同步項目（如 agents / commands）：**
- 新增：在 `buildSyncItems()` 的 `SyncItem[]` 陣列中加入
  - `sync.js:949-1001`，在相應 direction 區塊加入項目
- 測試：單元測試 buildSyncItems 產出
- 文件：更新 CLAUDE.md 的「同步項目與對應」表

**utilities（工具函數）：**
- FS 相關：加入「FS Utilities」section（sync.js:291-530）
- Display 相關：加入「Display Utilities」section（sync.js:793-828）
- 通用：加入對應 section（Constants / Settings / etc.）
- 匯出：若需測試，加入 module.exports（sync.js:1797-1819）

**測試：**
- 位置：
  - 純函式測試：`test/sync.test.js`
  - settings 相關：`test/settings.test.js`
- 框架：Node.js 內建 `node:test` + `assert/strict`
- 模式：`test('<描述>', () => { assert.equal(...) })`

## 特殊目錄

**.agents/（本機 skill 安裝實體）：**
- 目的：存放 `npx skills install` 下載的實體檔案
- 生成：自動（由 skills CLI）
- 提交：.gitignore（不進 repo）
- 作用：本機 skill 執行環境

**.planning/codebase/（規劃文件）：**
- 目的：codebase 架構與結構分析文件
- 包含：ARCHITECTURE.md / STRUCTURE.md / TESTING.md / CONVENTIONS.md / CONCERNS.md
- 生成：由 GSD `/gsd-map-codebase` 命令產生
- 用途：指導後續實現與重構

---

*結構分析：2026-04-09*
