# VS Code 开发、联调与部署操作手册

本手册供公司内部、能够访问目标 SAP 系统的 Windows 开发机使用。不要在无法访问公司网络的机器上尝试真实创建、下达或部署。

## 1. 准备软件

安装以下软件：

1. Node.js 18 LTS 或 20 LTS；安装时勾选加入 PATH。
2. Visual Studio Code。
3. Microsoft Edge。
4. 可选 VS Code 扩展：SAP Fiori tools - Extension Pack、XML、YAML、ESLint。

在 PowerShell 或 VS Code Terminal 检查：

```text
node --version
npm --version
```

如果公司使用内部 npm 镜像，先按公司给出的地址设置：

```text
npm config set registry https://<公司内部-npm-镜像>/
```

不得把公司代理密码写入项目文件。

## 2. 打开工程

1. 解压交付 ZIP。
2. 启动 VS Code。
3. 选择“文件 → 打开文件夹”。
4. 选择解压后的 `zpppov2excel` 文件夹，而不是它的上级目录。
5. 选择“终端 → 新建终端”。

终端提示符所在目录应包含 `package.json`、`ui5.yaml` 和 `webapp`。

## 3. 安装依赖

执行：

```text
npm install
```

安装完成后，`postinstall` 会把：

```text
node_modules/xlsx/dist/xlsx.full.min.js
```

复制为：

```text
webapp/thirdparty/xlsx.full.min.js
```

应用运行时从自身目录读取 SheetJS，不访问 CDN。若复制脚本提示找不到 SheetJS，检查企业 npm 镜像是否包含 `xlsx@0.18.5`。

## 4. 在 SAP 中检查服务

### 4.1 服务注册

在 SAP GUI 运行 `/IWFND/MAINT_SERVICE`，确认 `ZAPI_PROCESS_ORDER_2_SRV` 已注册。Embedded Gateway 通常使用 `LOCAL` 系统别名，但必须以 Basis 的实际配置为准。

### 4.2 读取 metadata

在 `/IWFND/GW_CLIENT` 执行：

```text
GET /sap/opu/odata/sap/ZAPI_PROCESS_ORDER_2_SRV/$metadata?sap-client=500
```

预期 HTTP 200。搜索并核对：

```text
EntitySet Name="A_ProcessOrder_2"
FunctionImport Name="ReleaseOrder"
Parameter Name="ManufacturingOrder"
ProductionPlant
Material
ManufacturingOrderType
MfgOrderPlannedStartDate
MfgOrderPlannedEndDate
TotalQuantity
ProductionVersion
```

特别检查 `A_ProcessOrder_2` 对应 EntityType 的 `<Key>`。本代码假设键属性是 `ManufacturingOrder`。如果 metadata 使用复合键或不同名称，修改 `webapp/service/ProcessOrderService.js` 中 `createKey` 的属性对象。

确认 `ReleaseOrder` 的 `m:HttpMethod` 是 `POST`，参数名、长度和返回类型与代码一致。不要把旧 RAP 服务中的 `Product` 字段复制到本项目；当前设计使用 `Material`。

## 5. 配置本地代理

打开 `ui5.yaml`，核对：

```text
baseUri: "https://vhrgped2ci.rise.tru-advance.com:44300/sap"
strictSSL: true
```

如果公司开发入口变化，只修改 `baseUri`。应用自身请求路径保持 `/sap/opu/odata/...`。

若公司系统使用内部 CA，优先把 CA 证书安装到开发机或配置 Node 信任链。仅在开发环境且得到公司安全要求允许时，才把 `strictSSL` 临时改为 `false`；生产构建和正式部署不应依赖关闭证书校验。

## 6. 启动应用

执行：

```text
npm start
```

UI5 CLI 会准备 SAPUI5 1.120.29 并打开 Edge。如果浏览器未自动打开，访问终端显示的地址，通常是：

```text
http://localhost:8080/index.html
```

首次访问 SAP 代理资源时按公司登录方式完成认证。若 metadata 返回 401/403，先检查账号权限与登录；若返回 404，检查服务注册和 URL；若代理连接失败，检查 VPN、DNS、证书和 `baseUri`。

## 7. 页面操作

1. 点击“下载模板”。
2. 在 Excel 中填写最多 20 行，不要修改七个表头。
3. 工厂、物料号、订单类型和生产版本保持文本格式，避免前导零丢失。
4. 日期填写为 `YYYY-MM-DD`。
5. 保存并关闭 Excel 文件。
6. 点击“上传”并选择文件。
7. 点击“校验”。只有所有行通过后“创建”才启用。
8. 点击“创建”，阅读风险提示并确认。
9. 保持页面打开，等待每行依次完成。
10. 记录正式订单号与消息；结果未知的行不要在未查明 SAP 状态前重新上传重做。

## 8. Edge 中查看请求

按 `F12` 打开开发者工具，选择 Network，建议勾选 Preserve log。正常单行应按顺序看到：

```text
POST .../A_ProcessOrder_2
GET  .../A_ProcessOrder_2('<正式订单号>')
POST .../ReleaseOrder?ManufacturingOrder='<正式订单号>'
```

Release 请求应带 `If-Match`。如果出现 412，表示 ETag 前置条件失败；页面应显示下达失败并继续下一行。网络断开、浏览器取消或没有 HTTP 状态时按结果未知处理且不重试。

## 9. 构建部署目录

确认本地联调配置无误后执行：

```text
npm run build
```

优化后的应用位于 `dist`。构建会重新复制 SheetJS，因此 `dist/thirdparty/xlsx.full.min.js` 应存在。

## 10. 部署到 BSP

部署前确认：

1. `ED2K902956` 尚未释放且允许当前用户写入。
2. Package `ZPP_PROCESS_ORDER_UPLOAD` 存在并符合传输层设置。
3. `/UI5/ABAP_REPOSITORY_SRV` 已激活；若未激活，请由 Basis 按 SAP Note 2999557 和公司规范处理。
4. BSP 名 `ZPP_PO_V2_EXCEL` 未被无关应用占用。

项目的 `.ui5deployrc` 已包含服务器、client、package、BSP 和 transport，但没有账号密码。按照公司凭据管理规定执行：

```text
npm run deploy -- --user <SAP_USER> --pwd <SAP_PASSWORD>
```

注意：命令行密码可能进入 shell 历史。若公司禁止这种方式，请不要执行该命令；改用公司批准的凭据注入方式、CI/CD Secret，或由有权限的开发人员使用 SAP GUI `/UI5/UI5_REPOSITORY_LOAD` 上传 `dist` 内容。

部署工具会覆盖目标 BSP 中同名资源。首次部署前应确认目标 BSP 和传输号准确。若 `ED2K902956` 已释放，停止部署，申请新的 Workbench Request，并同时修改 `.ui5deployrc` 与 `ui5-deploy.yaml` 的记录值。

## 11. 部署后检查

1. 在 SE80 或相应 BSP 管理工具中确认 `ZPP_PO_V2_EXCEL` 文件完整。
2. 如公司流程要求，执行或等待 `/UI5/APP_INDEX_CALCULATE`；CLI 配置已请求计算 Application Index。
3. 通过公司规定的 URL 或 Fiori Launchpad target mapping 启动应用。
4. 再次在 Network 中确认请求使用同源 `/sap/opu/odata/...`，没有指向本地 `localhost`。

## 12. 公司环境验收建议

先使用专用测试主数据和最小数量：

- 1 行成功创建并下达，页面订单号与 `COR3` 一致；
- 2–3 行确认严格串行；
- 无效物料确认创建失败后继续下一行；
- 可创建但不可下达的业务场景确认保留订单号；
- 人为制造 ETag 冲突确认 412 显示为下达失败；
- 断网只能在隔离测试条件下模拟，确认结果未知且无自动重试；
- 21 行、重复行、非法日期、零数量和 4 位以上生产版本必须在前端被拒绝；
- 批次结束后创建按钮禁用，重新上传成功后才允许新批次。

最终日期以 `COR3` 中 SAP 排程后的数据为准，不要求与 Excel 计划日期完全相同。

## 13. 常见问题

### 页面提示找不到 Excel 库

执行 `npm install` 或 `npm run prepare:xlsx`，确认 `webapp/thirdparty/xlsx.full.min.js` 存在。

### 所有 OData 请求都变成 `$batch`

检查 `manifest.json` 默认模型的 `useBatch` 必须为 `false`，且代码不得调用 `submitChanges` 组合请求。

### 创建成功却没有订单号

检查 Create 响应中正式键的属性名。当前代码只接受 `ManufacturingOrder`，不接受 `%...` 临时键。不要猜测订单号或自动重试。

### GET 订单返回 404

从 `$metadata` 核对实体键，再调整 `ProcessOrderService.readLatestETag` 中的 `createKey`。不要手工拼接未转义的 OData Key。

### Release 返回 400

从 `$metadata` 核对 Function Import 名、参数名、HTTP 方法与返回类型；同时查看 `/IWFND/ERROR_LOG` 和后端 `/IWBEP/ERROR_LOG`。

### Release 返回 403

检查业务授权、服务授权和 CSRF Token。OData V2 Model 会管理 CSRF Token，但账号仍必须具备创建与下达权限。
