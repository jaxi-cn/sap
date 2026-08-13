sap.ui.define([
  "sap/ui/thirdparty/jquery",
  "zpp/processorder/v2excel/zpppov2excel/model/models"
], function (jQuery, models) {
  "use strict";

  var EXPECTED_HEADERS = ["工厂", "物料号", "订单类型", "开始日期", "结束日期", "数量", "生产版本"];
  var loadingPromise;

  function ensureXlsx() {
    var scriptUrl;
    if (window.XLSX) {
      return Promise.resolve(window.XLSX);
    }
    if (loadingPromise) {
      return loadingPromise;
    }

    scriptUrl = sap.ui.require.toUrl("zpp/processorder/v2excel/zpppov2excel/thirdparty/xlsx.full.min.js");
    loadingPromise = new Promise(function (resolve, reject) {
      jQuery.ajax({
        url: scriptUrl,
        dataType: "script",
        cache: true
      }).done(function () {
        if (window.XLSX) {
          resolve(window.XLSX);
        } else {
          reject(new Error("SheetJS 已加载，但未找到 XLSX 全局对象。"));
        }
      }).fail(function () {
        loadingPromise = null;
        reject(new Error("无法加载本地 Excel 解析库，请先执行 npm install。"));
      });
    });
    return loadingPromise;
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function normalizeDate(value, XLSX) {
    var parsed;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getUTCFullYear() + "-" + pad(value.getUTCMonth() + 1) + "-" + pad(value.getUTCDate());
    }
    if (typeof value === "number") {
      parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return parsed.y + "-" + pad(parsed.m) + "-" + pad(parsed.d);
      }
    }
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalizeText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function isBlankRow(values) {
    return values.every(function (value) {
      return normalizeText(value) === "";
    });
  }

  function validateHeaders(headerRow) {
    var actual = (headerRow || []).map(normalizeText);
    var mismatch = EXPECTED_HEADERS.some(function (header, index) {
      return actual[index] !== header;
    });
    var extra = actual.slice(EXPECTED_HEADERS.length).some(function (header) {
      return header !== "";
    });
    if (mismatch || extra) {
      throw new Error("Excel 表头必须严格为：" + EXPECTED_HEADERS.join("、") + "。");
    }
  }

  async function parseFile(file) {
    var XLSX = await ensureXlsx();
    var buffer;
    var workbook;
    var sheet;
    var matrix;
    var rows = [];

    if (!file) {
      throw new Error("未选择 Excel 文件。" );
    }
    if (!/\.xlsx?$/i.test(file.name || "")) {
      throw new Error("只支持 .xlsx 或 .xls 文件。" );
    }

    buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    if (!workbook.SheetNames.length) {
      throw new Error("Excel 文件中没有工作表。" );
    }
    sheet = workbook.Sheets[workbook.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    if (!matrix.length) {
      throw new Error("Excel 文件为空。" );
    }
    validateHeaders(matrix[0]);

    matrix.slice(1).forEach(function (sourceRow, index) {
      var businessValues = sourceRow.slice(0, 7);
      var extraValues = sourceRow.slice(7);
      if (isBlankRow(businessValues.concat(extraValues))) {
        return;
      }
      if (!isBlankRow(extraValues)) {
        throw new Error("Excel 第 " + (index + 2) + " 行在第 7 个业务字段之后仍有数据。" );
      }
      rows.push(models.createRow({
        SourceRow: index + 2,
        ProductionPlant: normalizeText(businessValues[0]),
        Material: normalizeText(businessValues[1]),
        ManufacturingOrderType: normalizeText(businessValues[2]),
        MfgOrderPlannedStartDate: normalizeDate(businessValues[3], XLSX),
        MfgOrderPlannedEndDate: normalizeDate(businessValues[4], XLSX),
        TotalQuantity: normalizeText(businessValues[5]),
        ProductionVersion: normalizeText(businessValues[6])
      }));
    });

    if (!rows.length) {
      throw new Error("Excel 中至少需要一行非空数据。" );
    }
    return rows;
  }

  async function downloadTemplate() {
    var XLSX = await ensureXlsx();
    var data = [EXPECTED_HEADERS];
    var workbook;
    var sheet;
    var output;
    var blob;
    var url;
    var anchor;
    var row;
    var column;

    for (row = 0; row < 20; row += 1) {
      data.push(["", "", "", "", "", "", ""]);
    }
    sheet = XLSX.utils.aoa_to_sheet(data);
    for (row = 2; row <= 21; row += 1) {
      for (column = 0; column < 7; column += 1) {
        sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })] = { t: "s", v: "", z: "@" };
      }
    }
    sheet["!cols"] = [
      { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 12 }
    ];
    sheet["!autofilter"] = { ref: "A1:G21" };
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "流程订单");
    output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "流程订单批量创建模板.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return {
    parseFile: parseFile,
    downloadTemplate: downloadTemplate,
    ensureXlsx: ensureXlsx
  };
});
