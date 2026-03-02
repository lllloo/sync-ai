## SessionStart 設定同步行為

每次 Claude Code 啟動時，`sync-pull.sh` 會自動比對本機 `~/.claude/` 與 sync repo 的差異。

### 偵測到差異時

若 SessionStart hook 輸出包含「【偵測到本機設定與 sync repo 有差異】」，你必須：

1. 向使用者說明偵測到的差異內容（解讀 diff，`-` 為 repo 版、`+` 為本機版）
2. 讀取兩個版本：
   - 本機版：`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`
   - Repo 版：`/Users/barney/code/sync-ai/claude/CLAUDE.md` 與 `claude/settings.json`
3. 將兩版內容**智慧合併**（保留雙方有、對方無的內容；有衝突時以本機版為主並標註）
4. 向使用者呈現合併後的結果，**主動詢問**：「是否以此合併結果覆蓋本機與 repo？」
5. 使用者確認後，依序執行以下命令：

```bash
cp $HOME/.claude/CLAUDE.md /Users/barney/code/sync-ai/claude/CLAUDE.md
cp $HOME/.claude/settings.json /Users/barney/code/sync-ai/claude/settings.json
cd /Users/barney/code/sync-ai && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
```

6. 回報 commit hash 與 push 結果

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時要求手動同步。

### 無差異時

hook 不輸出任何內容，不需額外提示。
