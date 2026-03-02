# Claude Config 跨裝置同步方案

## 目標

透過 private git repo 同步 `CLAUDE.md` 與 `settings.json`，讓所有裝置的 Claude Code 設定保持一致。

## Repo 結構

```
<your-repo>/
├── CLAUDE.md
├── settings.json
└── install.sh
```

> Repo 路徑自訂，例如 `~/.claude-sync/` 或任意位置。

## install.sh

新電腦 clone repo 後執行一次，將設定複製到正確位置。

```bash
#!/usr/bin/env bash
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

mkdir -p "$CLAUDE_DIR"
cp "$REPO_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
cp "$REPO_DIR/settings.json" "$CLAUDE_DIR/settings.json"

echo "Done."
```

## Hooks（設定於 Claude Code settings.json）

### SessionStart — 開啟 Claude Code 時自動 pull

```bash
cd "<repo-path>" && git pull --quiet 2>/dev/null || true; cp "<repo-path>/CLAUDE.md" "$HOME/.claude/CLAUDE.md"; cp "<repo-path>/settings.json" "$HOME/.claude/settings.json"
```

### Stop — 關閉對話時自動 push

```bash
cp "$HOME/.claude/CLAUDE.md" "<repo-path>/CLAUDE.md"; cp "$HOME/.claude/settings.json" "<repo-path>/settings.json"; cd "<repo-path>" && git pull --rebase --quiet 2>/dev/null || true; git diff --quiet && exit 0; git add CLAUDE.md settings.json && git commit -m "chore: sync $(date +%Y-%m-%d)" && git push --quiet 2>/dev/null || true
```

> 將 `<repo-path>` 替換為實際的 repo 絕對路徑。

## 新電腦設定步驟

1. clone repo 到指定位置
2. 執行 `bash install.sh`
3. 在 Claude Code `settings.json` 的 `hooks` 欄位加入上述兩個 hook

## 注意事項

- 使用 `$HOME` 而非 `~`，跨平台相容性更佳
- Windows 上使用 Git Bash 執行
- Stop hook 加入 `git pull --rebase` 防止多裝置同時修改時 push 失敗
- 沒有變更時（`git diff --quiet`）直接結束，不產生空 commit
