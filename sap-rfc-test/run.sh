#!/bin/bash
# SAP ECC 表读取 — 快速启动 (Unix)
# 用法: source .env && bash run.sh [表名] [-n 行数]

set -e
[ -z "$SAP_USER" ] && echo "请先: cp .env.example .env && source .env" && exit 1
python3 sap_reader.py "$@"
