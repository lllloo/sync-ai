#!/bin/bash
# Read JSON data from stdin
input=$(cat)

# Parse with bash regex (no subprocesses)
[[ $input =~ \"display_name\":\"([^\"]+)\" ]] && MODEL="${BASH_REMATCH[1]}"
[[ $input =~ \"current_dir\":\"([^\"]+)\" ]]  && DIR="${BASH_REMATCH[1]}"
[[ $input =~ \"used_percentage\":([0-9]+) ]]   && PCT="${BASH_REMATCH[1]}"
PCT=${PCT:-0}

# Windows path → Unix with parameter expansion (no subprocess)
DIR_UNIX="${DIR//\\//}"
FOLDER="${DIR_UNIX##*/}"

# Parse rate_limits with bash regex (no subprocess)
FIVE_PCT="" FIVE_RESETS=""
WEEK_PCT="" WEEK_RESETS=""
[[ $input =~ \"five_hour\":\{\"used_percentage\":([0-9.]+),\"resets_at\":([0-9]+)\} ]] && {
    FIVE_PCT="${BASH_REMATCH[1]}"
    FIVE_RESETS="${BASH_REMATCH[2]}"
}
[[ $input =~ \"seven_day\":\{\"used_percentage\":([0-9.]+),\"resets_at\":([0-9]+)\} ]] && {
    WEEK_PCT="${BASH_REMATCH[1]}"
    WEEK_RESETS="${BASH_REMATCH[2]}"
}

# Current epoch
NOW_EPOCH=$(date +%s)

# Format countdown — store result in _CD to avoid $() subshell
_CD=""
format_countdown() {
    local secs=$1
    _CD=""
    [[ -z "$secs" || "$secs" -le 0 ]] && return
    local days=$(( secs / 86400 ))
    local hours=$(( (secs % 86400) / 3600 ))
    local mins=$(( (secs % 3600) / 60 ))
    if   [ "$days"  -gt 0 ]; then _CD="${days}d${hours}h"
    elif [ "$hours" -gt 0 ]; then _CD="${hours}h${mins}m"
    else                          _CD="${mins}m"
    fi
}

RATE_STR=""
if [ -n "$FIVE_PCT" ]; then
    printf -v FIVE_PCT_INT '%.0f' "$FIVE_PCT"
    FIVE_LABEL="5h:${FIVE_PCT_INT}%"
    if [ -n "$FIVE_RESETS" ]; then
        format_countdown $(( FIVE_RESETS - NOW_EPOCH ))
        [ -n "$_CD" ] && FIVE_LABEL="${FIVE_LABEL}(${_CD})"
    fi
    RATE_STR="${RATE_STR} | ${FIVE_LABEL}"
fi
if [ -n "$WEEK_PCT" ]; then
    printf -v WEEK_PCT_INT '%.0f' "$WEEK_PCT"
    WEEK_LABEL="7d:${WEEK_PCT_INT}%"
    if [ -n "$WEEK_RESETS" ]; then
        format_countdown $(( WEEK_RESETS - NOW_EPOCH ))
        [ -n "$_CD" ] && WEEK_LABEL="${WEEK_LABEL}(${_CD})"
    fi
    RATE_STR="${RATE_STR} | ${WEEK_LABEL}"
fi

BRANCH_OUT=$(git -C "$DIR_UNIX" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH_OUT" ]; then
    BRANCH="$BRANCH_OUT"
    echo "[$MODEL] 📁 $FOLDER | 🌿 $BRANCH | ${PCT}% ctx${RATE_STR}"
else
    echo "[$MODEL] 📁 $FOLDER | ${PCT}% ctx${RATE_STR}"
fi
