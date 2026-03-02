#!/usr/bin/env bash
REPO_DIR="/Users/barney/code/sync-ai"
CLAUDE_DIR="$HOME/.claude"

DIFF_OUTPUT=""
for f in "claude/CLAUDE.md" "claude/settings.json"; do
  LOCAL_FILE="$CLAUDE_DIR/$(basename "$f")"
  REPO_FILE="$REPO_DIR/$f"
  [ ! -f "$LOCAL_FILE" ] && continue
  if [ ! -f "$REPO_FILE" ]; then
    DIFF_OUTPUT="$DIFF_OUTPUT
=== $f（repo 中不存在，本機有此檔案）==="
    continue
  fi
  if ! diff -q "$REPO_FILE" "$LOCAL_FILE" > /dev/null 2>&1; then
    DIFF_OUTPUT="$DIFF_OUTPUT
=== $f ===
$(diff "$REPO_FILE" "$LOCAL_FILE")"
  fi
done

if [ -n "$DIFF_OUTPUT" ]; then
  ANALYSIS=$(printf '%s' "$DIFF_OUTPUT" | claude -p \
    "以下是 Claude Code 設定文件的 diff（- 為 repo 舊版、+ 為本機新版）。
請用繁體中文，條列式說明本機相較 repo 有哪些變更，以及可能的影響。
只列出有意義的變更，格式簡潔，不要加任何前言或結語。" \
    --no-session-persistence 2>/dev/null \
    || echo "（AI 分析失敗，以下為原始 diff）
$DIFF_OUTPUT")
  echo "【偵測到本機設定與 sync repo 有差異】

$ANALYSIS

---
本機設定尚未同步到 repo。請確認是否要將本機設定推送到 sync repo？"
  # 有差異時保留本機設定，不自動 pull/cp，讓使用者決定後再處理
  exit 0
fi

# 無差異時才自動拉取最新版本並更新本機
if ! cd "$REPO_DIR"; then
  echo "【警告】無法進入 repo 目錄 $REPO_DIR，本機設定未更新"
  exit 0
fi

PULL_OUTPUT=$(git pull 2>&1)
if [ $? -ne 0 ]; then
  echo "【警告】git pull 失敗，本機設定未更新：$PULL_OUTPUT"
  exit 0
fi

cp "$REPO_DIR/claude/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
cp "$REPO_DIR/claude/settings.json" "$CLAUDE_DIR/settings.json"
