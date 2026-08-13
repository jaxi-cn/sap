sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "zpp/processorder/v2excel/zpppov2excel/service/ExcelService",
  "zpp/processorder/v2excel/zpppov2excel/service/ValidationService",
  "zpp/processorder/v2excel/zpppov2excel/service/ProcessOrderService",
  "zpp/processorder/v2excel/zpppov2excel/service/BatchProcessor",
  "zpp/processorder/v2excel/zpppov2excel/model/models"
], function (
  Controller,
  MessageBox,
  MessageToast,
  ExcelService,
  ValidationService,
  ProcessOrderService,
  BatchProcessor,
  models
) {
  "use strict";

  var STATUS_TEXTS = {
    None: "未执行",
    Processing: "处理中",
    Success: "成功",
    Error: "失败",
    Unknown: "结果未知"
  };

  var VALIDATION_TEXTS = {
    None: "未校验",
    Success: "校验通过",
    Error: "校验失败"
  };

  return Controller.extend("zpp.processorder.v2excel.zpppov2excel.controller.Main", {
    onInit: function () {
      this._viewModel = this.getOwnerComponent().getModel("view");
      this._processOrderService = new ProcessOrderService(this.getOwnerComponent().getModel());
      this._beforeUnloadHandler = this._onBeforeUnload.bind(this);
      this._updateButtons();
    },

    onExit: function () {
      this._removeBeforeUnloadProtection();
    },

    onDownloadTemplate: async function () {
      try {
        await ExcelService.downloadTemplate();
        MessageToast.show("Excel 模板已生成。" );
      } catch (error) {
        MessageBox.error(error.message || "模板生成失败。" );
      }
    },

    onUploadPress: function () {
      var input;
      var that = this;
      if (this._viewModel.getProperty("/busy")) {
        return;
      }

      input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.addEventListener("change", async function () {
        var file = input.files && input.files[0];
        if (!file) {
          return;
        }
        await that._loadFile(file);
      }, { once: true });
      input.click();
    },

    _loadFile: async function (file) {
      var rows;
      this.getView().setBusy(true);
      try {
        rows = await ExcelService.parseFile(file);
        this._viewModel.setProperty("/rows", rows);
        this._viewModel.setProperty("/inputLocked", false);
        this._viewModel.setProperty("/batchProcessed", false);
        this._viewModel.setProperty("/validationPassed", false);
        this._viewModel.setProperty("/currentIndex", 0);
        this._viewModel.setProperty("/totalCount", rows.length);
        this._viewModel.setProperty("/progressText", "");
        this._viewModel.setProperty("/summaryText", "");
        MessageToast.show("已读取 " + rows.length + " 行非空数据，请点击“校验”。" );
      } catch (error) {
        MessageBox.error(error.message || "Excel 读取失败。当前页面数据未被替换。" );
      } finally {
        this.getView().setBusy(false);
        this._updateButtons();
      }
    },

    onFieldChange: function () {
      var rows;
      if (this._viewModel.getProperty("/inputLocked")) {
        return;
      }
      rows = this._viewModel.getProperty("/rows") || [];
      rows.forEach(function (row) {
        row.ValidationStatus = "None";
        row.CreateStatus = "None";
        row.ReleaseStatus = "None";
        row.ProcessOrder = "";
        row.MessageText = "";
        row.FieldStates = models.createFieldStates();
      });
      this._viewModel.setProperty("/validationPassed", false);
      this._viewModel.setProperty("/summaryText", "");
      this._viewModel.refresh(true);
      this._updateButtons();
    },

    onValidate: function () {
      var rows = this._viewModel.getProperty("/rows") || [];
      var result = ValidationService.validateRows(rows);
      var failedRows;

      this._viewModel.setProperty("/rows", result.rows);
      this._viewModel.setProperty("/validationPassed", result.valid);
      this._viewModel.setProperty("/summaryText", "");
      this._viewModel.refresh(true);
      this._updateButtons();

      if (result.valid) {
        MessageToast.show("全部 " + rows.length + " 行格式校验通过，可以创建。" );
        return;
      }
      failedRows = rows.filter(function (row) {
        return row.ValidationStatus === "Error";
      }).length;
      MessageBox.error(
        (result.globalMessages.length ? result.globalMessages.join("\n") + "\n" : "") +
        "存在 " + failedRows + " 行字段错误，请查看红色字段和消息列。"
      );
    },

    onCreate: function () {
      var that = this;
      if (!this._viewModel.getProperty("/validationPassed") ||
          this._viewModel.getProperty("/busy") ||
          this._viewModel.getProperty("/batchProcessed")) {
        return;
      }

      MessageBox.confirm(
        "将按行串行创建并立即下达流程订单。结果未知的请求不会自动重试。是否继续？",
        {
          title: "确认创建",
          emphasizedAction: MessageBox.Action.OK,
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: function (action) {
            if (action === MessageBox.Action.OK) {
              that._runBatch();
            }
          }
        }
      );
    },

    _runBatch: async function () {
      var rows = this._viewModel.getProperty("/rows") || [];
      var that = this;
      var summary;

      this._viewModel.setProperty("/busy", true);
      this._viewModel.setProperty("/inputLocked", true);
      this._viewModel.setProperty("/validationPassed", false);
      this._viewModel.setProperty("/batchProcessed", false);
      this._viewModel.setProperty("/summaryText", "");
      this._updateButtons();
      this._addBeforeUnloadProtection();

      try {
        summary = await BatchProcessor.process(rows, this._processOrderService, {
          onProgress: function (current, total) {
            that._viewModel.setProperty("/currentIndex", current);
            that._viewModel.setProperty("/totalCount", total);
            that._viewModel.setProperty("/progressText", "正在处理：" + current + "/" + total);
          },
          onRowChange: function () {
            that._viewModel.refresh(true);
          }
        });
        this._viewModel.setProperty("/summaryText", this._summaryText(summary));
        MessageBox.information(this._summaryText(summary) + "\n当前批次已锁定；如需处理新批次，请重新上传文件。" );
      } catch (error) {
        this._viewModel.setProperty("/summaryText", "批处理发生未预期的应用异常：" + (error.message || String(error)));
        MessageBox.error(this._viewModel.getProperty("/summaryText"));
      } finally {
        this._viewModel.setProperty("/busy", false);
        this._viewModel.setProperty("/inputLocked", true);
        this._viewModel.setProperty("/batchProcessed", true);
        this._viewModel.setProperty("/progressText", "");
        this._removeBeforeUnloadProtection();
        this._viewModel.refresh(true);
        this._updateButtons();
      }
    },

    _summaryText: function (summary) {
      return "总计 " + summary.total + " 行：成功 " + summary.success +
        " 行，下达失败 " + summary.releaseFailed +
        " 行，创建失败 " + summary.createFailed +
        " 行，结果未知 " + summary.unknown + " 行。";
    },

    _updateButtons: function () {
      var busy = Boolean(this._viewModel.getProperty("/busy"));
      var processed = Boolean(this._viewModel.getProperty("/batchProcessed"));
      var validated = Boolean(this._viewModel.getProperty("/validationPassed"));
      var rows = this._viewModel.getProperty("/rows") || [];
      this._viewModel.setProperty("/canUpload", !busy);
      this._viewModel.setProperty("/canValidate", rows.length > 0 && !busy && !processed);
      this._viewModel.setProperty("/canCreate", rows.length > 0 && validated && !busy && !processed);
    },

    _addBeforeUnloadProtection: function () {
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    },

    _removeBeforeUnloadProtection: function () {
      window.removeEventListener("beforeunload", this._beforeUnloadHandler);
    },

    _onBeforeUnload: function (event) {
      event.preventDefault();
      event.returnValue = "流程订单仍在处理中，关闭页面可能导致结果无法确认。";
      return event.returnValue;
    },

    formatValidationText: function (status) {
      return VALIDATION_TEXTS[status] || status || "";
    },

    formatStatusText: function (status) {
      return STATUS_TEXTS[status] || status || "";
    },

    formatStatusState: function (status) {
      return {
        Success: "Success",
        Error: "Error",
        Unknown: "Warning",
        Processing: "Information",
        None: "None"
      }[status] || "None";
    }
  });
});
