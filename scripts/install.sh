#!/bin/bash
set -e

SKILL_DIR="$HOME/.claude/skills/ads-gen"
REPO_URL="https://raw.githubusercontent.com/ioklmj1/ads-gen/main"

echo ""
echo "  Installing /ads-gen"
echo "  Multi-agent orchestration system for video commercial production"
echo ""

mkdir -p "$SKILL_DIR"

echo "  Downloading skill file..."
curl -sL "$REPO_URL/SKILL.md" -o "$SKILL_DIR/SKILL.md"

echo ""
echo "  Installed to $SKILL_DIR/SKILL.md"
echo ""
echo "  Open Claude Code and type: /ads-gen"
echo ""

# Check for required tools
echo "  Checking dependencies..."

check_tool() {
    if command -v "$1" &> /dev/null; then
        echo "    $1: found"
    else
        echo "    $1: NOT FOUND (required)"
    fi
}

check_key() {
    if [ -n "${!1}" ]; then
        echo "    $1: set"
    else
        echo "    $1: NOT SET"
    fi
}

check_tool ffmpeg
check_tool ffprobe
check_tool node

echo ""
echo "  Checking API keys..."

check_key KLING_ACCESS_KEY
check_key KLING_SECRET_KEY
check_key GEMINI_API_KEY
check_key ELEVENLABS_API_KEY
check_key HUME_API_KEY
check_key MINIMAX_API_KEY
check_key SYNC_API_KEY

echo ""
echo "  Done."
echo ""
