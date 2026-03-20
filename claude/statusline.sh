#!/bin/bash
# Read JSON data that Claude Code sends to stdin
input=$(cat)

# Extract fields using bash built-in regex (no subprocesses)
[[ $input =~ \"display_name\":\"([^\"]+)\" ]] && MODEL="${BASH_REMATCH[1]}"
[[ $input =~ \"current_dir\":\"([^\"]+)\" ]]  && DIR="${BASH_REMATCH[1]}"
[[ $input =~ \"used_percentage\":([0-9]+) ]]   && PCT="${BASH_REMATCH[1]}"
PCT=${PCT:-0}

# Convert Windows path → Unix; derive FOLDER with parameter expansion (single subprocess)
DIR_UNIX=$(printf '%s' "$DIR" | tr '\\' '/')
FOLDER="${DIR_UNIX##*/}"

# Extract rate_limits blocks
FIVE_BLOCK=$(echo "$input" | grep -o '"five_hour":{"used_percentage":[0-9.]*,"resets_at":[0-9]*}')
WEEK_BLOCK=$(echo "$input" | grep -o '"seven_day":{"used_percentage":[0-9.]*,"resets_at":[0-9]*}')

# Parse blocks with single sed call instead of grep|grep|cut chain
FIVE_PCT=$(echo "$FIVE_BLOCK"    | sed -n 's/.*"used_percentage":\([0-9]*\).*/\1/p')
FIVE_RESETS=$(echo "$FIVE_BLOCK" | sed -n 's/.*"resets_at":\([0-9]*\).*/\1/p')
WEEK_PCT=$(echo "$WEEK_BLOCK"    | sed -n 's/.*"used_percentage":\([0-9]*\).*/\1/p')
WEEK_RESETS=$(echo "$WEEK_BLOCK" | sed -n 's/.*"resets_at":\([0-9]*\).*/\1/p')

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

if GIT_OUT=$(git -C "$DIR_UNIX" status --porcelain=v1 -b 2>/dev/null); then
    BRANCH=$(printf '%s\n' "$GIT_OUT" | sed -n 's/^## \([^. ]*\).*/\1/p')
    STAGED=$(printf '%s\n' "$GIT_OUT"   | tail -n +2 | grep -c '^[^ ?]')
    MODIFIED=$(printf '%s\n' "$GIT_OUT" | tail -n +2 | grep -c '^.[^ ?]')

    GIT_STATUS=""
    [ "$STAGED" -gt 0 ] && GIT_STATUS="${GIT_STATUS}+${STAGED}"
    [ "$MODIFIED" -gt 0 ] && GIT_STATUS="${GIT_STATUS}~${MODIFIED}"
    [ -n "$GIT_STATUS" ] && GIT_STATUS=" $GIT_STATUS"

    echo "[$MODEL] 📁 $FOLDER | 🌿 $BRANCH$GIT_STATUS | ${PCT}% ctx${RATE_STR}"
else
    echo "[$MODEL] 📁 $FOLDER | ${PCT}% ctx${RATE_STR}"
fi
