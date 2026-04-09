# Research Summary: sync-ai 完整體檢

**Synthesized:** 2026-04-09
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

## Executive Summary

sync-ai 是一個成熟的單檔 CLI 工具（~1800 行，零外部相依），透過 Git 同步 Claude Code 設定。驗證需涵蓋 6 個架構層級，遵循由下而上的依賴順序。所有驗證工具都已包含在 Node.js 內建模組中，零依賴約束完全可滿足。

## Stack Recommendation

| 工具 | 用途 | 來源 |
|------|------|------|
| `node:test` | 測試框架與 mocking | Node.js 內建 |
| `node:assert/strict` | 斷言 | Node.js 內建 |
| `spawnSync` (shell:false) | CLI 整合測試 | Node.js 內建 |
| `fs.mkdtempSync` + `os.tmpdir` | 隔離 fixture | Node.js 內建 |
| `--experimental-test-coverage` | 覆蓋率分析 | Node.js v22+ 穩定 |

## Table Stakes Checks (30 項)

### Dimension 1 — 指令功能正確性 (10 checks)
- diff / to-repo / to-local / skills:diff 正常路徑驗證
- DEVICE_FIELDS 剝離、dry-run 不寫入、exit code 語義

### Dimension 2 — 邊界與錯誤處理 (9 checks)
- SyncError 錯誤碼完整性、askConfirm 非 TTY 行為
- mirrorDir 刪除邏輯、路徑遮罩覆蓋

### Dimension 3 — 跨平台相容性 (6 checks)
- Windows 路徑分隔符、fs.accessSync 行為差異
- diff 外部指令 fallback、toRelativePath Windows 家目錄

### Dimension 4 — 測試覆蓋缺口 (5 checks)
- I/O 函式無測試清單、未測試的 SyncError 碼
- TTY 依賴路徑、LCS fallback 路徑

## Architecture — 驗證順序

由下而上，嚴格依賴順序：

1. **L1+L2** Error Handling + FS Utilities → 基礎信任
2. **L3+L4** Settings Handler + Sync Core → 最高風險的資料轉換
3. **L5+L6** Cross-Cutting + Commands → 端到端整合
4. **Report** 綜合報告組裝

## Top 5 Pitfalls

| # | 陷阱 | 風險 | 預防策略 |
|---|------|------|----------|
| 1 | askConfirm TTY 掛起 | 所有自動化 to-local 驗證被阻塞 | 驗證前需先處理 TTY guard |
| 2 | 序列化不對稱 | DEVICE_FIELDS 剝離後格式不一致 | 斷言 byte-identical 輸出 |
| 3 | Windows fs.accessSync 不可靠 | checkWriteAccess 假陰性/假陽性 | 記錄為已知風險 |
| 4 | LCS fallback 誤導性 diff | >2000 行檔案 diff 結果不精確 | 驗證 isApproximate flag |
| 5 | 只驗 exit code 不驗內容 | 「能跑」≠「正確」 | fixture 需斷言具體變更檔案集 |

## Roadmap Implications

建議 4 個 phases：
1. Foundation Verification (L1+L2)
2. Settings & Sync Core (L3+L4)
3. Cross-Cutting & Commands (L5+L6)
4. Gap Analysis & Report Assembly

Phase 3 前提：askConfirm TTY guard 需先處理（但本 milestone 只產報告，記錄為已知阻塞）。

## Confidence: HIGH

所有發現直接來自 codebase 原始碼（含行號引用）與 Node.js 官方文件。

---
*Research synthesized: 2026-04-09*
