sap.ui.define([], function () {
  "use strict";

  function errorMessage(error) {
    return error && error.message ? error.message : "请求失败，未返回可读消息。";
  }

  function appendMessage(row, message) {
    if (!message) {
      return;
    }
    row.MessageText = row.MessageText ? row.MessageText + "；" + message : message;
  }

  function notify(hooks, row, index, phase) {
    if (hooks && typeof hooks.onRowChange === "function") {
      hooks.onRowChange(row, index, phase);
    }
  }

  async function processRow(row, index, service, hooks) {
    var created;
    var eTagResult;
    var released;

    row.MessageText = "";
    row.CreateStatus = "Processing";
    row.ReleaseStatus = "None";
    notify(hooks, row, index, "create");

    try {
      created = await service.createOrder(row);
      row.ProcessOrder = created.processOrder;
      row.CreateStatus = "Success";
      appendMessage(row, created.message);
      notify(hooks, row, index, "created");
    } catch (error) {
      row.CreateStatus = error && error.kind === "unknown" ? "Unknown" : "Error";
      row.ReleaseStatus = "None";
      appendMessage(row, errorMessage(error));
      notify(hooks, row, index, "createFailed");
      return;
    }

    row.ReleaseStatus = "Processing";
    notify(hooks, row, index, "readETag");
    try {
      eTagResult = await service.readLatestETag(row.ProcessOrder);
    } catch (error) {
      row.ReleaseStatus = "Unknown";
      appendMessage(row, errorMessage(error));
      notify(hooks, row, index, "etagUnknown");
      return;
    }

    try {
      released = await service.releaseOrder(row.ProcessOrder, eTagResult.eTag);
      row.ReleaseStatus = "Success";
      appendMessage(row, released.message);
      notify(hooks, row, index, "released");
    } catch (error) {
      row.ReleaseStatus = error && error.kind === "unknown" ? "Unknown" : "Error";
      appendMessage(row, errorMessage(error));
      notify(hooks, row, index, "releaseFailed");
    }
  }

  function summarize(rows) {
    var summary = {
      total: rows.length,
      success: 0,
      releaseFailed: 0,
      createFailed: 0,
      unknown: 0
    };

    rows.forEach(function (row) {
      if (row.CreateStatus === "Unknown" || row.ReleaseStatus === "Unknown") {
        summary.unknown += 1;
      } else if (row.CreateStatus === "Error") {
        summary.createFailed += 1;
      } else if (row.ReleaseStatus === "Error") {
        summary.releaseFailed += 1;
      } else if (row.CreateStatus === "Success" && row.ReleaseStatus === "Success") {
        summary.success += 1;
      }
    });
    return summary;
  }

  async function process(rows, service, hooks) {
    var index;
    for (index = 0; index < rows.length; index += 1) {
      if (hooks && typeof hooks.onProgress === "function") {
        hooks.onProgress(index + 1, rows.length);
      }
      await processRow(rows[index], index, service, hooks);
    }
    return summarize(rows);
  }

  return {
    process: process,
    summarize: summarize
  };
});
