執行 Claude Code 設定同步流程：

1. 執行 `git fetch` 取得 remote 最新資訊，比較 local 與 remote 是否有差異
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「1. Pull」、「2. 略過」
   - 若選「Pull」：執行 `git pull --ff-only`

2. 逐檔比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
   - **settings.json 智慧比對**：比對時忽略裝置特定欄位（`model`、`effortLevel`），將兩邊 JSON 載入後移除這些欄位再比較。同步時仍複製完整檔案，只有判斷「是否有差異」時排除。
   - **CLAUDE.md**：直接比對完整內容

3. 顯示逐檔狀態摘要，格式如下：
   ```
   📋 同步狀態：
     CLAUDE.md      — ✅ 一致
     settings.json  — ⚠️ 有差異
   ```

4. 若全部一致：顯示「同步完成（無差異）」

5. 若有差異：針對每個有差異的檔案顯示 diff（標明檔名），然後使用 AskUserQuestion 詢問策略，選項為：「1. 用本機設定覆蓋雲端」、「2. 用雲端設定覆蓋本機」、「3. 取消」
   - 若選「1. 用本機設定覆蓋雲端」：將本機的對應檔案複製到 repo 的 `claude/` 目錄，顯示 diff，再使用 AskUserQuestion 詢問「是否自動 commit 並 push？」，選項為「1. 自動 commit 並 push」、「2. 自行處理」
     - 若選「1. 自動 commit 並 push」：執行 `git add`、`git commit`（訊息格式：`sync: 從 <hostname> 同步設定 <YYMMDDHHmm>`）、`git push`
     - 若選「2. 自行處理」：不執行任何 git 操作，提示使用者自行 commit 與 push
   - 若選「2. 用雲端設定覆蓋本機」：將 repo 版複製到本機
   - 若選「3. 取消」：不執行任何操作
