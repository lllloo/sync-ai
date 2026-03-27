# sync-ai 改寫為獨立 Node.js 腳本

## Context

目前的 `/sync-ai` 依賴 Claude AI 來解讀 `sync-ai.md` 的指令並逐步執行，每次同步都需要 AI 在場。
目標：改成可直接執行的 npm 指令，不依賴 AI，邏輯完全在腳本裡。

兩個指令：
- `npm run push` — **本機 → repo**：把本機設定上傳到 repo
- `npm run pull` — **repo → 本機**：把 repo 設定套用到本機

---

## 新流程

### `npm run push`（本機 → repo）

1. `git pull --ff-only`（失敗時中止並提示手動解決，避免覆蓋衝突）
2. 複製本機檔案 → repo：
   - `~/.claude/CLAUDE.md`         → `claude/CLAUDE.md`
   - `~/.claude/settings.json`     → `claude/settings.json`（排除裝置特定欄位）
   - `~/.claude/statusline.sh`     → `claude/statusline.sh`
   - `~/.claude/agents/`           → `claude/agents/`（整目錄鏡像）
   - `~/.claude/commands/`         → `claude/commands/`（整目錄鏡像，排除 sync-ai* 自身）
3. 讀取 `~/.agents/.skill-lock.json` → 更新 repo 的 `skills-lock.json`（只保留 source、sourceType）
4. `git add` → `git commit -m "sync: 從 <hostname> 同步 <YYMMDDHHmm>"` → `git push`
5. 顯示摘要（哪些檔案有變動）

### `npm run pull`（repo → 本機）

1. `git pull --ff-only`（失敗時中止並提示）
2. 複製 repo 檔案 → 本機：
   - `claude/CLAUDE.md`       → `~/.claude/CLAUDE.md`
   - `claude/settings.json`   → `~/.claude/settings.json`（**merge**：保留本機裝置特定欄位）
   - `claude/statusline.sh`   → `~/.claude/statusline.sh`
   - `claude/agents/`         → `~/.claude/agents/`（整目錄鏡像）
   - `claude/commands/`       → `~/.claude/commands/`（整目錄鏡像）
3. 比對 `skills-lock.json` 與 `~/.agents/.skill-lock.json`，對差異的 skill 執行：
   `npx skills add -g <source> -s <skillname> -y`
4. 顯示摘要（哪些檔案有更新、哪些 skills 有安裝）

---

## 重要細節

### settings.json 裝置特定欄位排除（push 時）
同步時從 `~/.claude/settings.json` 讀取後，移除這些欄位再寫入 repo：
- `model`
- `effortLevel`
- `statusLine`

### settings.json merge 策略（pull 時）
從 repo 套用時，先讀本機現有的 `settings.json`，保留裝置特定欄位，再用 repo 的其餘設定覆蓋：
1. 讀本機，暫存 `model`、`effortLevel`、`statusLine`
2. 以 repo 版本為基礎
3. 將步驟 1 的值回填

### skills 同步策略

**push**：讀取 `~/.agents/.skill-lock.json`，只抽取 `source`、`sourceType` 欄位寫入 repo 的 `skills-lock.json`。

**pull**：比對 repo `skills-lock.json` 與本機 `~/.agents/.skill-lock.json`，對每個 repo 有但本機無的 skill（或 source 不同的），執行：
```
npx skills add -g <source> -s <skillname> -y
```
> 注意：`experimental_install` 只裝到專案目錄，不裝全域，所以用 `skills add -g`。

---

### agents / commands 鏡像策略
**完整鏡像**：以 source 端為準。
- `push`：本機有什麼 repo 就有什麼，本機沒有的 repo 也刪掉
- `pull`：repo 有什麼本機就有什麼，repo 沒有的本機也刪掉

### git pull 失敗處理
`--ff-only` 失敗（有 diverge）時，**中止並顯示提示**，不繼續執行，讓用戶手動 `git pull` 解決衝突。

### commands 目錄排除（push 時）
`~/.claude/commands/` 裡的 `sync-ai.md`（舊的 slash command）不複製進 repo。

---

## 檔案異動

### 新增
- `sync.js`（根目錄）— 主腳本，無外部相依
- `package.json`（根目錄）— 定義 `npm run push` / `npm run pull`

### 刪除
- `.claude/commands/sync-ai.md`
- `.claude/commands/sync-ai-diff.js`
- `.claude/commands/sync-ai-apply.js`

### 修改
- `CLAUDE.md`（專案）— 更新說明，改為 `npm run push` / `npm run pull`
- `.gitignore` — 補上 `node_modules/`、`*.log`
- `plan.md` — 本檔案

---

## sync.js 架構

無外部相依，只用 Node.js built-in（`fs`、`path`、`os`、`child_process`）。

```
main(mode)                          // mode: 'push' | 'pull'
  ├── gitPull()                     // 兩個 mode 都先 pull
  ├── copyFile(src, dest)           // 單一檔案
  ├── mergeSettingsJson(mode)       // push 排除裝置欄位；pull 保留裝置欄位
  ├── mirrorDir(src, dest, exclude) // 整目錄鏡像
  ├── syncSkills(mode)              // push：~/.agents/.skill-lock.json → skills-lock.json
  │                                //  pull：skills-lock.json → npx skills add -g
  └── gitCommitPush(changes)        // 僅 push mode 執行
```

`package.json` scripts：
```json
{
  "scripts": {
    "push": "node sync.js push",
    "pull": "node sync.js pull"
  }
}
```

---

## 驗證

### push
1. 執行 `npm run push`
2. 確認 `claude/` 與 `~/.claude/` 一致
3. 確認 `settings.json` 未含裝置特定欄位
4. 確認 `git log` 有新 commit 且遠端已收到

### pull
1. 在另一台裝置（或手動修改 repo）執行 `npm run pull`
2. 確認 `~/.claude/` 已更新為 repo 內容
3. 確認本機的 `model`、`effortLevel`、`statusLine` 未被覆蓋
