執行 Claude Code 設定同步流程：

1. 執行 `git fetch` 取得 remote 最新資訊，比較 local 與 remote 是否有差異
   - 若 remote 有新 commit：使用 AskUserQuestion 詢問「Remote 有新版，是否執行 git pull？」，選項為「1. Pull」、「2. 略過」
   - 若選「Pull」：執行 `git pull --ff-only`
2. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
3. 若無差異：顯示「同步完成（無差異）」
4. 若有差異：使用 AskUserQuestion 詢問策略，選項為：「1. 用本機設定覆蓋雲端」、「2. 用雲端設定覆蓋本機」、「3. 取消」
   - 若選「1. 用本機設定覆蓋雲端」：將本機的 CLAUDE.md、settings.json 複製到 repo 的 `claude/` 目錄，顯示 diff，提示使用者自行決定是否 commit 與 push
   - 若選「2. 用雲端設定覆蓋本機」：將 repo 版複製到本機
   - 若選「3. 取消」：不執行任何操作
