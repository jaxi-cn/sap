sap.ui.define([
  "sap/ui/model/json/JSONModel"
], function (JSONModel) {
  "use strict";

  var BUSINESS_FIELDS = [
    "ProductionPlant",
    "Material",
    "ManufacturingOrderType",
    "MfgOrderPlannedStartDate",
    "MfgOrderPlannedEndDate",
    "TotalQuantity",
    "ProductionVersion"
  ];

  function createFieldStates() {
    return BUSINESS_FIELDS.reduce(function (states, field) {
      states[field] = { state: "None", text: "" };
      return states;
    }, {});
  }

  function createRow(values) {
    return Object.assign({
      SourceRow: 0,
      ProductionPlant: "",
      Material: "",
      ManufacturingOrderType: "",
      MfgOrderPlannedStartDate: "",
      MfgOrderPlannedEndDate: "",
      TotalQuantity: "",
      ProductionVersion: "",
      ProcessOrder: "",
      ValidationStatus: "None",
      CreateStatus: "None",
      ReleaseStatus: "None",
      MessageText: "",
      FieldStates: createFieldStates()
    }, values || {});
  }

  function createViewModel() {
    return new JSONModel({
      rows: [],
      busy: false,
      inputLocked: false,
      batchProcessed: false,
      validationPassed: false,
      currentIndex: 0,
      totalCount: 0,
      progressText: "",
      summaryText: "",
      canUpload: true,
      canValidate: false,
      canCreate: false
    });
  }

  return {
    BUSINESS_FIELDS: BUSINESS_FIELDS,
    createFieldStates: createFieldStates,
    createRow: createRow,
    createViewModel: createViewModel
  };
});
