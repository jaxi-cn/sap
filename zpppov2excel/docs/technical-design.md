# 基于 OData V2 的 Excel 批量创建并下达流程订单——详细技术设计

## 一、技术对象

| 项目 | 设计值 |
|---|---|
| 工程 | `zpppov2excel` |
| Namespace | `zpp.processorder.v2excel` |
| 应用 ID | `zpp.processorder.v2excel.zpppov2excel` |
| BSP | `ZPP_PO_V2_EXCEL` |
| ABAP Package | `ZPP_PROCESS_ORDER_UPLOAD` |
| Transport | `ED2K902956` |
| OData | `ZAPI_PROCESS_ORDER_2_SRV`，V2 |
| Service Root | `/sap/opu/odata/sap/ZAPI_PROCESS_ORDER_2_SRV/` |
| Create Entity Set | `A_ProcessOrder_2` |
| Release Function Import | `ReleaseOrder` |
| Client | `500` |

## 二、目录与职责

```text
webapp/
├── controller/Main.controller.js       页面状态与用户事件
├── model/models.js                     JSONModel 与行结构工厂
├── service/ExcelService.js             模板、SheetJS 加载与 Excel 解析
├── service/ValidationService.js        全批格式校验
├── service/ProcessOrderService.js      OData V2 Promise 包装
├── service/BatchProcessor.js           严格串行调度与汇总
├── view/Main.view.xml                  四按钮与十二列表格
├── i18n/i18n.properties                中文文本
├── css/style.css                       表格显示微调
├── Component.js
├── manifest.json
└── index.html
```

服务边界刻意分离：Excel 模块不知道 OData；校验模块不知道 UI 控件；OData 模块不知道批次；批处理器只接受 service 接口；Controller 负责将这些模块接入 UI 生命周期。

## 三、Excel 数据契约

第一个工作表的第一行必须严格为：

| Excel 列 | OData 属性 | 规则 |
|---|---|---|
| 工厂 | `ProductionPlant` | 必填，最多 4 位 |
| 物料号 | `Material` | 必填，最多 40 位 |
| 订单类型 | `ManufacturingOrderType` | 必填，最多 4 位 |
| 开始日期 | `MfgOrderPlannedStartDate` | 有效 `YYYY-MM-DD` |
| 结束日期 | `MfgOrderPlannedEndDate` | 有效日期且不早于开始日期 |
| 数量 | `TotalQuantity` | 大于 0；整数最多 12 位；小数最多 3 位 |
| 生产版本 | `ProductionVersion` | 必填，最多 4 位 |

完全空白行忽略，其他非空行保存原 Excel 行号。第七列后出现非空数据会拒绝解析。模板预建 20 行文本单元格以降低前导零被 Excel 丢失的概率，但如果用户把单元格改为数值格式并保存，浏览器无法恢复已经丢失的前导零。

## 四、页面状态机

```text
EMPTY
  └─ 上传成功 → UPLOADED
UPLOADED
  ├─ 字段修改 → UPLOADED
  └─ 校验 → VALID 或 INVALID
INVALID
  └─ 字段修改/再次校验 → UPLOADED/VALID
VALID
  ├─ 字段修改 → UPLOADED
  └─ 创建确认 → PROCESSING
PROCESSING
  └─ 全部行结束或应用异常 → PROCESSED_LOCKED
PROCESSED_LOCKED
  └─ 新文件上传成功 → UPLOADED
```

`PROCESSING` 期间 `busy=true`、`inputLocked=true`，上传、校验和创建按钮禁用，并注册 `beforeunload`。最终块总会移除监听和 busy；`inputLocked` 保持为 true。

## 五、统一校验算法

1. 检查非空行数量 1–20。
2. 对七字段统一 trim。
3. 重置每行旧的校验、创建、下达、订单号和消息状态。
4. 检查必填、最大长度、严格日期、日期顺序和十进制精度。
5. 以七字段拼接为重复键，收集所有索引。
6. 任一重复键出现多次时，把该键对应的所有行和全部七个字段标为 Error。
7. 只有全局规则与所有行均成功时才设置 `validationPassed=true`。

## 六、OData 调用

### 创建

```text
POST A_ProcessOrder_2
```

Payload 仅有七字段。日期用 `new Date(year, month - 1, day)` 创建本地零点，数量保持字符串。成功响应必须提供 `ManufacturingOrder`；空值或 `%` 开头临时键视为结果无法确认。

### 最新 ETag

使用模型 metadata 构造实体路径：

```javascript
model.createKey("A_ProcessOrder_2", {
  ManufacturingOrder: processOrder
});
```

随后 GET 实体。ETag 从 `__metadata.etag` 或响应头读取；缺失时不调用 Release。

### 下达

```javascript
model.callFunction("/ReleaseOrder", {
  method: "POST",
  urlParameters: { ManufacturingOrder: processOrder },
  eTag: latestETag
});
```

返回消息兼容 `FunctionMessage`、`Message` 和 `message` 三个字符串属性。

## 七、串行与错误处理

批处理器使用普通 `for` 与 `await`，一行完整结束后才开始下一行，不存在 `Promise.all`。代码中没有重试循环。

| 场景 | 创建状态 | 下达状态 | 订单号 |
|---|---|---|---|
| 创建与下达成功 | 成功 | 成功 | 保留 |
| SAP 明确拒绝创建 | 失败 | 未执行 | 空 |
| 创建请求无 HTTP 结果 | 结果未知 | 未执行 | 不推测 |
| 创建成功、ETag 无法确认 | 成功 | 结果未知 | 保留 |
| 创建成功、SAP 明确拒绝下达 | 成功 | 失败 | 保留 |
| 下达请求无 HTTP 结果 | 成功 | 结果未知 | 保留 |

汇总优先把任何 Unknown 行计入“结果未知”，避免与其他分类重复计数。

## 八、联调前强制检查

必须在目标系统 `$metadata` 中核对：

- `A_ProcessOrder_2` 的真实键属性是否为 `ManufacturingOrder`；
- 七个创建字段的名称、可空性、类型、精度和标度；
- `ReleaseOrder` 是否为 POST Function Import；
- 参数是否为 `ManufacturingOrder` 且长度为 12；
- 下达是否要求 ETag、返回消息属性是什么；
- 服务是否已在 `/IWFND/MAINT_SERVICE` 注册并可用于 client 500。

SAP 返回的最终排程日期可能不同于 Excel 计划日期，应以 `COR3` 保存结果为准。
