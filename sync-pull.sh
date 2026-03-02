#!/usr/bin/env bash
REPO_DIR="/Users/barney/code/sync-ai"
CLAUDE_DIR="$HOME/.claude"

# 1. 取得最新設定
cd "$REPO_DIR" && git pull --quiet 2>/dev/null || true

# 2. 計算 diff
DIFF_OUTPUT=""
for f in CLAUDE.md settings.json; do
  if [ -f "$CLAUDE_DIR/$f" ] && ! diff -q "$REPO_DIR/$f" "$CLAUDE_DIR/$f" > /dev/null 2>&1; then
    DIFF_OUTPUT="$DIFF_OUTPUT
=== $f ===
$(diff "$CLAUDE_DIR/$f" "$REPO_DIR/$f")"
  fi
done

# 3. 有差異時，用 AI 分析並輸出到 stdout（成為 Claude 的對話上下文）
if [ -n "$DIFF_OUTPUT" ]; then
  ANALYSIS=$(printf '%s' "$DIFF_OUTPUT" | claude -p \
    "以下是 Claude Code 設定文件的 diff（- 為舊版、+ 為新版）。
    請用繁體中文，條列式說明哪些設定被更新、新增或移除，以及可能的影響。
    只需列出實際有意義的變更，格式簡潔。" \
    --no-session-persistence 2>/dev/null \
    || echo "（無法取得 AI 分析，以下為原始 diff）
$DIFF_OUTPUT")
  echo "【Claude 設定已從 sync repo 更新】
$ANALYSIS"
fi

# 4. 複製文件到 ~/.claude
cp "$REPO_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
cp "$REPO_DIR/settings.json" "$CLAUDE_DIR/settings.json"
