# SAP ECC 表读取工具

传入表名，输出表内容。支持三种连接模式，自动降级。

## 模式

| 模式 | 依赖 | 说明 |
|------|------|------|
| pyrfc | SAP NW RFC SDK + pip install pyrfc | RFC 直连，最快 |
| requests | pip install requests | HTTP/SOAP |
| **urllib** | **无（Python 自带）** | **HTTP/SOAP，零依赖，开箱即用** |

## 前提条件

SAP ECC HTTP 端口已开启。SAP GUI 执行 **SMICM → Goto → Services** 确认：

```
HTTP    8000   Active
```

## 部署 (Windows)

```batch
:: 1. 安装 Python 3.x (勾选 Add to PATH)
:: 2. 拷贝项目 / git clone

git clone https://github.com/jaxi-cn/sap.git
cd sap\sap-rfc-test

:: 3. 配置
copy .env.example.bat .env.bat
notepad .env.bat        REM 改 SAP_HOST 为 SAP 服务器 IP

:: 4. 运行（零依赖，直接用）
.env.bat
python sap_reader.py T001
```

## 用法

```batch
python sap_reader.py T001                        读公司代码表
python sap_reader.py KNA1 -n 100                 读客户主数据 100 行
python sap_reader.py MARA -f MATNR MTART         只读指定字段
python sap_reader.py VBAK -w "ERDAT='20260530'"  带 WHERE 条件
```

## 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| SAP_HOST | SAP 服务器 IP | 10.10.10.100 |
| SAP_SYSNR | 系统编号 | 00 |
| SAP_CLIENT | 集团号 | 800 |
| SAP_PORT | HTTP 端口 | 8000 |
| SAP_USER | SAP 用户名 | s0027497711 |
| SAP_PASS | 密码 | S0027497711! |
