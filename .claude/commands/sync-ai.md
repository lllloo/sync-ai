執行 Claude Code 設定同步流程：

1. 執行 `git fetch` 取得 remote 最新資訊，比較 local 與 remote 是否有差異
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「1. Pull」、「2. 略過」
   - 若選「Pull」：執行 `git pull --ff-only`

2. 逐檔比對本機與 repo 的所有同步檔案：
   - **CLAUDE.md**（`~/.claude/CLAUDE.md` ↔ `claude/CLAUDE.md`）：直接比對完整內容
   - **settings.json**（`~/.claude/settings.json` ↔ `claude/settings.json`）：比對時忽略裝置特定欄位（`model`、`effortLevel`），將兩邊 JSON 載入後移除這些欄位再比較。同步時仍複製完整檔案，只有判斷「是否有差異」時排除。
   - **skills**：讀取 repo 的 `skills-lock.json`，與 `npx skills list -g` 比對，找出全域未安裝的 skills

3. 顯示逐檔狀態摘要，格式如下：
   ```
   📋 同步狀態：
     CLAUDE.md     — ✅ 一致
     settings.json — ⚠️ 有差異
     skills        — ⚠️ 有差異（本機缺少：frontend-design）
   ```

4. 若全部一致：顯示「同步完成（無差異）」

5. 若有差異：針對每個有差異的項目顯示說明，然後使用 AskUserQuestion 詢問策略，選項為：「1. 用本機設定覆蓋雲端」、「2. 用雲端設定覆蓋本機」、「3. 取消」

   **CLAUDE.md / settings.json：**
   - 若選「1. 用本機設定覆蓋雲端」：將本機的對應檔案複製到 repo 對應目錄（`claude/`），顯示 diff，再使用 AskUserQuestion 詢問「是否自動 commit 並 push？」，選項為「1. 自動 commit 並 push」、「2. 自行處理」
     - 若選「1. 自動 commit 並 push」：執行 `git add`、`git commit`（訊息格式：`sync: 從 <hostname> 同步設定 <YYMMDDHHmm>`）、`git push`
     - 若選「2. 自行處理」：不執行任何 git 操作，提示使用者自行 commit 與 push
   - 若選「2. 用雲端設定覆蓋本機」：將 repo 版複製到本機
   - 若選「3. 取消」：不執行任何操作

   **skills：**
   - 若選「1. 用本機設定覆蓋雲端」：執行 `npx skills add <source> --skill <name> --agent claude-code` 將本機全域 skills 安裝到 repo（專案層級），更新 `skills-lock.json`，再詢問是否自動 commit 並 push
   - 若選「2. 用雲端設定覆蓋本機」：對 repo `skills-lock.json` 中每個缺少的 skill，執行 `npx skills add <source> -g --skill <name> --agent claude-code` 安裝到全域
   - 若選「3. 取消」：不執行任何操作
