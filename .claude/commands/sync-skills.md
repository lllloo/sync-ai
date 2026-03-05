執行 Claude Code 全域 skills 同步流程：

1. 讀取 repo 的 `skills-lock.json`
2. 執行 `npx skills list -g` 取得本機全域已安裝的 skills 清單
3. 比對兩者差異，顯示狀態摘要，格式如下：
   ```
   📋 Skills 同步狀態：
     frontend-design    — ✅ 一致
     typescript-types   — ⚠️ repo 有，本機缺少
     my-local-skill     — ⚠️ 本機有，repo 缺少
   ```

4. 若全部一致：顯示「Skills 同步完成（無差異）」

5. 若有差異：顯示差異說明，然後使用 AskUserQuestion 詢問策略，選項為：「1. 用本機設定覆蓋雲端」、「2. 用雲端設定覆蓋本機」、「3. 取消」

   - 若選「1. 用本機設定覆蓋雲端」：
     - 執行 `npx skills add <source> -y --skill <name> --agent claude-code` 將本機全域 skills 安裝到 repo（專案層級）
     - 更新 `skills-lock.json`
     - 使用 AskUserQuestion 詢問「是否自動 commit 並 push？」，選項為「1. 自動 commit 並 push」、「2. 自行處理」
       - 若選「1. 自動 commit 並 push」：執行 `git add skills-lock.json`、`git commit`（訊息格式：`sync: 從 <hostname> 同步 skills <YYMMDDHHmm>`）、`git push`
       - 若選「2. 自行處理」：不執行任何 git 操作，提示使用者自行 commit 與 push

   - 若選「2. 用雲端設定覆蓋本機」：
     - 對 repo `skills-lock.json` 中本機缺少的每個 skill，執行 `npx skills add <source> -g -y --skill <name> --agent claude-code` 安裝到全域

   - 若選「3. 取消」：不執行任何操作
