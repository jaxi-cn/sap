sap.ui.define([
  "zpp/processorder/v2excel/zpppov2excel/model/models"
], function (models) {
  "use strict";

  var LABELS = {
    ProductionPlant: "工厂",
    Material: "物料号",
    ManufacturingOrderType: "订单类型",
    MfgOrderPlannedStartDate: "开始日期",
    MfgOrderPlannedEndDate: "结束日期",
    TotalQuantity: "数量",
    ProductionVersion: "生产版本"
  };

  var MAX_LENGTHS = {
    ProductionPlant: 4,
    Material: 40,
    ManufacturingOrderType: 4,
    ProductionVersion: 4
  };

  function trimValue(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function isStrictDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var date;
    if (!match) {
      return false;
    }
    date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]);
  }

  function isValidQuantity(value) {
    if (!/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) {
      return false;
    }
    return value.replace(/[0.]/g, "").length > 0;
  }

  function addFieldError(row, field, message, rowMessages) {
    row.FieldStates[field] = { state: "Error", text: message };
    if (rowMessages.indexOf(message) === -1) {
      rowMessages.push(message);
    }
  }

  function resetRow(row) {
    models.BUSINESS_FIELDS.forEach(function (field) {
      row[field] = trimValue(row[field]);
    });
    row.FieldStates = models.createFieldStates();
    row.ValidationStatus = "None";
    row.CreateStatus = "None";
    row.ReleaseStatus = "None";
    row.ProcessOrder = "";
    row.MessageText = "";
  }

  function duplicateKey(row) {
    return models.BUSINESS_FIELDS.map(function (field) {
      return trimValue(row[field]);
    }).join("\u001f");
  }

  function validateRows(rows) {
    var globalMessages = [];
    var duplicateIndexes = {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return { valid: false, rows: rows || [], globalMessages: ["至少需要一行非空数据。"] };
    }
    if (rows.length > 20) {
      globalMessages.push("一次最多处理 20 行非空数据，当前为 " + rows.length + " 行。");
    }

    rows.forEach(function (row, index) {
      var key;
      resetRow(row);
      key = duplicateKey(row);
      duplicateIndexes[key] = duplicateIndexes[key] || [];
      duplicateIndexes[key].push(index);
    });

    rows.forEach(function (row) {
      var messages = [];

      models.BUSINESS_FIELDS.forEach(function (field) {
        if (!row[field]) {
          addFieldError(row, field, LABELS[field] + "不能为空。", messages);
        }
      });

      Object.keys(MAX_LENGTHS).forEach(function (field) {
        if (row[field] && row[field].length > MAX_LENGTHS[field]) {
          addFieldError(row, field, LABELS[field] + "不能超过 " + MAX_LENGTHS[field] + " 位。", messages);
        }
      });

      ["MfgOrderPlannedStartDate", "MfgOrderPlannedEndDate"].forEach(function (field) {
        if (row[field] && !isStrictDate(row[field])) {
          addFieldError(row, field, LABELS[field] + "必须是有效的 YYYY-MM-DD 日期。", messages);
        }
      });

      if (isStrictDate(row.MfgOrderPlannedStartDate) &&
          isStrictDate(row.MfgOrderPlannedEndDate) &&
          row.MfgOrderPlannedEndDate < row.MfgOrderPlannedStartDate) {
        addFieldError(row, "MfgOrderPlannedEndDate", "结束日期不得早于开始日期。", messages);
      }

      if (row.TotalQuantity && !isValidQuantity(row.TotalQuantity)) {
        addFieldError(row, "TotalQuantity", "数量必须大于 0，整数最多 12 位，小数最多 3 位。", messages);
      }

      row.MessageText = messages.join("；");
      row.ValidationStatus = messages.length ? "Error" : "Success";
    });

    Object.keys(duplicateIndexes).forEach(function (key) {
      var indexes = duplicateIndexes[key];
      if (indexes.length > 1) {
        indexes.forEach(function (index) {
          var row = rows[index];
          var message = "七个业务字段与其他行完全重复。";
          models.BUSINESS_FIELDS.forEach(function (field) {
            row.FieldStates[field] = { state: "Error", text: message };
          });
          row.ValidationStatus = "Error";
          row.MessageText = row.MessageText ? row.MessageText + "；" + message : message;
        });
      }
    });

    return {
      valid: globalMessages.length === 0 && rows.every(function (row) {
        return row.ValidationStatus === "Success";
      }),
      rows: rows,
      globalMessages: globalMessages
    };
  }

  return {
    validateRows: validateRows,
    isStrictDate: isStrictDate,
    isValidQuantity: isValidQuantity
  };
});
