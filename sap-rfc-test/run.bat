@echo off
REM SAP ECC 表读取 — 快速启动 (Windows)
REM 用法: run.bat [表名] [-n 行数] [-f 字段...]

if "%SAP_HOST%"=="" (
    echo 请先配置连接参数:
    echo   copy .env.example.bat .env.bat
    echo   编辑 .env.bat 填入 SAP_HOST
    echo   .env.bat
    exit /b 1
)

python sap_reader.py %*
