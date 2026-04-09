# Phase 1: 指令功能正確性驗證 - Research

**Researched:** 2026-04-09
**Domain:** CLI 指令行為驗證（靜態分析 + dry-run 實測）
**Confidence:** HIGH

## Summary

本 phase 的任務是驗證 sync-ai 的 6 個主要指令（diff / status / to-repo / to-local / skills:diff / skills:add）在正常操作路徑下是否符合規格，產出體檢報告 `01-REPORT.md`。不修改任何程式碼。

驗證方法以靜態程式碼追蹤為主（追蹤 handler 執行路徑、確認邏輯分支），輔以安全指令的 dry-run 實測（diff / to-repo --dry-run / status）。所有邏輯集中於單檔 `sync.js`（~1820 行），行號定位明確，追蹤成本低。

**Primary recommendation:** 按 FUNC-01 到 FUNC-10 逐項追蹤程式碼路徑，每項獨立產出 PASS/FAIL/PARTIAL 結論與行號證據。安全指令搭配 dry-run 實測取得實際輸出作為佐證。

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 以靜態程式碼分析為主要驗證手段 — 追蹤每個指令的執行路徑，確認邏輯符合規格
- **D-02:** 輔以 dry-run 實際執行驗證 — 對 diff / to-repo --dry-run / status 等安全指令，在本機實際執行觀察輸出
- **D-03:** 不執行會修改檔案的操作 — to-repo（非 dry-run）和 to-local 僅透過程式碼分析驗證，不實際執行
- **D-04:** 每個 FUNC-XX 需求獨立成段，包含：驗證方法、結果（PASS/FAIL/PARTIAL）、證據引用
- **D-05:** 報告開頭含摘要表格，一覽所有 FUNC 需求的驗證狀態
- **D-06:** 報告檔名為 `01-REPORT.md`，存放於 phase 目錄
- **D-07:** 引用程式碼行號（如 `sync.js:1274-1311`）而非貼完整程式碼
- **D-08:** 對關鍵邏輯摘要描述，讓讀者不需翻原始碼也能理解驗證結論
- **D-09:** dry-run 執行的實際輸出以 code block 呈現作為佐證

### Claude's Discretion
- 各 FUNC 驗證的具體切入點與追蹤順序
- 報告內各段落的詳細程度平衡
- 是否需要為個別 FUNC 項目附加風險標注

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FUNC-01 | diff 指令無差異時回傳 exit code 0，有差異時回傳 exit code 1 | `runDiff()` (sync.js:1274-1311) 明確回傳 `EXIT_OK` / `EXIT_DIFF`；可用 `npm run diff; echo $?` 實測 |
| FUNC-02 | diff 指令正確顯示 file / settings / dir 三種類型的差異 | `diffSyncItems()` (sync.js:1055-1092) 分三路處理；`buildSyncItems()` (sync.js:949-1002) 定義五項 SyncItem |
| FUNC-03 | to-repo 指令正確將本機 CLAUDE.md / statusline.sh 複製到 repo | `applySyncItems()` (sync.js:1101-1132) 中 `type === 'file'` 分支呼叫 `copyFile()` |
| FUNC-04 | to-repo 指令同步 settings.json 時剝離 DEVICE_FIELDS | `mergeSettingsJson('to-repo')` (sync.js:879-890) 使用 `loadStrippedSettings()` 去除 DEVICE_FIELDS |
| FUNC-05 | to-repo 指令正確鏡像 agents/ 與 commands/ 目錄 | `applySyncItems()` 中 `type === 'dir'` 分支呼叫 `mirrorDir()` (sync.js:470-510) |
| FUNC-06 | to-local 指令顯示預覽後經使用者確認才套用變更 | `runToLocal()` (sync.js:1432-1460) 先 `printToLocalPreview()`，非 dry-run 時呼叫 `confirmAndApply()` → `askConfirm()` |
| FUNC-07 | to-local 指令同步 settings.json 時保留本機 DEVICE_FIELDS | `mergeSettingsJson('to-local')` (sync.js:891-909) 先提取 `deviceValues`，最後 `{ ...repo, ...deviceValues }` 合併 |
| FUNC-08 | dry-run 模式下所有指令不寫入任何檔案 | `copyFile` / `mirrorDir` / `mergeSettingsJson` 皆有 `dryRun` 參數，dry-run 時只比對不寫入 |
| FUNC-09 | skills:diff 只輸出建議指令，不執行操作 | `runSkillsDiff()` (sync.js:1471-1531) 只有 `console.log` 輸出，無 `spawnSync` / `fs.writeFileSync` 呼叫 |
| FUNC-10 | status 指令同時執行 diff + skills:diff 並顯示兩者結果 | `runDiffAll()` (sync.js:1318-1322) 依序呼叫 `runDiff()` + `runSkillsDiff()`；status handler 綁定至 `runDiffAll` (sync.js:1776) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **零外部相依**：不可引入新套件，所有邏輯用 Node.js 內建模組
- **不改程式碼**：本次只產報告，不修改 sync.js 或測試檔案
- **繁體中文**：報告、註解、commit 訊息一律繁體中文
- **禁止 Bash `$()`**：命令替換需拆兩步
- **函式 <= 60 行**：僅供參考，本 phase 不修改程式碼
- **嚴禁洩漏敏感資訊**：報告中的路徑需遮罩

## Architecture Patterns

### 驗證對象的程式碼結構

sync.js 採 data-driven dispatch 架構，所有指令入口明確：

```
COMMANDS 物件 (sync.js:63-71)
  ├── diff        → runDiff()        (sync.js:1274-1311)
  ├── status      → runDiffAll()     (sync.js:1318-1322)
  ├── to-repo     → runToRepo()      (sync.js:1329-1371)
  ├── to-local    → runToLocal()     (sync.js:1432-1460)
  ├── skills:diff → runSkillsDiff()  (sync.js:1471-1531)
  └── skills:add  → runSkillsAdd()   (sync.js:1539+)
```

### 核心管道（三條指令共用）

```
buildSyncItems(direction)     → SyncItem[]          (sync.js:949-1002)
  ↓
diffSyncItems(items, dir)     → DiffResult[]         (sync.js:1055-1092)
  ↓
applySyncItems(items, dir, opts) → {stats, changeLog} (sync.js:1101-1132)
```

### SyncItem 三種類型及其處理路徑 [VERIFIED: sync.js 原始碼]

| type | 項目 | diff 路徑 | apply 路徑 |
|------|------|-----------|------------|
| `file` | CLAUDE.md, statusline.sh | `diffFile()` | `copyFile()` |
| `settings` | settings.json | `diffSettingsItem()` → `getStrippedSettings()` | `mergeSettingsJson()` |
| `dir` | agents/, commands/ | `diffDir()` | `mirrorDir()` |

### dry-run 守門機制 [VERIFIED: sync.js 原始碼]

三個寫入函式皆內建 `dryRun` 參數：

1. **`copyFile(src, dest, force, dryRun)`** (sync.js:404-421) — dry-run 時只回傳是否需寫入，不執行 `writeFileSync`
2. **`mirrorDir(src, dest, excludes, force, dryRun)`** (sync.js:470-510) — dry-run 時不呼叫 `ensureDir` / `writeFileSync` / `rmSync`
3. **`mergeSettingsJson(direction, dryRun)`** (sync.js:875-910) — dry-run 時只比對 stripped JSON，不呼叫 `writeJsonSafe`

此外，`runToRepo()` 在 dry-run 時跳過 git repo 檢查（sync.js:1339-1343）並設定 `isWriting = false`。

### settings.json DEVICE_FIELDS 機制 [VERIFIED: sync.js 原始碼]

- **常數定義**：`DEVICE_FIELDS = ['model', 'effortLevel']` (sync.js:33)
- **to-repo 方向**：`loadStrippedSettings()` 從本機 settings 刪除 DEVICE_FIELDS 後寫入 repo (sync.js:879-890)
- **to-local 方向**：先提取本機的 deviceValues，合併 repo 資料後回寫本機，保留裝置欄位 (sync.js:896-907)

### skills:diff 唯輸出機制 [VERIFIED: sync.js 原始碼]

`runSkillsDiff()` (sync.js:1471-1531) 的操作：
1. 讀取 `skills-lock.json`（repo）與 `.skill-lock.json`（本機）
2. 集合比對：`onlyInRepo` / `onlyInLocal` / `inBoth`
3. 只用 `console.log` 輸出建議指令（`npx skills add ...` / `npx skills remove ...`）
4. **無任何 `spawnSync`、`writeFileSync` 或其他副作用呼叫**

### status 指令實作 [VERIFIED: sync.js 原始碼]

`status` 指令的 handler 綁定到 `runDiffAll()` (sync.js:1776)：
```javascript
function runDiffAll(opts) {
  const diffCode = runDiff(opts);
  const skillsCode = runSkillsDiff();
  return (diffCode === EXIT_OK && skillsCode === EXIT_OK) ? EXIT_OK : EXIT_DIFF;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 報告格式 | 自訂 HTML 或 PDF | Markdown `01-REPORT.md` | D-06 已鎖定，保持簡單 |
| 程式碼追蹤 | 自動化 AST 分析 | 人工靜態追蹤 + 行號引用 | 零外部相依限制，不可引入 parser |

## Common Pitfalls

### Pitfall 1: settings.json SyncItem 的方向陷阱
**What goes wrong:** `buildSyncItems()` 中 settings.json 的 `src/dest` 固定為 localPath/repoPath，不隨 direction 調換（sync.js:966-968 註解明確說明）。驗證時容易誤以為 to-local 方向的 src 會變成 repoPath。
**How to avoid:** 驗證 FUNC-04/07 時，追蹤 `mergeSettingsJson()` 內部的方向分支，而非 SyncItem 的 src/dest。

### Pitfall 2: dry-run 實測時本機狀態會影響結果
**What goes wrong:** `npm run diff` 的輸出取決於本機 `~/.claude/` 與 repo `claude/` 的實際差異，每次執行結果可能不同。
**How to avoid:** 報告中 dry-run 輸出佐證應標明「此為驗證時刻的快照，反映當時本機狀態」。

### Pitfall 3: status 指令名稱 vs 實作名稱
**What goes wrong:** npm script 叫 `status`，handler 是 `runDiffAll`，package.json 也有 `diff` script。容易混淆 `runDiff` 和 `runDiffAll`。
**How to avoid:** 明確區分：`diff` → `runDiff()`（只做設定 diff），`status` → `runDiffAll()`（設定 diff + skills diff）。

### Pitfall 4: 報告路徑洩漏
**What goes wrong:** dry-run 輸出可能含使用者家目錄完整路徑。
**How to avoid:** 貼 dry-run 輸出前，手動遮罩或用 `--verbose` 前確認 `toRelativePath` 已生效。sync.js 的 verbose 輸出會走 `logVerbosePaths`，但部分輸出（如錯誤訊息）可能含原始路徑。

## Verification Strategy Details

### 可安全實測的指令（D-02 範圍）

| 指令 | 執行方式 | 驗證目標 |
|------|----------|----------|
| `npm run diff` | 直接執行 | FUNC-01 exit code、FUNC-02 差異顯示 |
| `node sync.js to-repo --dry-run` | dry-run | FUNC-03/04/05 的 dry-run 預覽、FUNC-08 零寫入 |
| `node sync.js to-local --dry-run` | dry-run | FUNC-06 預覽行為、FUNC-07 的 dry-run 比對、FUNC-08 零寫入 |
| `npm run status` | 直接執行 | FUNC-10 完整輸出 |
| `npm run skills:diff` | 直接執行 | FUNC-09 只輸出不執行 |

### 只能靜態分析的指令（D-03 範圍）

| 指令 | 原因 | 追蹤路徑 |
|------|------|----------|
| `to-repo`（非 dry-run） | 會修改 repo 中的 claude/ 目錄 | `runToRepo` → `applySyncItems` → `copyFile`/`mirrorDir`/`mergeSettingsJson` |
| `to-local`（非 dry-run） | 會修改 `~/.claude/` 目錄 | `runToLocal` → `confirmAndApply` → `applySyncItems` |

### 每項 FUNC 的關鍵追蹤路徑

**FUNC-01 (exit code):**
- `runDiff()` sync.js:1299-1310：`hasDiff` 為 false → `return EXIT_OK`，否則 → `return EXIT_DIFF`
- `EXIT_OK = 0`、`EXIT_DIFF = 1` (sync.js 常數區)
- 實測：`npm run diff; echo $?`

**FUNC-02 (三類型差異顯示):**
- `diffSyncItems()` sync.js:1058-1089：三個 `if` 分支分別處理 settings / file / dir
- `runDiff()` sync.js:1281-1296：根據 status 印出不同圖示
- 實測：`npm run diff` 觀察輸出

**FUNC-03 (to-repo file 複製):**
- `buildSyncItems('to-repo')` 產出 CLAUDE.md / statusline.sh 項目
- `applySyncItems` → `copyFile(item.src, item.dest)` 對 file 類型
- 靜態追蹤 `copyFile` (sync.js:404-421) 確認讀取 src 寫入 dest

**FUNC-04 (to-repo DEVICE_FIELDS 剝離):**
- `applySyncItems` → `mergeSettingsJson('to-repo')` (sync.js:879-890)
- `loadStrippedSettings()` (sync.js:850-855)：`for (const field of DEVICE_FIELDS) delete data[field]`
- `writeJsonSafe(repoPath, stripped.clean)` — 寫入已去除 DEVICE_FIELDS 的物件

**FUNC-05 (to-repo 目錄鏡像):**
- `applySyncItems` → `mirrorDir(item.src, item.dest)` 對 dir 類型
- `mirrorDir` (sync.js:470-510) 處理新增、更新、刪除

**FUNC-06 (to-local 預覽確認):**
- `runToLocal()` sync.js:1449-1459：先 `printToLocalPreview()`，非 dry-run 呼叫 `confirmAndApply()`
- `confirmAndApply()` sync.js:1398-1425：`askConfirm()` 後才 `applySyncItems()`

**FUNC-07 (to-local 保留 DEVICE_FIELDS):**
- `mergeSettingsJson('to-local')` sync.js:891-909
- 關鍵行：`deviceValues` 提取 → `writeJsonSafe(localPath, { ...repo, ...deviceValues })`

**FUNC-08 (dry-run 零寫入):**
- `copyFile` dry-run 守門：sync.js:410-413
- `mirrorDir` dry-run 守門：sync.js:486-494, 502
- `mergeSettingsJson` dry-run 守門：sync.js:888, 906
- `runToRepo` dry-run 時 `isWriting = false` (sync.js:1345)

**FUNC-09 (skills:diff 只輸出):**
- `runSkillsDiff()` sync.js:1471-1531 全函式只有 `console.log` 和 `readJson`
- 無 `spawnSync` / `writeFileSync` / `execSync` 呼叫

**FUNC-10 (status = diff + skills:diff):**
- `attachCommandHandlers()` sync.js:1776：`COMMANDS['status'].handler = (opts) => runDiffAll(opts)`
- `runDiffAll()` sync.js:1318-1322：依序呼叫 `runDiff(opts)` + `runSkillsDiff()`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (Node.js 內建) |
| Config file | 無獨立設定檔，透過 package.json scripts |
| Quick run command | `npm test` |
| Full suite command | `node --test test/sync.test.js test/settings.test.js` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FUNC-01 | diff exit code 驗證 | manual + dry-run | `npm run diff; echo $?` | N/A（手動驗證） |
| FUNC-02 | diff 三類型顯示 | manual + dry-run | `npm run diff` | N/A |
| FUNC-03 | to-repo file 複製 | static analysis | N/A | N/A |
| FUNC-04 | to-repo DEVICE_FIELDS 剝離 | static analysis | N/A | N/A |
| FUNC-05 | to-repo 目錄鏡像 | static analysis | N/A | N/A |
| FUNC-06 | to-local 預覽確認 | static analysis | N/A | N/A |
| FUNC-07 | to-local 保留 DEVICE_FIELDS | static analysis | N/A | N/A |
| FUNC-08 | dry-run 零寫入 | static + dry-run | `node sync.js to-repo --dry-run` | N/A |
| FUNC-09 | skills:diff 只輸出 | static + dry-run | `npm run skills:diff` | N/A |
| FUNC-10 | status 完整輸出 | manual + dry-run | `npm run status` | N/A |

### Sampling Rate
- **Per task commit:** `npm test`（確保現有測試不壞）
- **Per wave merge:** 全 FUNC 項目重新驗證
- **Phase gate:** 01-REPORT.md 完成且所有 FUNC 有明確 PASS/FAIL/PARTIAL

### Wave 0 Gaps
None — 本 phase 產出報告，不需新增測試基礎設施。現有 `npm test` 用於確認不破壞既有測試。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**所有 claims 均已透過 sync.js 原始碼驗證，無 ASSUMED 標記項目。**

## Open Questions

1. **askConfirm 在 TTY 環境的行為**
   - What we know: `confirmAndApply()` 呼叫 `askConfirm()` 讀取使用者輸入
   - What's unclear: 非 TTY 環境下是否有 guard 或 fallback（屬 Phase 2 EDGE-08 範圍）
   - Recommendation: Phase 1 僅記錄此觀察，不深入追蹤

2. **skills:diff 的 lock 檔案路徑差異**
   - What we know: repo 端用 `skills-lock.json`，本機端用 `.skill-lock.json`（前綴有點）
   - What's unclear: 這是刻意設計或 bug
   - Recommendation: 報告中記錄此觀察，標注為潛在風險

## Sources

### Primary (HIGH confidence)
- `sync.js` 原始碼 — 所有行號引用均直接來自檔案內容
- `package.json` — npm scripts 定義
- `CLAUDE.md` — 專案約束與同步項目規格

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — FUNC-01~10 需求定義
- `.planning/phases/01-command-verification/01-CONTEXT.md` — 使用者決策

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 純 Node.js 內建，無第三方依賴
- Architecture: HIGH — 所有程式碼在單檔內，行號定位明確
- Pitfalls: HIGH — 已追蹤所有關鍵路徑

**Research date:** 2026-04-09
**Valid until:** 2026-05-09（sync.js 變更前有效）
