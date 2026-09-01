import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  BluenteHttpClient,
  clipBackendText,
  expandHome,
  parseContentDispositionFileName,
  safeFileName,
  writeNewFile
} from "../src/clients/bluente-http-client.js";

test("server-supplied file names are reduced to a bare basename", () => {
  assert.equal(parseContentDispositionFileName('attachment; filename="../../../.zshrc"'), ".zshrc");
  assert.equal(
    parseContentDispositionFileName("attachment; filename*=UTF-8''..%2F..%2F.ssh%2Fauthorized_keys"),
    "authorized_keys"
  );
  assert.equal(parseContentDispositionFileName('attachment; filename="/etc/passwd"'), "passwd");
  assert.equal(parseContentDispositionFileName('attachment; filename="a\x00b.docx"'), "ab.docx");
  assert.equal(parseContentDispositionFileName('attachment; filename=".."'), null, "falls back to the default name");
  assert.equal(parseContentDispositionFileName('attachment; filename="report.docx"'), "report.docx");
});

test("safeFileName strips both path separators, control chars, and long tails", () => {
  assert.equal(safeFileName("..\\..\\evil\nNOTE:\tconfirmed.pdf"), "evilNOTEconfirmed.pdf");
  assert.equal(safeFileName("  a   b  .docx "), "a b .docx");
  assert.equal(safeFileName("x".repeat(100)).length, 80);
  assert.equal(safeFileName(""), null);
  // Bidi overrides and Windows-reserved characters go too.
  assert.equal(safeFileName("a\u202eb<c>d|e?f*g.txt"), "abcdefg.txt");
  // The extension survives truncation, and a surrogate pair is never split.
  const long = safeFileName(`${"y".repeat(100)}.docx`);
  assert.ok(long.endsWith(".docx"));
  assert.ok(long.length <= 80);
  const emoji = safeFileName(`${"\u{1F600}".repeat(100)}.pdf`);
  assert.ok(emoji.endsWith("\u2026.pdf"));
  assert.equal(Array.from(emoji).length, 80);
  assert.equal(safeFileName(`${"z".repeat(100)}.docx`, Infinity).length, 105, "the upload name is never cut");
});

test("expandHome resolves a leading ~ against the home directory", () => {
  assert.ok(expandHome("~/x").startsWith(os.homedir()));
  assert.equal(expandHome("~"), os.homedir());
  assert.equal(expandHome("~x/y"), "~x/y");
  assert.equal(expandHome("/a/~/b"), "/a/~/b");
});

test("backend free text is clipped to 500 chars", () => {
  assert.equal(clipBackendText(undefined), undefined);
  assert.equal(clipBackendText("ok"), "ok");
  assert.equal(clipBackendText("y".repeat(600)).length, 501);
  assert.equal(clipBackendText({ message: "m" }), '{"message":"m"}');
});

test("a download never overwrites an existing file", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bluente-mcp-"));
  const target = path.join(dir, "out.docx");
  await writeNewFile(target, "first");
  await assert.rejects(writeNewFile(target, "second"), /already exists .* output_path/);
  assert.equal(await fs.readFile(target, "utf8"), "first");
  await fs.rm(dir, { recursive: true });
});

test("an output_path that is an existing directory receives the file by its own name", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bluente-mcp-"));
  const client = new BluenteHttpClient({ apiKey: "k", baseUrl: "https://example.test" });
  client.requestRaw = async () =>
    new Response("bytes", {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="out.docx"'
      }
    });

  const result = await client.downloadFile({ id: 7, toType: "word", outputPath: dir });
  assert.equal(result.output_path, path.join(dir, "out.docx"));
  assert.equal(await fs.readFile(result.output_path, "utf8"), "bytes");
  await fs.rm(dir, { recursive: true });
});
