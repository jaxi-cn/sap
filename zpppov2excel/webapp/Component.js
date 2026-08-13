sap.ui.define([
  "sap/ui/core/UIComponent",
  "zpp/processorder/v2excel/zpppov2excel/model/models"
], function (UIComponent, models) {
  "use strict";

  return UIComponent.extend("zpp.processorder.v2excel.zpppov2excel.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      this.setModel(models.createViewModel(), "view");
    }
  });
});
