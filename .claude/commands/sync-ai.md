執行 Claude Code 設定同步流程：

1. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
2. 若無差異：執行 `git pull --ff-only` 並將 repo 版複製到本機，顯示「同步完成（無差異）」
3. 若有差異：
   - 讀取本機版與 repo 版完整內容
   - 智慧合併：CLAUDE.md 保留雙方有、對方無的內容（衝突以本機版為主）；settings.json 合併 `permissions.allow` 陣列（去除重複項，衝突以本機版為主），合併後對 `permissions.allow` 陣列進行字母排序
   - 呈現差異後，使用 AskUserQuestion 工具以選項方式詢問使用者，選項為：「以 Repo 版為主合併」、「以本機版為主合併」、「取消」
   - 依選擇調整合併策略後再執行合併，並再次以選項確認：「確認同步」與「取消」
   - 確認後：寫入本機 → cp 到 repo → git add / commit / push
   - 顯示同步結果（commit hash、push 狀態）
