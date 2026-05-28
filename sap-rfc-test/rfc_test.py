#!/usr/bin/env python3
"""
SAP ECC 连接测试 — 纯 HTTP/SOAP 方式调用 RFC_READ_TABLE
无需 SAP NW RFC SDK，只需 pip install requests
"""

import os
import sys
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from requests.auth import HTTPBasicAuth


CONFIG = {
    "host":   os.environ.get("SAP_HOST",   ""),
    "port":   os.environ.get("SAP_PORT",   "8000"),
    "user":   os.environ.get("SAP_USER",   ""),
    "passwd": os.environ.get("SAP_PASS",   ""),
    "client": os.environ.get("SAP_CLIENT", "800"),
    "lang":   os.environ.get("SAP_LANG",   "ZH"),
}

READ_TABLE  = os.environ.get("SAP_TABLE",   "T001")
READ_FIELDS = ["BUKRS", "BUTXT", "ORT01", "LAND1"]
MAX_ROWS    = int(os.environ.get("SAP_MAXROWS", "20"))

SOAP_ENVELOPE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <rfc:RFC_READ_TABLE xmlns:rfc="urn:sap-com:document:sap:rfc:functions">
      <DELIMITER>{delimiter}</DELIMITER>
      {fields_xml}
      {options_xml}
      <QUERY_TABLE>{table}</QUERY_TABLE>
      <ROWCOUNT>{rowcount}</ROWCOUNT>
      <ROWSKIPS>0</ROWSKIPS>
      <NO_DATA/>
    </rfc:RFC_READ_TABLE>
  </soap:Body>
</soap:Envelope>"""


def build_soap(table, fields, max_rows, where="", delimiter="|"):
    fields_xml = ""
    for f in fields:
        fields_xml += f"<FIELDS><item><FIELDNAME>{f}</FIELDNAME></item></FIELDS>\n"
    options_xml = f"<OPTIONS><item><TEXT>{where}</TEXT></item></OPTIONS>" if where else ""
    return SOAP_ENVELOPE.format(
        delimiter=delimiter, fields_xml=fields_xml,
        options_xml=options_xml, table=table, rowcount=max_rows)


def call_rfc(host, port, client, user, passwd, soap_body):
    url = f"http://{host}:{port}/sap/bc/soap/rfc?sap-client={client}"
    print(f"→ 连接 {host}:{port} client={client} user={user} ...")
    try:
        return requests.post(url, data=soap_body.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            auth=HTTPBasicAuth(user, passwd), timeout=30)
    except requests.exceptions.ConnectionError:
        print(f"❌ 无法连接 {host}:{port}")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("❌ 连接超时")
        sys.exit(1)


def parse_response(resp):
    print(f"HTTP {resp.status_code}")
    if resp.status_code == 401:
        print("❌ 认证失败"); sys.exit(1)
    elif resp.status_code == 404:
        print("❌ SOAP 未找到，SICF 检查 /sap/bc/soap/rfc"); sys.exit(1)
    elif resp.status_code != 200:
        print(f"❌ 失败:\n{resp.text[:500]}"); sys.exit(1)

    root = ET.fromstring(resp.text)
    nsmap = {"soap": "http://schemas.xmlsoap.org/soap/envelope/"}
    fault = root.find(".//soap:Fault", nsmap)
    if fault is not None:
        print(f"❌ SAP 错误:\n{ET.tostring(fault, encoding='unicode')[:500]}")
        sys.exit(1)

    columns = []
    for item in root.findall(".//FIELDS/item"):
        fn = item.findtext("FIELDNAME", "")
        if fn: columns.append(fn)

    rows = []
    for item in root.findall(".//DATA/item"):
        wa = item.findtext("WA", "").rstrip("|")
        if wa: rows.append(wa.split("|"))

    print(f"✅ 返回 {len(rows)} 行, {len(columns)} 列\n")
    return columns, rows


def display_table(columns, rows):
    if not rows: print("(无数据)"); return
    widths = []
    for i, c in enumerate(columns):
        dm = max((len(r[i]) for r in rows if i < len(r)), default=0)
        widths.append(max(len(c), dm, 8))
    header = "  ".join(c.ljust(widths[i]) for i, c in enumerate(columns))
    print(header); print("-" * len(header))
    for row in rows:
        print("  ".join(v.ljust(widths[i]) for i, v in enumerate(row)))


def main():
    missing = [k for k, v in CONFIG.items() if not v]
    if missing:
        print("❌ 缺少参数: set SAP_HOST=... SAP_USER=... etc"); sys.exit(1)
    start = datetime.now()
    soap = build_soap(READ_TABLE, READ_FIELDS, MAX_ROWS)
    resp = call_rfc(CONFIG["host"], CONFIG["port"], CONFIG["client"],
                    CONFIG["user"], CONFIG["passwd"], soap)
    cols, rows = parse_response(resp)
    if cols: display_table(cols, rows)
    print(f"\n⏱ 耗时 {(datetime.now()-start).total_seconds():.2f}s")


if __name__ == "__main__":
    main()
