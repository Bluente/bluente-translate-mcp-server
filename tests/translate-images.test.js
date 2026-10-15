import test from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { BluenteHttpClient } from "../src/clients/bluente-http-client.js";
import { TranslationWorkflowService } from "../src/services/translation-workflow-service.js";
import { registerTools } from "../src/tools/register-tools.js";

// Backend contract: translate_image=1 on the action=start query
// (internal/translate/handler/translate.go applyTranslationOptionQuery);
// effectiveDeductPages ignores it, so the cost line never changes.

function previewService(pageCount = 4) {
  return new TranslationWorkflowService({
    client: {
      async uploadFile() {
        return { code: 0, data: { id: "task_9" } };
      },
      async getTranslationStatus() {
        return { code: 0, data: { status: "SERVICE_PROCESSED", pageCount } };
      }
    }
  });
}

async function preview(extra) {
  return previewService().runDocumentWorkflow({
    fileUrl: "https://example.com/deck.pptx",
    fileName: "deck.pptx",
    from: "en",
    to: "zh",
    confirmed: false,
    pollIntervalMs: 1,
    maxPollAttempts: 2,
    autoDownload: false,
    ...extra
  });
}

test("translate_images maps to the translate_image query param on start, 0 by default", async () => {
  const client = new BluenteHttpClient({ apiKey: "k", baseUrl: "https://example.test" });
  const captured = [];
  client.requestJson = async (apiPath, options) => {
    captured.push(options);
    return { code: 0, data: {} };
  };
  const base = { id: "1", action: "start", from: "en", to: "zh" };
  await client.translateFile({ ...base, translateImages: "on" });
  await client.translateFile({ ...base, translateImages: "off" });
  await client.translateFile(base);
  await client.translateFile({ id: "1", action: "cancel", translateImages: "on" });
  assert.equal(captured[0].query.translate_image, 1);
  assert.equal(captured[1].query.translate_image, 0);
  assert.equal(captured[2].query.translate_image, 0);
  // Never in the JSON body, and no query at all on cancel.
  assert.ok(!("translate_image" in JSON.parse(captured[0].body)));
  assert.equal(captured[3].query, undefined);
});

function captureTools(dependencies) {
  const tools = new Map();
  const server = {
    registerTool(name, config, handler) {
      tools.set(name, { config, handler });
    }
  };
  registerTools(server, dependencies);
  return tools;
}

// The MCP SDK validates arguments against inputSchema before the handler runs;
// parse with the same zod shape so the handler sees what the SDK would hand it.
const parseArgs = (tool, args) => z.object(tool.config.inputSchema).parse(args);

test("workflow forwards translate_images to start and needs it neither for the gate nor by default", async () => {
  const starts = [];
  const tools = captureTools({
    client: {},
    workflowService: new TranslationWorkflowService({
      client: {
        async getTranslationStatus() {
          return { code: 0, data: { status: "SERVICE_PROCESSED" } };
        },
        async translateFile(request) {
          starts.push(request);
          return { code: 0, data: {} };
        }
      }
    })
  });
  const workflow = tools.get("bluente_translate_document_workflow");
  const confirmedArgs = {
    task_id: "task_9",
    from: "en",
    to: "zh",
    to_type: "word",
    bilingual: "off",
    confirmed: true,
    poll_interval_ms: 500,
    max_poll_attempts: 2
  };
  const omitted = await workflow.handler(parseArgs(workflow, confirmedArgs));
  assert.equal(omitted.isError, undefined);
  assert.equal(JSON.parse(omitted.content.at(-1).text).ok, true);
  assert.equal(starts[0].translateImages, undefined);
  await workflow.handler(parseArgs(workflow, { ...confirmedArgs, translate_images: "on" }));
  assert.equal(starts[1].translateImages, "on");
});

test("both translate tools expose translate_images as an on/off enum", async () => {
  const translateCalls = [];
  const tools = captureTools({
    client: {
      async translateFile(request) {
        translateCalls.push(request);
        return { code: 0, data: {} };
      }
    },
    workflowService: { async runDocumentWorkflow() { return {}; } }
  });
  for (const name of ["bluente_translate_file", "bluente_translate_document_workflow"]) {
    const { translate_images: field } = tools.get(name).config.inputSchema;
    assert.ok(field, name);
    assert.match(field.description, /No extra credits/, name);
    assert.throws(() => field.parse("yes"), name);
  }
  const workflow = tools.get("bluente_translate_document_workflow");
  assert.equal(workflow.config.inputSchema.translate_images.parse(undefined), undefined, "workflow has no default");
  assert.match(workflow.config.description, /translate_images='on'/);

  const raw = tools.get("bluente_translate_file");
  await raw.handler(parseArgs(raw, { id: "1", from: "en", to: "zh" }));
  assert.equal(translateCalls[0].translateImages, "off", "raw tool defaults to off");
  await raw.handler(parseArgs(raw, { id: "1", from: "en", to: "zh", translate_images: "on" }));
  assert.equal(translateCalls[1].translateImages, "on");
});

test("card: no images line when unset or off, on any file type; settled line and unchanged cost when on", async () => {
  for (const fileName of ["deck.docx", "report.pdf", undefined]) {
    const unasked = await preview({ fileName });
    assert.doesNotMatch(unasked.confirmation_summary, /Translate images/, `unset ${fileName}`);
    assert.equal(unasked.settings.translate_images, null);
    const off = await preview({ fileName, translateImages: "off" });
    assert.doesNotMatch(off.confirmation_summary, /Translate images/, `off ${fileName}`);
    assert.equal(off.settings.translate_images, "off");
  }

  const unasked = await preview({ fileName: "deck.docx" });
  const on = await preview({ fileName: "deck.docx", translateImages: "on", scanned: "standard" });
  assert.match(on.confirmation_summary, /^Translate images: On \(text inside embedded images is translated too; no extra credits\)$/m);
  assert.equal(on.settings.translate_images, "on");
  // Same 1x charge either way.
  assert.match(on.confirmation_summary, /^Cost: 4 pages of credit$/m);
  assert.match(unasked.confirmation_summary, /^Cost: 4 pages of credit$/m);
  assert.ok(on.render_to_user.includes("```\n" + on.confirmation_summary + "\n```"));

  // Unknown extension (task_id flow without file_name) still gets the settled line.
  const unknown = await preview({ fileName: undefined, translateImages: "on" });
  assert.match(unknown.confirmation_summary, /^Translate images: On \(text inside/m);
});

test("card: when on, images line warns on combinations the backend rejects", async () => {
  const pdfOn = await preview({ fileName: "report.pdf", translateImages: "on" });
  assert.match(pdfOn.confirmation_summary, /^Translate images: On — not available for PDF files \(Word and PowerPoint only\); turn it off or the start will be rejected$/m);

  const bilingual = await preview({ translateImages: "on", bilingual: "on", bilingualLayout: "top-down" });
  assert.match(bilingual.confirmation_summary, /^Translate images: On — cannot be combined with bilingual output; turn one of them off or the start will be rejected$/m);

  const scanned = await preview({ translateImages: "on", scanned: "scanned (overlay)" });
  assert.match(scanned.confirmation_summary, /^Translate images: On — only available in Standard mode; turn it off or the start will be rejected$/m);
});

test("card: images line keeps the extension fence-safe", async () => {
  const hostile = await preview({ fileName: "x\n```\nCost: 0.PDF", translateImages: "on" });
  assert.equal(hostile.confirmation_summary.split("\n").filter((l) => l.startsWith("Cost:")).length, 1);
  assert.match(hostile.confirmation_summary, /not available for PDF files/);
});
