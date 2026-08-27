import test from "node:test";
import assert from "node:assert/strict";

import { normalizeLanguageCode } from "../../src/lib/language-codes.js";
import {
  BluenteHttpClient,
  toBilingualParam,
  toScannedParam
} from "../../src/clients/bluente-http-client.js";
import { trimLanguageRecord } from "../../src/tools/get-supported-languages.tool.js";
import { documentWorkflowSchema, translateFileSchema, pageRangeSchema } from "../../src/tools/schemas.js";
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

test("bilingual defaults to off on both tool schemas", () => {
  assert.equal(documentWorkflowSchema.bilingual.parse(undefined), "off");
  assert.equal(translateFileSchema.bilingual.parse(undefined), "off");
});

test("page_range schema accepts range shapes and rejects garbage", () => {
  assert.equal(pageRangeSchema.parse("1-3,5"), "1-3,5");
  assert.equal(pageRangeSchema.parse("2"), "2");
  assert.equal(pageRangeSchema.parse(" 1 - 3 , 5 "), " 1 - 3 , 5 ");
  assert.throws(() => pageRangeSchema.parse("1-"));
  assert.throws(() => pageRangeSchema.parse("abc"));
});

test("translateFile normalizes languages, flags, mode, and page_range on the wire", async () => {
  const client = new BluenteHttpClient({ apiKey: "k", baseUrl: "https://example.test" });
  let sent = null;
  client.requestJson = async (apiPath, options) => {
    sent = JSON.parse(options.body);
    return { code: 0, data: {} };
  };

  await client.translateFile({
    id: "task_1",
    action: "start",
    from: "zh-CN",
    to: "ja",
    engine: "LLM",
    glossary: 1,
    customGlossary: 1,
    bilingual: "on",
    verticalBilingual: 0,
    scanned: "scanned (overlay)",
    pageRange: "1-3,5"
  });

  assert.equal(sent.from, "zh");
  assert.equal(sent.to, "jp");
  assert.equal(sent.bilingual, 1);
  assert.equal(sent.scanned, 2);
  assert.equal(sent.page_range, "1-3,5");

  await client.translateFile({ id: "task_1", action: "start", from: "en", to: "de" });
  assert.equal(sent.bilingual, 0);
  assert.equal(sent.scanned, 0);
  assert.equal("page_range" in sent, false);
});

test("workflow always sends both glossary flags on and threads page_range", async () => {
  const calls = [];
  const fakeClient = {
    async uploadFile(request) {
      calls.push(["uploadFile", request]);
      return { code: 0, data: { id: "task_9" } };
    },
    async translateFile(request) {
      calls.push(["translateFile", request]);
      return { code: 0, data: {} };
    },
    async getTranslationStatus() {
      return { code: 0, data: { status: "READY" } };
    }
  };

  const service = new TranslationWorkflowService({ client: fakeClient });
  await service.runDocumentWorkflow({
    filePath: "./sample.pdf",
    from: "en",
    to: "zh",
    toType: "docx",
    engine: "LLM",
    bilingual: "off",
    verticalBilingual: 0,
    scanned: "standard",
    pageRange: "1-2",
    pollIntervalMs: 1,
    maxPollAttempts: 2,
    autoDownload: false
  });

  const upload = calls.find(([name]) => name === "uploadFile")[1];
  const start = calls.find(([name]) => name === "translateFile")[1];
  assert.equal(upload.glossary, 1);
  assert.equal(start.glossary, 1);
  assert.equal(start.customGlossary, 1);
  assert.equal(start.pageRange, "1-2");
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
