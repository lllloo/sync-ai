#!/bin/bash
# Read JSON data that Claude Code sends to stdin
input=$(cat)

# Extract fields using grep/sed (no jq required)
MODEL=$(echo "$input" | grep -o '"display_name":"[^"]*"' | head -1 | sed 's/"display_name":"//;s/"//')
DIR=$(echo "$input" | grep -o '"current_dir":"[^"]*"' | head -1 | sed 's/"current_dir":"//;s/"//')
PCT=$(echo "$input" | grep -o '"used_percentage":[0-9.]*' | head -1 | sed 's/"used_percentage"://' | cut -d. -f1)
PCT=${PCT:-0}

FOLDER=$(basename "$(echo "$DIR" | tr '\\' '/')")
DIR_UNIX=$(echo "$DIR" | tr '\\' '/')

# Extract rate_limits fields using sed to handle nested JSON
# Pattern: extract five_hour and seven_day blocks individually
FIVE_BLOCK=$(echo "$input" | grep -o '"five_hour":{"used_percentage":[0-9.]*,"resets_at":[0-9]*}')
WEEK_BLOCK=$(echo "$input" | grep -o '"seven_day":{"used_percentage":[0-9.]*,"resets_at":[0-9]*}')

FIVE_PCT=$(echo "$FIVE_BLOCK" | grep -o '"used_percentage":[0-9.]*' | grep -o '[0-9.]*$' | cut -d. -f1)
FIVE_RESETS=$(echo "$FIVE_BLOCK" | grep -o '"resets_at":[0-9]*' | grep -o '[0-9]*$')
WEEK_PCT=$(echo "$WEEK_BLOCK" | grep -o '"used_percentage":[0-9.]*' | grep -o '[0-9.]*$' | cut -d. -f1)
WEEK_RESETS=$(echo "$WEEK_BLOCK" | grep -o '"resets_at":[0-9]*' | grep -o '[0-9]*$')

# Function to format seconds into human-readable countdown
format_countdown() {
    local secs=$1
    if [ -z "$secs" ] || [ "$secs" -le 0 ]; then
        echo ""
        return
    fi
    local days=$(( secs / 86400 ))
    local hours=$(( (secs % 86400) / 3600 ))
    local mins=$(( (secs % 3600) / 60 ))
    if [ "$days" -gt 0 ]; then
        echo "${days}d${hours}h"
    elif [ "$hours" -gt 0 ]; then
        echo "${hours}h${mins}m"
    else
        echo "${mins}m"
    fi
}

NOW_EPOCH=$(date +%s)

RATE_STR=""
if [ -n "$FIVE_PCT" ]; then
    FIVE_LABEL="5h:${FIVE_PCT}%"
    if [ -n "$FIVE_RESETS" ]; then
        FIVE_REMAINING=$(( FIVE_RESETS - NOW_EPOCH ))
        FIVE_CD=$(format_countdown "$FIVE_REMAINING")
        [ -n "$FIVE_CD" ] && FIVE_LABEL="${FIVE_LABEL}(${FIVE_CD})"
    fi
    RATE_STR="${RATE_STR} | ${FIVE_LABEL}"
fi
if [ -n "$WEEK_PCT" ]; then
    WEEK_LABEL="7d:${WEEK_PCT}%"
    if [ -n "$WEEK_RESETS" ]; then
        WEEK_REMAINING=$(( WEEK_RESETS - NOW_EPOCH ))
        WEEK_CD=$(format_countdown "$WEEK_REMAINING")
        [ -n "$WEEK_CD" ] && WEEK_LABEL="${WEEK_LABEL}(${WEEK_CD})"
    fi
    RATE_STR="${RATE_STR} | ${WEEK_LABEL}"
fi

if git -C "$DIR_UNIX" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git -C "$DIR_UNIX" branch --show-current 2>/dev/null)
    STAGED=$(git -C "$DIR_UNIX" diff --cached --numstat 2>/dev/null | wc -l | tr -d ' \r')
    MODIFIED=$(git -C "$DIR_UNIX" diff --numstat 2>/dev/null | wc -l | tr -d ' \r')

    GIT_STATUS=""
    [ "$STAGED" -gt 0 ] && GIT_STATUS="${GIT_STATUS}+${STAGED}"
    [ "$MODIFIED" -gt 0 ] && GIT_STATUS="${GIT_STATUS}~${MODIFIED}"
    [ -n "$GIT_STATUS" ] && GIT_STATUS=" $GIT_STATUS"

    echo "[$MODEL] 📁 $FOLDER | 🌿 $BRANCH$GIT_STATUS | ${PCT}% ctx${RATE_STR}"
else
    echo "[$MODEL] 📁 $FOLDER | ${PCT}% ctx${RATE_STR}"
fi
