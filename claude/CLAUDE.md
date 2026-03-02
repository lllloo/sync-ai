## SessionStart 設定同步行為

每次 Claude Code 啟動時，`sync-pull.sh` 會自動比對本機 `~/.claude/` 與 sync repo 的差異。

### 偵測到差異時

若 SessionStart hook 輸出包含「【偵測到本機設定與 sync repo 有差異】」，你必須：

1. 向使用者說明偵測到的差異內容（引用 hook 輸出的分析）
2. **主動詢問**：「是否要將本機設定同步到 sync repo？」
3. 使用者確認後，依序執行以下命令：

```bash
cp $HOME/.claude/CLAUDE.md /Users/barney/code/sync-ai/claude/CLAUDE.md
cp $HOME/.claude/settings.json /Users/barney/code/sync-ai/claude/settings.json
cd /Users/barney/code/sync-ai && git add claude/CLAUDE.md claude/settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push
```

4. 回報 commit hash 與 push 結果

### 使用者拒絕同步

說明本機設定與 repo 有差異，提示可隨時要求手動同步。

### 無差異時

hook 不輸出任何內容，不需額外提示。
