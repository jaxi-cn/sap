# SAP ECC RFC 测试 — Python 读表

pyrfc + SAP NW RFC SDK 方案，支持 Windows / Mac / Linux。

## 架构

```
rfc_test.py                   ← Python 脚本
    │
    ▼
pyrfc (Python 包)             ← RFC 的 Python 封装
    │
    ▼
SAP NW RFC SDK 7.50           ← SAP 专有 C 库 (需从 me.sap.com 下载)
    │
    ▼
SAP ECC                       ← 调用 RFC_READ_TABLE
```

## 安装

### 1. 下载 SAP NW RFC SDK 7.50

从 SAP Software Center 下载: https://me.sap.com/softwarecenter
搜索 **SAP NW RFC SDK 7.50**

### 2. 安装 SDK

**Windows**: 解压到 `C:\nwrfcsdk`，将 `lib` 目录加入 PATH

**Mac**:
```bash
sudo mkdir -p /usr/local/sap/nwrfcsdk
sudo unzip nwrfcsdk_*.zip -d /usr/local/sap/nwrfcsdk
```

**Linux**:
```bash
sudo mkdir -p /usr/local/sap/nwrfcsdk
sudo unzip nwrfcsdk_*.zip -d /usr/local/sap/nwrfcsdk
sudo ldconfig /usr/local/sap/nwrfcsdk/lib
```

### 3. 安装 pyrfc

```bash
pip install pyrfc
```

Python 3.12+ 需从源码编译:
```bash
export SAPNWRFC_HOME=/usr/local/sap/nwrfcsdk
pip install pyrfc --no-binary :all:
```

## 部署

### Windows（公司内网）

```batch
git clone https://github.com/jaxi-cn/sap.git
cd sap\sap-rfc-test
copy .env.example.bat .env.bat
notepad .env.bat          REM 填写 SAP_HOST
.env.bat
run.bat
```

### Mac / Linux

```bash
git clone https://github.com/jaxi-cn/sap.git
cd sap/sap-rfc-test
cp .env.example .env
# 编辑 .env 填写 SAP_HOST
source .env && bash run.sh
```

## 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| SAP_HOST | SAP 服务器 IP | 10.10.10.100 |
| SAP_SYSNR | 系统编号 | 00 |
| SAP_CLIENT | 集团号 | 800 |
| SAP_USER | SAP 用户名 | s0027497711 |
| SAP_PASS | 密码 | S0027497711! |

## 运行

```batch
REM 读公司代码表 (T001)
run.bat

REM 读客户主数据 50 行
run.bat KNA1 50
```

```bash
bash run.sh           # 默认 T001
bash run.sh KNA1 50   # 客户主数据 50 行
```

## 常用测试表

| 表名 | 说明 |
|------|------|
| T001 | 公司代码 |
| KNA1 | 客户主数据 |
| LFA1 | 供应商主数据 |
| MARA | 物料主数据 |
| VBAK | 销售订单头 |
| BKPF | 会计凭证头 |
