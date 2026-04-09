# Phase 1: 指令功能正確性驗證 - Context

**Gathered:** 2026-04-09 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

驗證所有同步指令（diff / to-repo / to-local / skills:diff / status）在正常操作路徑下行為符合規格。產出為體檢報告的 Section 1，涵蓋 FUNC-01 ~ FUNC-10 共 10 項需求。本 phase 只產報告，不修改程式碼。

</domain>

<decisions>
## Implementation Decisions

### 驗證策略
- **D-01:** 以靜態程式碼分析為主要驗證手段 — 追蹤每個指令的執行路徑，確認邏輯符合規格
- **D-02:** 輔以 dry-run 實際執行驗證 — 對 diff / to-repo --dry-run / status 等安全指令，在本機實際執行觀察輸出
- **D-03:** 不執行會修改檔案的操作 — to-repo（非 dry-run）和 to-local 僅透過程式碼分析驗證，不實際執行

### 報告結構
- **D-04:** 每個 FUNC-XX 需求獨立成段，包含：驗證方法、結果（PASS/FAIL/PARTIAL）、證據引用
- **D-05:** 報告開頭含摘要表格，一覽所有 FUNC 需求的驗證狀態
- **D-06:** 報告檔名為 `01-REPORT.md`，存放於 phase 目錄

### 證據呈現
- **D-07:** 引用程式碼行號（如 `sync.js:1274-1311`）而非貼完整程式碼
- **D-08:** 對關鍵邏輯摘要描述，讓讀者不需翻原始碼也能理解驗證結論
- **D-09:** dry-run 執行的實際輸出以 code block 呈現作為佐證

### Claude's Discretion
- 各 FUNC 驗證的具體切入點與追蹤順序
- 報告內各段落的詳細程度平衡
- 是否需要為個別 FUNC 項目附加風險標注

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求規格
- `.planning/REQUIREMENTS.md` — FUNC-01 ~ FUNC-10 完整定義，每項需求的驗收標準

### 架構與程式碼
- `sync.js` — 所有待驗證邏輯所在的單一檔案
- `.planning/codebase/ARCHITECTURE.md` — 架構層級與資料流（to-repo / to-local / diff / skills:diff 完整流程）
- `.planning/codebase/STRUCTURE.md` — 關鍵檔案位置（指令 handler 行號、核心邏輯行號）
- `.planning/codebase/TESTING.md` — 現有測試覆蓋範圍（了解已驗證 vs 未驗證的部分）

### 專案約束
- `.planning/PROJECT.md` — 「只產報告不修復」約束、零外部相依限制
- `CLAUDE.md` — 同步項目對應表（驗證基準）、DEVICE_FIELDS 定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `COMMANDS` 物件（sync.js:63-71）：包含所有指令定義，可用來列舉待驗證指令清單
- `buildSyncItems()`（sync.js:948-1002）：宣告式同步項目清單，直接作為驗證基準
- `DEVICE_FIELDS` 常數（sync.js:55）：定義 settings.json 排除欄位，驗證 FUNC-04/07 的基準

### Established Patterns
- Data-driven dispatch：`COMMANDS` + `attachCommandHandlers()` 模式，驗證時可從此追蹤所有指令入口
- SyncItem 抽象：三類項目（file/settings/dir）走統一管道，驗證時需分別確認各類型行為
- Exit code 語義：`EXIT_OK=0` / `EXIT_DIFF=1` / `EXIT_ERROR=2`，FUNC-01 的驗證基準

### Integration Points
- `runDiff()`（sync.js:1274-1311）→ `diffSyncItems()` → `printDetailedDiff()`
- `runToRepo()`（sync.js:1329-1365）→ `applySyncItems()` → `appendSyncLog()`
- `runToLocal()`（sync.js:1372-1396）→ `askConfirm()` → `applySyncItems()`
- `runSkillsDiff()`（sync.js:1467-1531）→ `spawnSync('npx', ['skills', 'list'])`
- `runStatus()`：串接 `runDiff()` + `runSkillsDiff()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — analysis stayed within phase scope

</deferred>

---

*Phase: 01-command-verification*
*Context gathered: 2026-04-09*
