# 流程订单 Excel 批量创建与下达——技术设计

## 1. 目标与范围

新建独立 SAPUI5 freestyle 应用 `zpppov2excel`。应用在浏览器中解析 Excel，每个非空数据行创建一张流程订单；创建成功取得正式订单号，再读取该订单最新 ETag 并立即调用 OData V2 Function Import `ReleaseOrder`。

本工程只负责前端。它不修改旧 RAP/OData V4 应用，不调用 `I_ProcessOrderTP`，不维护组件、工序、阶段、BOM 或主配方明细，不建立自定义日志表，也不在结果未知时自动重试。

## 2. 固定技术参数

| 参数 | 值 |
|---|---|
| 工程目录 | `zpppov2excel` |
| 业务 namespace | `zpp.processorder.v2excel` |
| 应用 ID / Component namespace | `zpp.processorder.v2excel.zpppov2excel` |
| BSP Application | `ZPP_PO_V2_EXCEL` |
| ABAP Package | `ZPP_PROCESS_ORDER_UPLOAD` |
| Transport Request | `ED2K902956` |
| OData 服务 | `ZAPI_PROCESS_ORDER_2_SRV` |
| 服务根路径 | `/sap/opu/odata/sap/ZAPI_PROCESS_ORDER_2_SRV/` |
| 创建实体集 | `A_ProcessOrder_2` |
| 下达 Function Import | `ReleaseOrder` |
| SAP Client | `500` |
| SAPUI5 基线 | `1.120.29` |
| OData 模式 | V2，`useBatch=false` |

## 3. 组件边界

- `ExcelService`：按需加载项目内 SheetJS 文件、下载无示例数据的模板、解析第一个工作表、规范化单元格。
- `ValidationService`：一次校验整批数据，写入行状态、字段 ValueState 和错误消息。
- `ProcessOrderService`：包装 `create`、`read`、`callFunction`，构造 Payload，提取正式订单号、ETag 和 SAP 消息，并对错误分类。
- `BatchProcessor`：只负责严格串行的 Create → GET ETag → Release 调度；单行失败后继续，不重试。
- `Main.controller`：文件选择、页面状态、按钮状态、表格编辑、批次锁、进度、汇总与关闭页面提醒。
- `Main.view.xml`：四个业务按钮、提示区、进度区和十二列表格。

## 4. 页面模型与状态机

页面 JSONModel 保存 `rows`、`busy`、`inputLocked`、`batchProcessed`、`validationPassed`、`progressText` 和 `summaryText`。每行保存七个业务字段、`SourceRow`、`ProcessOrder`、三类状态、消息及七个字段的 ValueState。

按钮状态：初始只允许下载和上传；上传有效数据后允许校验；全批校验通过后允许创建；任意字段修改立即使校验失效；处理期间禁用上传、校验和创建；处理结束后允许上传新批次，但当前批次不可编辑、不可重复执行。只有新文件成功解析并原子替换旧数据后才解除批次锁。

## 5. Excel 设计

模板首行严格使用：工厂、物料号、订单类型、开始日期、结束日期、数量、生产版本。`A2:G21` 预创建空白单元格；工厂、物料号、订单类型和生产版本列使用文本格式 `@`。模板不含真实示例数据。

上传只读取第一个工作表。完全空白行被忽略；非空行保留原始 Excel 行号。文本统一转字符串并 trim。日期兼容 Excel Date、日期序号和字符串，最终规范化为 `YYYY-MM-DD`。解析或表头错误不会覆盖页面现有批次。

## 6. 统一校验

一次校验全部非空行：行数 1–20；七字段必填；工厂、订单类型、生产版本不超过 4 位，物料不超过 40 位；日期必须是严格存在的 `YYYY-MM-DD`；结束日期不得早于开始日期；数量大于零、最多 3 位小数、整数部分最多 12 位。重复键由七个 trim 后字段拼接，所有重复行都标错。

校验不请求 SAP 主数据，因此只代表格式合格。

## 7. OData 数据流

创建只发送七个字段，不发送 `BasicSchedulingType`。两个日期通过年月日分量创建本地零点 `Date`，不使用 `new Date("YYYY-MM-DD")`。数量作为十进制字符串发送。

创建响应必须包含非空 `ManufacturingOrder`，并将其作为正式订单号展示。随后读取 `/A_ProcessOrder_2('<escaped order>')`；ETag 优先读取实体 `__metadata.etag`，再读取响应头 `ETag`/`etag`。最后调用 `/ReleaseOrder`，方法 `POST`，参数 `ManufacturingOrder`，并通过 `eTag` 传最新 ETag。

正式联调前必须在目标系统 `$metadata` 核对实体键形式、七字段类型、Function Import 参数名、返回类型和 ETag 支持情况。

## 8. 错误与不确定结果

有 HTTP 状态和 SAP 错误响应的创建/下达失败属于明确失败。无 HTTP 响应、超时、断网或无法判断服务器是否完成修改时属于“结果未知”，绝不自动重试。创建成功后发生 ETag 读取失败或下达结果未知时必须保留正式订单号。每一行无论结果如何都不会阻止下一行。

## 9. Excel 库交付方式

`xlsx` 由 npm 安装。`postinstall` 和启动/构建前脚本把 `node_modules/xlsx/dist/xlsx.full.min.js` 复制到 `webapp/thirdparty/`。运行时 `ExcelService` 从应用自身路径加载脚本，不依赖公网 CDN。ZIP 源码包不包含 `node_modules`，公司内网机器必须能访问企业 npm 镜像或预先准备依赖。

## 10. 非本机验证边界

本机不连接公司 SAP、不创建或下达真实订单、不执行 BSP 部署和传输。工程提供 VS Code、`$metadata`、本地启动、联调、构建、部署和业务验收步骤，最终由开发人员在公司环境执行。
