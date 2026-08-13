# zpppov2excel

SAPUI5 freestyle 参考工程：从 Excel 读取最多 20 行数据，通过 `ZAPI_PROCESS_ORDER_2_SRV` 按行串行执行流程订单 Create → GET latest ETag → Release。

## 关键约束

- 应用 ID：`zpp.processorder.v2excel.zpppov2excel`
- OData V2：`useBatch=false`
- 创建实体集：`A_ProcessOrder_2`
- 下达 Function Import：`ReleaseOrder`
- 七个字段必须整批校验通过后才能创建
- 任意单行失败后继续下一行
- 无响应或网络中断等结果未知请求不自动重试
- 批次完成后锁定，必须重新上传新文件才能再次创建

## 在公司机器上开始

1. 安装 Node.js 18 或 20 LTS、VS Code 和 Microsoft Edge。
2. 在 VS Code 中打开本目录。
3. 根据公司环境修改 `ui5.yaml` 中的代理地址和证书设置。
4. 执行 `npm install`。此步骤会把 SheetJS 复制到应用自身的 `webapp/thirdparty` 目录。
5. 执行 `npm start`。
6. 在 Edge 打开的页面中登录 SAP，下载模板、填写、上传并校验。

完整步骤见 [docs/vscode-operation-guide.md](docs/vscode-operation-guide.md)。详细设计见 [docs/technical-design.md](docs/technical-design.md)。

## 构建与部署

```text
npm run build
npm run deploy -- --user <SAP_USER> --pwd <SAP_PASSWORD>
```

部署前必须确认 `ED2K902956` 仍可修改，并按公司密码管理制度执行。不要把用户和密码写入 `.ui5deployrc`、`ui5.yaml` 或 Git。

## 重要说明

本工程未连接目标 SAP 系统。首次联调前必须以目标系统 `$metadata` 为准核对实体键、字段类型、Function Import 参数和 ETag。若 metadata 与既定信息不同，应先按操作手册调整代码，不应直接创建真实订单。
