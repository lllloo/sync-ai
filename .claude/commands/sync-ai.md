執行 Claude Code 設定同步流程：

1. 執行 `git fetch` 取得 remote 最新資訊，比較 local 與 remote 是否有差異
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「Pull」、「略過」
   - 若選「Pull」：執行 `git pull --ff-only`
2. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
3. 若無差異：將 repo 版複製到本機，顯示「同步完成（無差異）」
4. 若有差異：
   - 使用 AskUserQuestion 工具詢問策略，選項為：「本機 commit（不 push）」、「Repo 版覆蓋本機」、「取消」
   - 若選「本機 commit（不 push）」：
     - 將本機的 CLAUDE.md、settings.json 複製到 repo 的 `claude/` 目錄
     - `git add / commit`（commit 訊息：`sync: 從 <hostname> 同步設定 <YYYYMMDD>`）
     - 顯示 commit 結果，提示使用者視需要自行 push
   - 若選「Repo 版覆蓋本機」：將 repo 版複製到本機
   - 顯示同步結果
