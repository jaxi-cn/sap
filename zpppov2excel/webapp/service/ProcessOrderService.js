sap.ui.define([], function () {
  "use strict";

  function ProcessOrderService(odataModel) {
    if (!odataModel) {
      throw new Error("ProcessOrderService requires an OData V2 model.");
    }
    this._model = odataModel;
  }

  function localDate(dateText) {
    var parts = dateText.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }

  function stringMessage(value) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function responseMessage(data) {
    var source = data && data.d ? data.d : data || {};
    return stringMessage(source.FunctionMessage) ||
      stringMessage(source.Message) ||
      stringMessage(source.message);
  }

  function parseErrorMessage(error) {
    var payload;
    var details;
    var messages = [];
    var responseText = error && (error.responseText || (error.response && error.response.responseText));

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
        if (payload.error) {
          if (typeof payload.error.message === "string") {
            messages.push(payload.error.message);
          } else if (payload.error.message && payload.error.message.value) {
            messages.push(payload.error.message.value);
          }
          details = payload.error.innererror && payload.error.innererror.errordetails;
          if (Array.isArray(details)) {
            details.forEach(function (detail) {
              var message = stringMessage(detail.message);
              if (message && messages.indexOf(message) === -1) {
                messages.push(message);
              }
            });
          }
        }
      } catch (ignore) {
        messages.push(String(responseText).slice(0, 500));
      }
    }

    return messages.join("；") ||
      stringMessage(error && error.message) ||
      "SAP 请求失败，未返回可读消息。";
  }

  function statusCode(error) {
    var value = error && (error.statusCode || error.status ||
      (error.response && (error.response.statusCode || error.response.status)));
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function classifiedError(error, operation, alwaysUnknown) {
    var code = statusCode(error);
    return {
      kind: alwaysUnknown || code === 0 ? "unknown" : "rejected",
      operation: operation,
      statusCode: code,
      message: parseErrorMessage(error),
      originalError: error
    };
  }

  function extractETag(data, response) {
    var source = data && data.d ? data.d : data;
    var headers = response && response.headers;
    var eTag = source && source.__metadata && source.__metadata.etag;

    if (!eTag && headers) {
      eTag = headers.ETag || headers.etag;
    }
    if (!eTag && response && typeof response.getResponseHeader === "function") {
      eTag = response.getResponseHeader("ETag") || response.getResponseHeader("etag");
    }
    return eTag || "";
  }

  ProcessOrderService.prototype.createOrder = function (row) {
    var model = this._model;
    var payload = {
      ProductionPlant: row.ProductionPlant,
      Material: row.Material,
      ManufacturingOrderType: row.ManufacturingOrderType,
      MfgOrderPlannedStartDate: localDate(row.MfgOrderPlannedStartDate),
      MfgOrderPlannedEndDate: localDate(row.MfgOrderPlannedEndDate),
      TotalQuantity: row.TotalQuantity,
      ProductionVersion: row.ProductionVersion
    };

    return new Promise(function (resolve, reject) {
      model.create("/A_ProcessOrder_2", payload, {
        success: function (data, response) {
          var source = data && data.d ? data.d : data;
          var order = source && stringMessage(source.ManufacturingOrder);
          if (!order || order.charAt(0) === "%") {
            reject({
              kind: "unknown",
              operation: "create",
              statusCode: response && response.statusCode,
              message: "创建请求返回成功，但响应中没有数据库正式流程订单号 ManufacturingOrder。"
            });
            return;
          }
          resolve({
            processOrder: order,
            message: responseMessage(data),
            rawData: data,
            response: response
          });
        },
        error: function (error) {
          reject(classifiedError(error, "create", false));
        }
      });
    });
  };

  ProcessOrderService.prototype.readLatestETag = function (processOrder) {
    var model = this._model;
    var keyPath;
    try {
      keyPath = model.createKey("A_ProcessOrder_2", { ManufacturingOrder: processOrder });
    } catch (error) {
      return Promise.reject({
        kind: "unknown",
        operation: "readETag",
        statusCode: 0,
        message: "无法按 metadata 构造流程订单实体键，请核对 A_ProcessOrder_2 的键字段。",
        originalError: error
      });
    }

    return new Promise(function (resolve, reject) {
      model.read("/" + keyPath.replace(/^\//, ""), {
        success: function (data, response) {
          var eTag = extractETag(data, response);
          if (!eTag) {
            reject({
              kind: "unknown",
              operation: "readETag",
              statusCode: response && response.statusCode,
              message: "已读取正式订单，但响应中没有最新 ETag，未执行下达。"
            });
            return;
          }
          resolve({ eTag: eTag, rawData: data, response: response });
        },
        error: function (error) {
          reject(classifiedError(error, "readETag", true));
        }
      });
    });
  };

  ProcessOrderService.prototype.releaseOrder = function (processOrder, eTag) {
    var model = this._model;
    return new Promise(function (resolve, reject) {
      model.callFunction("/ReleaseOrder", {
        method: "POST",
        urlParameters: {
          ManufacturingOrder: processOrder
        },
        eTag: eTag,
        success: function (data, response) {
          resolve({
            message: responseMessage(data),
            rawData: data,
            response: response
          });
        },
        error: function (error) {
          reject(classifiedError(error, "release", false));
        }
      });
    });
  };

  ProcessOrderService.localDate = localDate;
  ProcessOrderService.extractETag = extractETag;
  ProcessOrderService.parseErrorMessage = parseErrorMessage;

  return ProcessOrderService;
});
