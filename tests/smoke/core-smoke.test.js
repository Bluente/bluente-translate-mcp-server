import test from "node:test";
import assert from "node:assert/strict";

import { loadEnv } from "../../src/config/env.js";
import { TranslationWorkflowService } from "../../src/services/translation-workflow-service.js";

const originalEnv = {
  BLUENTE_API_KEY: process.env.BLUENTE_API_KEY,
  BLUENTE_API_BASE_URL: process.env.BLUENTE_API_BASE_URL,
  BLUENTE_API_TIMEOUT_MS: process.env.BLUENTE_API_TIMEOUT_MS
};

test("loadEnv should return normalized configuration when key is set", () => {
  process.env.BLUENTE_API_KEY = "test_key";
  process.env.BLUENTE_API_BASE_URL = "https://api.bluente.com/api/20250924/";
  process.env.BLUENTE_API_TIMEOUT_MS = "30000";

  const env = loadEnv();

  assert.equal(env.apiKey, "test_key");
  assert.equal(env.apiBaseUrl, "https://api.bluente.com/api/20250924");
  assert.equal(env.timeoutMs, 30000);
});

test("loadEnv should fall back to default timeout for invalid values", () => {
  process.env.BLUENTE_API_KEY = "test_key";
  process.env.BLUENTE_API_TIMEOUT_MS = "invalid";

  const env = loadEnv();
  assert.equal(env.timeoutMs, 90000);
});

test("loadEnv should throw when BLUENTE_API_KEY is missing", () => {
  delete process.env.BLUENTE_API_KEY;

  assert.throws(() => loadEnv(), /BLUENTE_API_KEY/);
});

test("workflow service should execute upload-start-poll-download path", async () => {
  const calls = [];

  const fakeClient = {
    async uploadFile(request) {
      calls.push(["uploadFile", request]);
      return { code: 0, data: { id: "task_123" } };
    },
    async translateFile(request) {
      calls.push(["translateFile", request]);
      return { code: 0, data: {} };
    },
    async getTranslationStatus(request) {
      calls.push(["getTranslationStatus", request]);
      return { code: 0, data: { status: "READY" } };
    },
    async downloadFile(request) {
      calls.push(["downloadFile", request]);
      return { outputPath: "/tmp/task_123.docx", bytes: 1024, contentType: "application/octet-stream" };
    }
  };

  const service = new TranslationWorkflowService({ client: fakeClient });
  const result = await service.runDocumentWorkflow({
    filePath: "./sample.pdf",
    from: "en",
    to: "zh-CN",
    toType: "docx",
    engine: "LLM",
    glossary: 0,
    customGlossary: 0,
    bilingual: "line",
    verticalBilingual: 0,
    scanned: 0,
    namespace: undefined,
    metadata: undefined,
    pollIntervalMs: 1,
    maxPollAttempts: 2,
    autoDownload: true,
    statusEntry: "word",
    outputPath: "/tmp/task_123.docx"
  });

  assert.equal(result.id, "task_123");
  assert.equal(result.finalStatus, "READY");
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((item) => item[0]), [
    "uploadFile",
    "translateFile",
    "getTranslationStatus",
    "downloadFile"
  ]);
  assert.equal(calls[2][1].entry, "word");
});

test.after(() => {
  if (originalEnv.BLUENTE_API_KEY === undefined) delete process.env.BLUENTE_API_KEY;
  else process.env.BLUENTE_API_KEY = originalEnv.BLUENTE_API_KEY;

  if (originalEnv.BLUENTE_API_BASE_URL === undefined) delete process.env.BLUENTE_API_BASE_URL;
  else process.env.BLUENTE_API_BASE_URL = originalEnv.BLUENTE_API_BASE_URL;

  if (originalEnv.BLUENTE_API_TIMEOUT_MS === undefined) delete process.env.BLUENTE_API_TIMEOUT_MS;
  else process.env.BLUENTE_API_TIMEOUT_MS = originalEnv.BLUENTE_API_TIMEOUT_MS;
});
