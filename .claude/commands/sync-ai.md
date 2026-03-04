執行 Claude Code 設定同步流程：

1. 執行 `git fetch` 取得 remote 最新資訊，比較 local 與 remote 是否有差異
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「1.  Pull」、「2. 略過」
   - 若選「Pull」：執行 `git pull --ff-only`
2. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
3. 若無差異：將 repo 版複製到本機，顯示「同步完成（無差異）」
4. 若有差異：
   - 使用 AskUserQuestion 工具詢問策略，選項為：「1. 建分支 & Push（手動合併）」、「2. Repo 版覆蓋本機」、「3. 取消」
   - 若選「建分支 & Push（手動合併）」：
     - 以 `sync/<YYYYMMDDHHmm>` 為名建立新分支（例：`sync/202603041530`）
     - 將本機的 CLAUDE.md、settings.json 複製到 repo 的 `claude/` 目錄
     - `git add / commit`（commit 訊息：`sync: 從 <hostname> 同步設定 <YYYYMMDD>`）
     - `git push -u origin <branch>`
     - 顯示分支名稱與 push 結果，提示使用者自行在 GitHub 建立 PR 解衝突後合併
   - 若選「Repo 版覆蓋本機」：將 repo 版複製到本機
   - 顯示同步結果
