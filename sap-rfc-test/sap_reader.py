#!/usr/bin/env python3
"""
SAP ECC 表读取工具
用法: python sap_reader.py <表名> [-n 行数] [-f 字段...] [-w WHERE条件]

三模式自动选择:
  1. pyrfc   (最快, 需 SAP NW RFC SDK)
  2. requests (HTTP/SOAP, pip install requests)
  3. urllib   (HTTP/SOAP, Python 自带, 零依赖)
"""

import os
import sys
import argparse
import base64
import xml.etree.ElementTree as ET
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


# ── 检测可用模式 ────────────────────────────────────
PYRFC_AVAILABLE = False
try:
    from pyrfc import Connection, CommunicationError, ABAPApplicationError
    PYRFC_AVAILABLE = True
except ImportError:
    pass

REQUESTS_AVAILABLE = False
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    pass


# ── 公共：连接参数 ──────────────────────────────────
def get_config():
    cfg = {
        "host":   os.environ.get("SAP_HOST",   ""),
        "sysnr":  os.environ.get("SAP_SYSNR",  "00"),
        "client": os.environ.get("SAP_CLIENT", "800"),
        "user":   os.environ.get("SAP_USER",   ""),
        "passwd": os.environ.get("SAP_PASS",   ""),
        "lang":   os.environ.get("SAP_LANG",   "ZH"),
        "port":   os.environ.get("SAP_PORT",   "8000"),
    }

    missing = [k for k in ("host", "user", "passwd") if not cfg.get(k)]
    if missing:
        print("缺少 SAP 连接参数:\n")
        print("  set SAP_USER=用户名")
        print("  set SAP_PASS=密码")
        print("  set SAP_HOST=SAP服务器IP")
        print("  set SAP_CLIENT=800")
        sys.exit(1)

    return cfg


# ── 公共：表格打印 ──────────────────────────────────
def print_table(columns, rows):
    if not rows:
        print("(无数据)")
        return

    widths = []
    for i, col in enumerate(columns):
        max_data = max((len(r[i]) for r in rows if i < len(r)), default=0)
        widths.append(max(len(col), max_data, 8))

    header = "  ".join(c.ljust(widths[i]) for i, c in enumerate(columns))
    print(header)
    print("-" * len(header))

    for row in rows:
        print("  ".join(v.ljust(widths[i]) for i, v in enumerate(row)))


# ── 公共：构造 SOAP XML ─────────────────────────────
SOAP_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <rfc:RFC_READ_TABLE xmlns:rfc="urn:sap-com:document:sap:rfc:functions">
      <DELIMITER>|</DELIMITER>
      {fields_xml}
      {options_xml}
      <QUERY_TABLE>{table}</QUERY_TABLE>
      <ROWCOUNT>{rowcount}</ROWCOUNT>
      <ROWSKIPS>0</ROWSKIPS>
      <NO_DATA/>
    </rfc:RFC_READ_TABLE>
  </soap:Body>
</soap:Envelope>"""


def build_soap(table_name, fields, where, max_rows):
    fields_xml = "\n".join(
        f"<FIELDS><item><FIELDNAME>{f}</FIELDNAME></item></FIELDS>"
        for f in (fields or [])
    )
    options_xml = (
        f"<OPTIONS><item><TEXT>{where}</TEXT></item></OPTIONS>"
        if where else ""
    )
    return SOAP_TEMPLATE.format(
        fields_xml=fields_xml, options_xml=options_xml,
        table=table_name, rowcount=max_rows,
    )


def parse_soap_response(xml_text):
    """解析 SOAP 响应，提取列名和数据"""
    root = ET.fromstring(xml_text)

    nsmap = {"soap": "http://schemas.xmlsoap.org/soap/envelope/"}
    fault = root.find(".//soap:Fault", nsmap)
    if fault is not None:
        sys.exit(f"SAP 错误:\n{ET.tostring(fault, encoding='unicode')[:500]}")

    columns = [item.findtext("FIELDNAME", "")
               for item in root.findall(".//FIELDS/item")]

    rows = []
    for item in root.findall(".//DATA/item"):
        wa = (item.findtext("WA", "") or "").rstrip("|")
        if wa:
            rows.append(wa.split("|"))

    return columns, rows


# ════════════════════════════════════════════════════════════
#  模式 1: pyrfc
# ════════════════════════════════════════════════════════════
def read_via_pyrfc(cfg, table_name, fields, where, max_rows):
    print(f"连接 {cfg['host']} sysnr={cfg['sysnr']} "
          f"client={cfg['client']} [pyrfc]")

    conn = Connection(
        ashost = cfg["host"],
        sysnr  = cfg["sysnr"],
        client = cfg["client"],
        user   = cfg["user"],
        passwd = cfg["passwd"],
        lang   = cfg["lang"],
    )
    print("已连接\n")

    fields_param = [{"FIELDNAME": f} for f in fields] if fields else []
    options_param = [{"TEXT": where}] if where else []

    result = conn.call("RFC_READ_TABLE",
        QUERY_TABLE = table_name,
        DELIMITER   = "|",
        FIELDS      = fields_param,
        OPTIONS     = options_param,
        ROWCOUNT    = max_rows,
        ROWSKIPS    = 0,
    )

    columns = [f["FIELDNAME"] for f in result["FIELDS"]]
    rows = []
    for line in result["DATA"]:
        wa = line["WA"].rstrip("|")
        if wa:
            rows.append(wa.split("|"))

    conn.close()
    return columns, rows


# ════════════════════════════════════════════════════════════
#  模式 2: HTTP via urllib (Python 标准库, 零依赖)
# ════════════════════════════════════════════════════════════
def read_via_urllib(cfg, table_name, fields, where, max_rows):
    host   = cfg["host"]
    port   = cfg["port"]
    client = cfg["client"]

    url = f"http://{host}:{port}/sap/bc/soap/rfc?sap-client={client}"
    body = build_soap(table_name, fields, where, max_rows)

    # HTTP Basic Auth header
    credentials = base64.b64encode(
        f"{cfg['user']}:{cfg['passwd']}".encode()
    ).decode()

    req = Request(
        url,
        data=body.encode("utf-8"),
        headers={
            "Content-Type": "text/xml; charset=utf-8",
            "Authorization": f"Basic {credentials}",
        },
    )

    print(f"连接 {host}:{port} client={client} [urllib]")

    try:
        resp = urlopen(req, timeout=30)
    except HTTPError as e:
        if e.code == 401:
            sys.exit("认证失败，检查用户名/密码")
        elif e.code == 404:
            sys.exit("SOAP 服务未找到，SAP GUI → SICF 检查 /sap/bc/soap/rfc")
        else:
            sys.exit(f"HTTP {e.code}: {e.read().decode()[:300]}")
    except URLError as e:
        sys.exit(f"无法连接 {host}:{port}: {e.reason}")

    xml_text = resp.read().decode("utf-8")
    return parse_soap_response(xml_text)


# ════════════════════════════════════════════════════════════
#  模式 3: HTTP via requests (更友好的错误提示)
# ════════════════════════════════════════════════════════════
def read_via_requests(cfg, table_name, fields, where, max_rows):
    from requests.auth import HTTPBasicAuth

    host   = cfg["host"]
    port   = cfg["port"]
    client = cfg["client"]

    url = f"http://{host}:{port}/sap/bc/soap/rfc?sap-client={client}"
    body = build_soap(table_name, fields, where, max_rows)

    print(f"连接 {host}:{port} client={client} [requests]")

    try:
        resp = requests.post(
            url,
            data=body.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            auth=HTTPBasicAuth(cfg["user"], cfg["passwd"]),
            timeout=30,
        )
    except requests.exceptions.ConnectionError:
        sys.exit(f"无法连接 {host}:{port}，请确认在公司内网")
    except requests.exceptions.Timeout:
        sys.exit("连接超时")

    if resp.status_code == 401:
        sys.exit("认证失败")
    elif resp.status_code == 404:
        sys.exit("SOAP 服务未找到")
    elif resp.status_code != 200:
        sys.exit(f"HTTP {resp.status_code}:\n{resp.text[:300]}")

    return parse_soap_response(resp.text)


# ════════════════════════════════════════════════════════════
#  入口
# ════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="SAP ECC 表读取工具")
    parser.add_argument("table", help="SAP 表名 (例如 T001, KNA1)")
    parser.add_argument("-n", "--max-rows", type=int, default=50,
                        help="最大行数 (默认 50)")
    parser.add_argument("-f", "--fields", nargs="*", default=None,
                        help="字段列表 (例如 -f BUKRS BUTXT)")
    parser.add_argument("-w", "--where", default="",
                        help="WHERE 条件 (ABAP SQL 语法)")
    parser.add_argument("--mode", choices=("pyrfc","http"), default=None,
                        help="强制指定模式 (pyrfc / http)")

    args = parser.parse_args()
    start = datetime.now()

    cfg = get_config()

    # ── 自动选择模式 ────────────────────────────
    if args.mode == "pyrfc":
        if not PYRFC_AVAILABLE:
            sys.exit("pyrfc 未安装，需要 SAP NW RFC SDK")
        read_fn = read_via_pyrfc
        mode_name = "pyrfc"
    elif args.mode == "http":
        read_fn = read_via_requests if REQUESTS_AVAILABLE else read_via_urllib
        mode_name = "http (requests)" if REQUESTS_AVAILABLE else "http (urllib)"
    elif PYRFC_AVAILABLE:
        read_fn = read_via_pyrfc
        mode_name = "pyrfc"
    elif REQUESTS_AVAILABLE:
        read_fn = read_via_requests
        mode_name = "http (requests)"
    else:
        read_fn = read_via_urllib
        mode_name = "http (urllib)"

    print(f"读取 {args.table} [模式: {mode_name}]")

    cols, rows = read_fn(cfg, args.table, args.fields, args.where, args.max_rows)

    print(f"返回 {len(rows)} 行, {len(cols)} 列\n")

    if cols:
        print_table(cols, rows)

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n耗时 {elapsed:.2f}s")


if __name__ == "__main__":
    main()
