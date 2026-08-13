# Process Order Excel Upload Implementation Plan

> **For agentic workers:** Implement inline in this session. The user explicitly waived local tests and SAP acceptance because the real system is on another machine.

**Goal:** Generate a complete SAPUI5 freestyle reference project and detailed VS Code/SAP operation guide for serial OData V2 process-order creation and release.

**Architecture:** A JSON view model drives one responsive table. Focused services handle Excel, validation, OData, and serial orchestration; the controller owns page lifecycle and state transitions. SheetJS is copied into the application during npm install/build so runtime has no CDN dependency.

**Tech Stack:** SAPUI5 1.120.29, JavaScript ES2017, XML View, OData V2, SheetJS CE, UI5 CLI 3.

## Global Constraints

- Application ID is `zpp.processorder.v2excel.zpppov2excel`.
- OData service is `/sap/opu/odata/sap/ZAPI_PROCESS_ORDER_2_SRV/` with `useBatch=false`.
- Maximum 20 non-empty rows and exactly seven business fields.
- All rows must validate before creation starts.
- Each row executes Create → GET ETag → Release serially.
- Unknown mutation results are never retried.
- A processed batch remains locked until a new file is uploaded successfully.
- No real SAP test, BSP deployment, or transport is executed on this machine.

---

### Task 1: Project shell and runtime configuration

**Files:** `package.json`, `ui5.yaml`, `ui5-deploy.yaml`, `webapp/manifest.json`, `webapp/Component.js`, `webapp/index.html`, `scripts/copy-xlsx.mjs`

- [ ] Define scripts for dependency preparation, local serve, build and archive.
- [ ] Configure SAPUI5 1.120.29 and required framework libraries.
- [ ] Configure the V2 data source with `useBatch=false` and `sap-client=500`.
- [ ] Add an editable deployment template with BSP/package/transport values.

### Task 2: State helpers and service modules

**Files:** `webapp/model/models.js`, `webapp/service/ValidationService.js`, `webapp/service/ExcelService.js`, `webapp/service/ProcessOrderService.js`, `webapp/service/BatchProcessor.js`

- [ ] Create the initial page model and empty row shape.
- [ ] Implement strict batch validation and field states.
- [ ] Implement local SheetJS loading, template generation and workbook parsing.
- [ ] Wrap create/read/callFunction as Promises and classify errors.
- [ ] Implement a sequential, no-retry batch loop with row callbacks.

### Task 3: Controller and XML view

**Files:** `webapp/controller/Main.controller.js`, `webapp/view/Main.view.xml`, `webapp/css/style.css`, `webapp/i18n/i18n.properties`

- [ ] Implement upload, validation, edit invalidation, creation and summary handlers.
- [ ] Add beforeunload protection and reliable cleanup.
- [ ] Bind four business buttons and the twelve table columns.
- [ ] Make field errors and per-row process results visible.

### Task 4: Handover documentation and packaging

**Files:** `README.md`, `docs/technical-design.md`, `docs/vscode-operation-guide.md`, `.gitignore`

- [ ] Document prerequisites and exact VS Code commands.
- [ ] Document SAP metadata checks and fields that may need adaptation.
- [ ] Document local proxy expectations, build, BSP deployment and transport caveats.
- [ ] Document business acceptance cases for execution on the company machine.
- [ ] Perform file-level JSON/JavaScript/XML checks and create the ZIP archive.
