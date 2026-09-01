import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseContentDispositionFileName, writeNewFile } from "../src/clients/bluente-http-client.js";

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

test("a download never overwrites an existing file", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bluente-mcp-"));
  const target = path.join(dir, "out.docx");
  await writeNewFile(target, "first");
  await assert.rejects(writeNewFile(target, "second"), /already exists .* output_path/);
  assert.equal(await fs.readFile(target, "utf8"), "first");
  await fs.rm(dir, { recursive: true });
});
