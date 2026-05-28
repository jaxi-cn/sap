#!/bin/bash
# ── SAP RFC 测试 — 一键安装 ──
# 用法: bash setup.sh
set -e

SDK_VERSION="7.50"
SDK_INSTALL_PATH="/usr/local/sap/nwrfcsdk"

echo "============================================"
echo "  SAP RFC 测试 — 环境安装"
echo "============================================"
echo ""

# ── 1. 检查 SAP NW RFC SDK ──────────────────
echo "→ [1/3] 检查 SAP NW RFC SDK ..."

if [ -f "$SDK_INSTALL_PATH/lib/libsapnwrfc.dylib" ] || \
   [ -f "$SDK_INSTALL_PATH/lib/libsapnwrfc.so" ] || \
   [ -f "$SDK_INSTALL_PATH/lib/sapnwrfc.dll" ]; then
    echo "  ✅ SDK 已安装在 $SDK_INSTALL_PATH"
else
    echo "  ❌ SDK 未找到"
    echo ""
    echo "  请手动下载 SAP NW RFC SDK $SDK_VERSION："
    echo "  https://me.sap.com/softwarecenter"
    echo "  搜索 'NW RFC SDK $SDK_VERSION'"
    echo ""
    echo "  下载后解压到: $SDK_INSTALL_PATH"
    echo "  sudo mkdir -p $SDK_INSTALL_PATH"
    echo "  sudo unzip nwrfcsdk_*.zip -d $SDK_INSTALL_PATH"
    echo "  sudo ln -sf $SDK_INSTALL_PATH/lib/libsapnwrfc.* /usr/local/lib/"
    echo ""
    echo "  完成后重新运行此脚本。"
    exit 1
fi

# ── 2. Python 虚拟环境 ──────────────────────
echo "→ [2/3] 创建 Python 虚拟环境 ..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip -q

# ── 3. 安装 pyrfc ───────────────────────────
echo "→ [3/3] 安装 pyrfc ..."

export SAPNWRFC_HOME="${SAPNWRFC_HOME:-$SDK_INSTALL_PATH}"

# 尝试先装预编译 wheel，失败则从源码编译
if python -c "import pyrfc" 2>/dev/null; then
    echo "  ✅ pyrfc 已安装"
else
    echo "  编译安装中（可能需要 1-2 分钟）..."
    pip install pyrfc --no-binary :all: 2>&1 | tail -3
    python -c "import pyrfc; print(f'  ✅ pyrfc {pyrfc.__version__} 安装成功')"
fi

echo ""
echo "============================================"
echo "  安装完成！"
echo "============================================"
echo ""
echo "  下一步："
echo "  1. 复制 .env.example 为 .env"
echo "  2. 编辑 .env 填写 SAP 连接参数"
echo "  3. source .env && bash run.sh"
echo ""
