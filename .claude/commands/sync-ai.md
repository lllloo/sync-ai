執行 Claude Code 設定同步流程：

1. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
2. 若無差異：執行 `git pull --ff-only` 並將 repo 版複製到本機，顯示「同步完成（無差異）」
3. 若有差異：
   - 讀取本機版與 repo 版完整內容
   - 智慧合併：CLAUDE.md 保留雙方有、對方無的內容；settings.json 合併 `permissions.allow` 陣列（去除重複項），合併後對 `permissions.allow` 陣列進行字母排序；settings.json 其他欄位（如 `language`、`effortLevel` 等）依合併策略決定以哪一版為主
   - 合併策略說明：
     - 「以本機版為主合併」：CLAUDE.md 與 settings.json 其他欄位衝突時，保留本機版內容
     - 「以 Repo 版為主合併」：CLAUDE.md 與 settings.json 其他欄位衝突時，保留 Repo 版內容
   - 呈現差異後，使用 AskUserQuestion 工具以選項方式詢問使用者，選項為：「以 Repo 版為主合併」、「以本機版為主合併」、「以 Repo 版直接覆蓋本機」、「取消」
   - 合併策略補充：
     - 「以 Repo 版直接覆蓋本機」：不合併，直接以 repo 版覆蓋本機，不產生新 commit，只執行 git pull --ff-only 後 cp repo 到本機
   - 依選擇調整合併策略後再執行合併，並再次以選項確認：「確認同步」與「取消」
   - 確認後（合併模式）：寫入本機 → cp 到 repo → git add / commit / push → cp repo 版複製到本機（確保本機與 repo 一致）
   - 確認後（直接覆蓋模式）：git pull --ff-only → cp repo 版複製到本機
   - 顯示同步結果（commit hash、push 狀態）
