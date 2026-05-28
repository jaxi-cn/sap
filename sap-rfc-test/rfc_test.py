#!/usr/bin/env python3
"""
SAP ECC 连接测试 — pyrfc + SAP NW RFC SDK
调用 RFC_READ_TABLE 读取表数据
"""

import os
import sys
from datetime import datetime

try:
    from pyrfc import Connection, ABAPApplicationError, CommunicationError
except ImportError:
    print("❌ pyrfc 未安装")
    print("   前置条件: 1) 下载 SAP NW RFC SDK 7.50 (me.sap.com)")
    print("             2) pip install pyrfc")
    sys.exit(1)


# ── 连接参数 ────────────────────────────────────────
CONFIG = {
    "ashost": os.environ.get("SAP_HOST",   ""),
    "sysnr":  os.environ.get("SAP_SYSNR",  "00"),
    "client": os.environ.get("SAP_CLIENT", "800"),
    "user":   os.environ.get("SAP_USER",   ""),
    "passwd": os.environ.get("SAP_PASS",   ""),
    "lang":   os.environ.get("SAP_LANG",   "ZH"),
}

READ_TABLE  = os.environ.get("SAP_TABLE",   "T001")
READ_FIELDS = ["BUKRS", "BUTXT", "ORT01", "LAND1"]
MAX_ROWS    = int(os.environ.get("SAP_MAXROWS", "20"))


def connect_sap(config: dict) -> Connection:
    print(f"→ 连接 {config['ashost']}:{config['sysnr']} "
          f"client={config['client']} user={config['user']} ...")
    try:
        conn = Connection(**config)
        print("✅ SAP 连接成功\n")
        return conn
    except CommunicationError as e:
        print(f"❌ 连接失败: {e}")
        sys.exit(1)


def read_table(conn: Connection, table: str, fields: list,
               max_rows: int = 20, where: str = ""):
    print(f"→ 读取表 {table}, 最多 {max_rows} 行 ...")

    try:
        options = [{"TEXT": where}] if where else []

        result = conn.call("RFC_READ_TABLE",
            QUERY_TABLE = table,
            DELIMITER   = "|",
            FIELDS      = [{"FIELDNAME": f} for f in fields],
            OPTIONS     = options,
            ROWCOUNT    = max_rows,
            ROWSKIPS    = 0,
        )

        columns = [f["FIELDNAME"] for f in result["FIELDS"]]
        rows = []
        for line in result["DATA"]:
            wa = line["WA"].rstrip("|")
            if wa:
                rows.append(wa.split("|"))

        print(f"✅ 返回 {len(rows)} 行, {len(columns)} 列\n")
        return columns, rows

    except ABAPApplicationError as e:
        print(f"❌ RFC 错误: {e}")
        return [], []


def display_table(columns: list, rows: list):
    if not rows:
        print("(无数据)")
        return

    col_widths = []
    for i, col in enumerate(columns):
        data_max = max((len(r[i]) for r in rows if i < len(r)), default=0)
        col_widths.append(max(len(col), data_max, 8))

    header = "  ".join(c.ljust(col_widths[i]) for i, c in enumerate(columns))
    print(header)
    print("-" * len(header))

    for row in rows:
        print("  ".join(v.ljust(col_widths[i]) for i, v in enumerate(row)))


def main():
    missing = [k for k, v in CONFIG.items() if not v]
    if missing:
        print("❌ 缺少 SAP 连接参数:\n")
        print("  set SAP_USER=xxx & set SAP_PASS=xxx")
        print("  set SAP_HOST=10.x.x.x & set SAP_CLIENT=800")
        sys.exit(1)

    start = datetime.now()

    conn = connect_sap(CONFIG)
    cols, rows = read_table(conn, READ_TABLE, READ_FIELDS, MAX_ROWS)

    if cols:
        display_table(cols, rows)

    conn.close()

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n⏱ 耗时 {elapsed:.2f}s")


if __name__ == "__main__":
    main()
