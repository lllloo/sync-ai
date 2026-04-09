# Requirements: sync-ai 完整體檢

**Defined:** 2026-04-09
**Core Value:** 確認所有同步指令在各種情境下行為正確，不會造成使用者設定遺失或損壞

## v1 Requirements

### 指令功能正確性 (FUNC)

- [ ] **FUNC-01**: diff 指令無差異時回傳 exit code 0，有差異時回傳 exit code 1
- [ ] **FUNC-02**: diff 指令正確顯示 file / settings / dir 三種類型的差異
- [ ] **FUNC-03**: to-repo 指令正確將本機 CLAUDE.md / statusline.sh 複製到 repo
- [ ] **FUNC-04**: to-repo 指令同步 settings.json 時剝離 DEVICE_FIELDS（model / effortLevel）
- [ ] **FUNC-05**: to-repo 指令正確鏡像 agents/ 與 commands/ 目錄
- [ ] **FUNC-06**: to-local 指令顯示預覽後經使用者確認才套用變更
- [ ] **FUNC-07**: to-local 指令同步 settings.json 時保留本機 DEVICE_FIELDS
- [ ] **FUNC-08**: dry-run 模式下所有指令不寫入任何檔案
- [ ] **FUNC-09**: skills:diff 只輸出建議指令（安裝/移除），不執行操作
- [ ] **FUNC-10**: status 指令同時執行 diff + skills:diff 並顯示兩者結果

### 邊界與錯誤處理 (EDGE)

- [ ] **EDGE-01**: 來源檔案不存在時產生 FILE_NOT_FOUND SyncError
- [ ] **EDGE-02**: JSON 格式損壞時產生 JSON_PARSE SyncError
- [ ] **EDGE-03**: 檔案權限不足時產生 PERMISSION SyncError
- [ ] **EDGE-04**: 無效指令或引數時產生 INVALID_ARGS SyncError
- [ ] **EDGE-05**: 所有錯誤訊息中的路徑經 toRelativePath 遮罩
- [ ] **EDGE-06**: mirrorDir 正確刪除目的目錄中來源沒有的檔案
- [ ] **EDGE-07**: writeJsonSafe 原子寫入（tmp + rename）正常運作
- [ ] **EDGE-08**: askConfirm 在非 TTY 環境下的行為評估
- [ ] **EDGE-09**: LCS diff 超過 2000 行閾值時正確切換 fallback 並標記 isApproximate

### 跨平台相容性 (PLAT)

- [ ] **PLAT-01**: toRelativePath 在 Windows 家目錄路徑正確轉換
- [ ] **PLAT-02**: 外部 diff 指令不可用時 JS fallback（computeLineDiff）正確啟動
- [ ] **PLAT-03**: fs.accessSync 在 Windows 上的行為差異評估與風險記錄
- [ ] **PLAT-04**: buildSyncItems 產出的路徑在 Windows / macOS 上均有效
- [ ] **PLAT-05**: settings.json 序列化在兩平台產出 byte-identical 結果
- [ ] **PLAT-06**: spawnSync 呼叫（skills list / git / diff）在 Windows 正確運作

### 測試覆蓋缺口分析 (GAPS)

- [ ] **GAPS-01**: 列出所有 sync.js 匯出但無對應單元測試的純函式
- [ ] **GAPS-02**: 列出所有 I/O 函式（copyFile / mirrorDir / writeJsonSafe 等）的測試狀態
- [ ] **GAPS-03**: 列出未被任何測試觸發的 SyncError 錯誤碼
- [ ] **GAPS-04**: 列出程式碼中的條件分支覆蓋缺口（LCS fallback / EXDEV fallback 等）
- [ ] **GAPS-05**: 針對每個缺口提出具體補強建議與範例測試程式碼

## v2 Requirements

### 進階驗證

- **ADV-01**: 使用 --experimental-test-coverage 產出精確覆蓋率報告
- **ADV-02**: 建立自動化整合測試 (test/integration.test.js)
- **ADV-03**: .sync-history.log 安全性稽核（確認不含敏感路徑）
- **ADV-04**: skills-lock.json 不可變性驗證

## Out of Scope

| Feature | Reason |
|---------|--------|
| 修復發現的問題 | PROJECT.md 明確界定只產報告 |
| 效能調優或基準測試 | 工具規模小，效能非重點 |
| 新功能開發 | 純驗證任務 |
| 自動化 patch 生成 | 超出報告範圍 |
| CI/CD pipeline 建置 | 超出同步工具本身範圍 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FUNC-01 | Phase 1 | Pending |
| FUNC-02 | Phase 1 | Pending |
| FUNC-03 | Phase 1 | Pending |
| FUNC-04 | Phase 1 | Pending |
| FUNC-05 | Phase 1 | Pending |
| FUNC-06 | Phase 1 | Pending |
| FUNC-07 | Phase 1 | Pending |
| FUNC-08 | Phase 1 | Pending |
| FUNC-09 | Phase 1 | Pending |
| FUNC-10 | Phase 1 | Pending |
| EDGE-01 | Phase 2 | Pending |
| EDGE-02 | Phase 2 | Pending |
| EDGE-03 | Phase 2 | Pending |
| EDGE-04 | Phase 2 | Pending |
| EDGE-05 | Phase 2 | Pending |
| EDGE-06 | Phase 2 | Pending |
| EDGE-07 | Phase 2 | Pending |
| EDGE-08 | Phase 2 | Pending |
| EDGE-09 | Phase 2 | Pending |
| PLAT-01 | Phase 3 | Pending |
| PLAT-02 | Phase 3 | Pending |
| PLAT-03 | Phase 3 | Pending |
| PLAT-04 | Phase 3 | Pending |
| PLAT-05 | Phase 3 | Pending |
| PLAT-06 | Phase 3 | Pending |
| GAPS-01 | Phase 4 | Pending |
| GAPS-02 | Phase 4 | Pending |
| GAPS-03 | Phase 4 | Pending |
| GAPS-04 | Phase 4 | Pending |
| GAPS-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial definition*
