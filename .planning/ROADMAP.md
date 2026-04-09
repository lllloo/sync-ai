# Roadmap: sync-ai 完整體檢

## Overview

針對 sync-ai 進行四維度的系統性驗證，由底層向上逐層建立信任：先驗證指令正常路徑功能正確性，再深入邊界與錯誤處理，接著評估跨平台相容性風險，最後分析測試覆蓋缺口並組裝完整體檢報告。每個 phase 產出報告的一個章節，四 phase 完成後形成完整文件。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: 指令功能正確性驗證** - 驗證所有指令在正常路徑下行為正確，產出 Section 1 報告
- [ ] **Phase 2: 邊界與錯誤處理驗證** - 驗證錯誤碼、路徑遮罩、原子寫入等邊界行為，產出 Section 2 報告
- [ ] **Phase 3: 跨平台相容性評估** - 評估 Windows / macOS 差異與風險，產出 Section 3 報告
- [ ] **Phase 4: 測試覆蓋缺口分析** - 列舉測試空白並提出補強建議，組裝完整體檢報告

## Phase Details

### Phase 1: 指令功能正確性驗證
**Goal**: 確認每個指令在正常操作路徑下行為符合規格
**Depends on**: Nothing (first phase)
**Requirements**: FUNC-01, FUNC-02, FUNC-03, FUNC-04, FUNC-05, FUNC-06, FUNC-07, FUNC-08, FUNC-09, FUNC-10
**Success Criteria** (what must be TRUE):
  1. 報告明確說明 diff 在無差異與有差異兩種情境下的 exit code 實際行為
  2. 報告列出 to-repo 與 to-local 對每類 SyncItem（file / settings / dir）的實際處理結果，包含 DEVICE_FIELDS 剝離與保留的驗證
  3. 報告確認 dry-run 模式下零寫入（無任何檔案被建立或修改）
  4. 報告確認 skills:diff 只輸出建議指令，不執行安裝或移除
  5. 報告確認 status 指令同時顯示 diff 與 skills:diff 的完整輸出
**Plans**: TBD

### Phase 2: 邊界與錯誤處理驗證
**Goal**: 確認所有錯誤路徑產生正確的 SyncError 並且路徑不洩漏
**Depends on**: Phase 1
**Requirements**: EDGE-01, EDGE-02, EDGE-03, EDGE-04, EDGE-05, EDGE-06, EDGE-07, EDGE-08, EDGE-09
**Success Criteria** (what must be TRUE):
  1. 報告列出每個 SyncError 錯誤碼（FILE_NOT_FOUND / JSON_PARSE / PERMISSION / INVALID_ARGS）的實際觸發路徑與訊息樣本
  2. 報告確認所有錯誤訊息中的路徑均經 toRelativePath 遮罩，無絕對路徑洩漏
  3. 報告描述 mirrorDir 刪除多餘檔案的實際行為（含驗證方法）
  4. 報告說明 writeJsonSafe 原子寫入機制的驗證結果
  5. 報告記錄 askConfirm 在非 TTY 環境與 LCS >2000 行閾值的實際行為
**Plans**: TBD

### Phase 3: 跨平台相容性評估
**Goal**: 識別 Windows 與 macOS 之間的行為差異，記錄已知風險
**Depends on**: Phase 2
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06
**Success Criteria** (what must be TRUE):
  1. 報告確認 toRelativePath 在 Windows 家目錄路徑（含磁碟代號與反斜線）下的轉換結果
  2. 報告說明外部 diff 不可用時 computeLineDiff JS fallback 的啟動條件與行為
  3. 報告記錄 fs.accessSync 在 Windows 上的已知差異，並標注為已知風險（不要求修復）
  4. 報告確認 buildSyncItems 產出的路徑在兩平台均有效
  5. 報告確認 settings.json 序列化在兩平台產出 byte-identical 結果，並確認 spawnSync 在 Windows 正常運作
**Plans**: TBD

### Phase 4: 測試覆蓋缺口分析與報告組裝
**Goal**: 完整列舉測試空白並產出最終體檢報告
**Depends on**: Phase 3
**Requirements**: GAPS-01, GAPS-02, GAPS-03, GAPS-04, GAPS-05
**Success Criteria** (what must be TRUE):
  1. 報告列出所有在 sync.js 中存在但無對應單元測試的純函式清單
  2. 報告列出所有 I/O 函式（copyFile / mirrorDir / writeJsonSafe 等）的目前測試狀態（已測 / 未測 / 部分）
  3. 報告列出所有未被任何測試觸發的 SyncError 錯誤碼及程式碼路徑
  4. 報告列出條件分支覆蓋缺口清單（LCS fallback / EXDEV fallback / TTY guard 等），每個缺口附具體補強建議與範例測試程式碼
  5. 完整體檢報告（含四個章節）已組裝完成，可直接作為決策依據
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 指令功能正確性驗證 | 0/TBD | Not started | - |
| 2. 邊界與錯誤處理驗證 | 0/TBD | Not started | - |
| 3. 跨平台相容性評估 | 0/TBD | Not started | - |
| 4. 測試覆蓋缺口分析與報告組裝 | 0/TBD | Not started | - |
