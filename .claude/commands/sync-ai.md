執行 Claude Code 設定同步流程：

1. 比對本機（`~/.claude/`）與 repo（`claude/`）的 CLAUDE.md 與 settings.json
2. 若無差異：執行 `git pull --ff-only` 並將 repo 版複製到本機，顯示「同步完成（無差異）」
3. 若有差異：
   - 讀取本機版與 repo 版完整內容
   - 智慧合併：CLAUDE.md 保留雙方有、對方無的內容（衝突以本機版為主）；settings.json 合併 `permissions.allow` 陣列（去除重複項，衝突以本機版為主）
   - 呈現合併結果，詢問使用者「是否以此合併結果覆蓋本機與 repo？」
   - 確認後：寫入本機 → cp 到 repo → git add / commit / push
   - 顯示同步結果（commit hash、push 狀態）
