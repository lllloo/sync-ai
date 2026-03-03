# sync-ai

跨裝置同步 Claude Code 設定（`~/.claude/CLAUDE.md` 與 `~/.claude/settings.json`）的私有 Git repo 工具。

## 快速開始

### 新裝置部署

```bash
git clone <your-repo-url>
```

clone 後，請 Claude 執行初始化：

> 「請初始化 sync-ai，將 repo 設定複製到本機」

### 日常同步

在此專案目錄中輸入：

```
/sync-ai
```

Claude 會自動比對本機與 repo 的差異，智慧合併後詢問確認，完成後 commit & push。

## 同步邏輯

| 情況 | 行為 |
|------|------|
| 無差異 | `git pull` 後複製 repo 版到本機 |
| 有差異 | 智慧合併 → 確認 → 寫入本機 + push |

- `CLAUDE.md`：保留雙方差異，衝突以本機為主
- `settings.json`：合併 `permissions.allow` 並去重排序，其他衝突以本機為主

## 檔案結構

```
claude/
  CLAUDE.md        # 同步的全域 Claude 指示
  settings.json    # 同步的 Claude Code 設定
.claude/
  commands/
    sync-ai.md     # /sync-ai slash command 定義
```
