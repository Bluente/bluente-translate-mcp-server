import test from "node:test";
import assert from "node:assert/strict";

import { normalizeLanguageCode } from "../../src/lib/language-codes.js";
import {
  BluenteHttpClient,
  toBilingualParam,
  toEngineParam,
  toScannedParam,
  toVerticalBilingualParam
} from "../../src/clients/bluente-http-client.js";
import { trimLanguageRecord } from "../../src/tools/get-supported-languages.tool.js";
import {
  documentWorkflowSchema,
  downloadFileSchema,
  getStatusSchema,
  pageRangeSchema,
  translateFileSchema
} from "../../src/tools/schemas.js";
import { TranslationWorkflowService } from "../../src/services/translation-workflow-service.js";

test("normalizeLanguageCode maps common ISO codes and passes unknowns through", () => {
  assert.equal(normalizeLanguageCode("zh-CN"), "zh");
  assert.equal(normalizeLanguageCode("zh-Hans"), "zh");
  assert.equal(normalizeLanguageCode("ZH-TW"), "cht");
  assert.equal(normalizeLanguageCode("zh-Hant"), "cht");
  assert.equal(normalizeLanguageCode("ja"), "jp");
  assert.equal(normalizeLanguageCode("ko"), "kor");
  assert.equal(normalizeLanguageCode("kr"), "kor");
  assert.equal(normalizeLanguageCode("fr"), "fra");
  assert.equal(normalizeLanguageCode("es"), "spa");
  assert.equal(normalizeLanguageCode("en"), "en");
  assert.equal(normalizeLanguageCode("xx-YY"), "xx-YY");
  assert.equal(normalizeLanguageCode(undefined), undefined);
});

test("toBilingualParam collapses aliases onto the binary API flag", () => {
  assert.equal(toBilingualParam("off"), 0);
  assert.equal(toBilingualParam("none"), 0);
  assert.equal(toBilingualParam(undefined), 0);
  assert.equal(toBilingualParam("on"), 1);
  assert.equal(toBilingualParam("line"), 1);
  assert.equal(toBilingualParam("paragraph"), 1);
  assert.equal(toBilingualParam(1), 1);
  assert.equal(toBilingualParam(0), 0);
});

test("toVerticalBilingualParam prefers the layout name over the numeric alias", () => {
  assert.equal(toVerticalBilingualParam("top-down", 0), 1);
  assert.equal(toVerticalBilingualParam("left-right", 1), 0);
  assert.equal(toVerticalBilingualParam(undefined, 1), 1);
  assert.equal(toVerticalBilingualParam(undefined, undefined), 0);
});

test("toEngineParam pins the engine the platform actually runs", () => {
  assert.equal(toEngineParam("LLM"), 3);
  assert.equal(toEngineParam(undefined), 3);
});

test("toScannedParam maps mode names to scanned_option and defaults to 0", () => {
  assert.equal(toScannedParam("standard"), 0);
  assert.equal(toScannedParam("scanned (text)"), 1);
  assert.equal(toScannedParam("scanned (overlay)"), 2);
  assert.equal(toScannedParam("image"), 3);
  assert.equal(toScannedParam(2), 2);
  assert.equal(toScannedParam(undefined), 0);
  assert.equal(toScannedParam("bogus"), 0);
  assert.equal(toScannedParam(7), 0);
});

test("workflow schema leaves the confirm-gated settings undefaulted", () => {
  // A default here would be indistinguishable from a user's choice at the gate.
  assert.equal(documentWorkflowSchema.to_type.parse(undefined), undefined);
  assert.equal(documentWorkflowSchema.bilingual.parse(undefined), undefined);
  assert.equal(documentWorkflowSchema.mode.parse(undefined), undefined);
  assert.equal(documentWorkflowSchema.confirmed.parse(undefined), false);
  assert.equal(documentWorkflowSchema.auto_download.parse(undefined), false);
  assert.equal(documentWorkflowSchema.status_entry.parse(undefined), "get_status");
  assert.deepEqual(documentWorkflowSchema.to_type.parse(["pdf", "word"]), ["pdf", "word"]);
  assert.throws(() => documentWorkflowSchema.to_type.parse("docx"));
});

test("status and download schemas use the hosted vocabulary", () => {
  assert.equal(getStatusSchema.entry.parse(undefined), "get_status");
  assert.equal(getStatusSchema.entry.parse("get_page_count"), "get_page_count");
  assert.throws(() => getStatusSchema.entry.parse("pdf"));
  assert.equal(downloadFileSchema.to_type.parse(undefined), "word");
  assert.equal(downloadFileSchema.to_type.parse("pptx"), "pptx");
  assert.throws(() => downloadFileSchema.to_type.parse("docx"));
  assert.equal(translateFileSchema.bilingual.parse(undefined), "none");
});

test("page_range schema accepts range shapes and rejects garbage", () => {
  assert.equal(pageRangeSchema.parse("1-3,5"), "1-3,5");
  assert.equal(pageRangeSchema.parse("2"), "2");
  assert.equal(pageRangeSchema.parse(" 1 - 3 , 5 "), " 1 - 3 , 5 ");
  assert.throws(() => pageRangeSchema.parse("1-"));
  assert.throws(() => pageRangeSchema.parse("abc"));
});

test("translateFile puts options on the query string and the task on the body", async () => {
  const client = new BluenteHttpClient({ apiKey: "k", baseUrl: "https://example.test" });
  let sent = null;
  client.requestJson = async (apiPath, options) => {
    sent = { body: JSON.parse(options.body), query: options.query };
    return { code: 0, data: {} };
  };

  await client.translateFile({
    id: "1234",
    action: "start",
    from: "zh-CN",
    to: "ja",
    engine: "LLM",
    glossary: 1,
    customGlossary: 1,
    bilingual: "on",
    bilingualLayout: "top-down",
    verticalBilingual: 0,
    scanned: "scanned (overlay)",
    pageRange: "1-3,5"
  });

  assert.equal(sent.body.id, 1234, "numeric task id on the wire");
  assert.equal(sent.body.from, "zh");
  assert.equal(sent.body.to, "jp");
  assert.equal(sent.body.page_range, "1-3,5");
  assert.equal(sent.query.engine, 3);
  assert.equal(sent.query.bilingual, 1);
  assert.equal(sent.query.vertical_bilingual, 1, "bilingual_layout wins over vertical_bilingual");
  assert.equal(sent.query.scanned, 2);

  // A cancel carries no translation options at all.
  await client.translateFile({ id: "1234", action: "cancel" });
  assert.equal(sent.query, undefined);
});

test("trimLanguageRecord keeps only code and name", () => {
  assert.deepEqual(
    trimLanguageRecord({ svcCode: "zh", name: "Chinese (Simplified)", id: 3, createdAt: "x" }),
    { code: "zh", name: "Chinese (Simplified)" }
  );
  assert.deepEqual(trimLanguageRecord({ svcCode: "jp", language: "Japanese" }), {
    code: "jp",
    name: "Japanese"
  });
  assert.deepEqual(trimLanguageRecord({ unexpected: true }), { unexpected: true });
  assert.equal(trimLanguageRecord(null), null);
});

function fakeClient({ pageCount = 10, calls = [] } = {}) {
  return {
    calls,
    async uploadFile(request) {
      calls.push(["uploadFile", request]);
      return { code: 0, data: { id: "task_9" } };
    },
    async translateFile(request) {
      calls.push(["translateFile", request]);
      return { code: 0, data: {} };
    },
    async getTranslationStatus(request) {
      calls.push(["getTranslationStatus", request]);
      return {
        code: 0,
        data: {
          status: request.entry === "get_page_count" ? "SERVICE_PROCESSED" : "READY",
          pageCount
        }
      };
    },
    async downloadFile(request) {
      calls.push(["downloadFile", request]);
      return { translate_id: "task_9", file_name: "out.docx", bytes: 10, output_path: "/tmp/out.docx" };
    }
  };
}

const baseArgs = {
  filePath: "./sample.pdf",
  from: "en",
  to: "zh",
  pollIntervalMs: 1,
  maxPollAttempts: 3
};

test("an unconfirmed call uploads, quotes the page count, and starts nothing", async () => {
  const client = fakeClient();
  const result = await new TranslationWorkflowService({ client }).runDocumentWorkflow({
    ...baseArgs,
    fileName: "contract.pdf"
  });

  assert.equal(result.started, false);
  assert.equal(result.task_id, "task_9");
  assert.equal(result.page_count, 10);
  assert.equal(client.calls.find(([name]) => name === "uploadFile")[1].filePath, "./sample.pdf");
  assert.match(result.confirmation_summary, /contract\.pdf \(10 pages\)/);
  assert.match(result.confirmation_summary, /Output: \(ask the user/);
  assert.match(result.confirmation_summary, /Bilingual: \(ask the user\)/);
  assert.match(result.confirmation_summary, /^Mode: \(confirm/m, "an unasked mode reads as a decision");
  assert.match(result.render_to_user, /```/);
  assert.equal(
    client.calls.some(([name]) => name === "translateFile"),
    false,
    "nothing may start before the user confirms"
  );
});

test("the confirm gate refuses to start without task_id and explicit settings", async () => {
  const service = new TranslationWorkflowService({ client: fakeClient() });

  await assert.rejects(
    service.runDocumentWorkflow({ ...baseArgs, confirmed: true, toType: "word", bilingual: "off" }),
    /requires task_id/
  );
  await assert.rejects(
    service.runDocumentWorkflow({ ...baseArgs, taskId: "task_9", confirmed: true }),
    /to_type, bilingual/
  );
  await assert.rejects(
    service.runDocumentWorkflow({
      ...baseArgs,
      taskId: "task_9",
      confirmed: true,
      toType: "word",
      bilingual: "on"
    }),
    /bilingual_layout/
  );
});

test("a confirmed call starts with both glossary flags on and threads the settings", async () => {
  const client = fakeClient();
  const result = await new TranslationWorkflowService({ client }).runDocumentWorkflow({
    ...baseArgs,
    taskId: "task_9",
    confirmed: true,
    toType: "word",
    bilingual: "on",
    bilingualLayout: "left-right",
    scanned: "standard",
    pageRange: "1-2"
  });

  assert.equal(result.started, true);
  assert.equal(result.downloaded, false, "auto_download is off by default");
  assert.equal(
    client.calls.some(([name]) => name === "uploadFile"),
    false,
    "a task_id skips the upload"
  );
  const start = client.calls.find(([name]) => name === "translateFile")[1];
  assert.equal(start.glossary, 1);
  assert.equal(start.customGlossary, 1);
  assert.equal(start.bilingualLayout, "left-right");
  assert.equal(start.pageRange, "1-2");
});

test("a page_range beyond the document is rejected before it is priced", async () => {
  const service = new TranslationWorkflowService({ client: fakeClient({ pageCount: 4 }) });
  await assert.rejects(
    service.runDocumentWorkflow({ ...baseArgs, pageRange: "1-9" }),
    /not valid for this 4-page document/
  );

  const ok = await service.runDocumentWorkflow({ ...baseArgs, pageRange: "1-2,4" });
  assert.match(ok.confirmation_summary, /Cost: 3 pages/);
});

test("only image mode is priced above 1 credit per page", async () => {
  // Backend effectiveDeductPages: pages x 5 for image translation, pages x 1 for
  // everything else. The card used to warn that scanned modes cost extra (they
  // do not) and quoted image mode unmultiplied (billed 5x what it showed).
  const service = new TranslationWorkflowService({ client: fakeClient({ pageCount: 3 }) });

  const scan = await service.runDocumentWorkflow({ ...baseArgs, scanned: "scanned (overlay)" });
  assert.match(scan.confirmation_summary, /Cost: 3 pages of credit\n/);

  const image = await service.runDocumentWorkflow({ ...baseArgs, scanned: "image" });
  assert.match(image.confirmation_summary, /Cost: 15 pages of credit \(image mode: 5 per page for 3 pages\)/);
});

test("auto_download saves every requested format", async () => {
  const client = fakeClient();
  const result = await new TranslationWorkflowService({ client }).runDocumentWorkflow({
    ...baseArgs,
    taskId: "task_9",
    confirmed: true,
    toType: ["word", "pdf"],
    bilingual: "off",
    autoDownload: true,
    outputPath: "/tmp/out.docx"
  });

  assert.equal(result.downloaded, true);
  const downloads = client.calls.filter(([name]) => name === "downloadFile").map(([, r]) => r);
  assert.deepEqual(downloads.map((d) => d.toType), ["word", "pdf"]);
  assert.equal(downloads[0].outputPath, "/tmp/out.docx");
  assert.equal(downloads[1].outputPath, undefined, "only the first format is named outright");
  // Extra formats keep their own names beside it, never in the server's cwd.
  assert.equal(downloads[0].outputDir, "/tmp");
  assert.equal(downloads[1].outputDir, "/tmp");
});
