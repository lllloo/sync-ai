# sync-ai 完整體檢

## What This Is

針對 sync-ai（Claude Code 跨裝置設定同步工具）進行一次完整的功能驗證與健康檢查。涵蓋指令功能正確性、邊界與錯誤處理、跨平台相容性、以及單元測試覆蓋缺口分析。產出為結構化體檢報告，不修改程式碼。

## Core Value

確認所有同步指令（diff / to-repo / to-local / skills:diff）在各種情境下行為正確，不會造成使用者設定遺失或損壞。

## Requirements

### Validated

- ✓ diff 指令可比較本機與 repo 差異 — existing
- ✓ to-repo 指令可將本機設定推送至 repo — existing
- ✓ to-local 指令可將 repo 設定拉回本機（含互動確認）— existing
- ✓ skills:diff 指令可比較本機 skills 與 lock 檔差異 — existing
- ✓ settings.json 同步時排除裝置特定欄位（model / effortLevel）— existing
- ✓ 原子寫入（writeJsonSafe：tmp + rename）— existing
- ✓ 路徑遮罩避免洩漏使用者目錄 — existing
- ✓ 統一錯誤處理（SyncError + formatError）— existing
- ✓ 純函式單元測試（computeLineDiff / parseArgs / matchExclude 等）— existing

### Active

- [ ] 驗證所有指令在正常路徑下的功能正確性
- [ ] 驗證邊界情境與錯誤處理的完整性
- [ ] 評估跨平台（Windows / macOS）相容性風險
- [ ] 分析單元測試覆蓋缺口並提出補強建議

### Out of Scope

- 修復發現的問題 — 本次只產出報告，修復另行處理
- 效能調優 — 工具規模小，效能非重點
- 新功能開發 — 純驗證任務
- CI/CD 建置 — 超出同步工具本身範圍

## Context

- 工具已穩定運行一段時間，經過 iter4/iter5 的重構與 bug 修復
- 最近修復包括：applySyncItems 不再強制覆寫、settings.json 序列化對稱性
- 單檔 CLI 設計（sync.js ~1800 行），零外部相依
- 現有測試只覆蓋純函式，I/O 路徑靠人工 smoke test
- codebase map 已完成（2026-04-09），技術債清單已識別

## Constraints

- **零外部相依**：驗證過程中不可引入新套件，測試補強建議也必須基於 node:test
- **不改程式碼**：本次產出為報告，不直接修改 sync.js 或測試檔案
- **跨平台考量**：主力 Windows 11，次要 macOS，報告需涵蓋兩平台差異

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 只產報告不修復 | 使用者明確要求先體檢再決定是否修復 | — Pending |
| 四面向全覆蓋 | 使用者選擇了全部四個驗證面向 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
