#!/bin/bash
# SAP RFC test - Unix launcher (pyrfc + NW RFC SDK)
# Usage: source .env && bash run.sh [table] [max_rows]

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "$SAP_USER" ] || [ -z "$SAP_PASS" ] || [ -z "$SAP_HOST" ]; then
    echo "[X] Missing connection params. Run: cp .env.example .env && source .env"
    exit 1
fi

[ -n "$1" ] && export SAP_TABLE="$1"
[ -n "$2" ] && export SAP_MAXROWS="$2"

echo "-> SAP: $SAP_HOST sysnr=$SAP_SYSNR client=$SAP_CLIENT"
echo "-> Table: ${SAP_TABLE:-T001}"
echo ""
python3 rfc_test.py
