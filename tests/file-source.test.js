import assert from "node:assert/strict";
import test from "node:test";
import { resolveToolFileSource } from "../src/lib/file-source.js";

test("local path is a first-class source on this server", () => {
  const { filePath, fileUrl, fileBuffer } = resolveToolFileSource({ file_path: "./sample.pdf" });
  assert.equal(filePath, "./sample.pdf");
  assert.equal(fileUrl, undefined);
  assert.equal(fileBuffer, undefined);
});

test("a local path supplies the file name the confirmation card shows", () => {
  assert.equal(resolveToolFileSource({ file_path: "/docs/q3 report.pdf" }).fileName, "q3 report.pdf");
  assert.equal(
    resolveToolFileSource({ file_path: "/docs/a.pdf", file_name: "override.pdf" }).fileName,
    "override.pdf"
  );
});

test("a url wins over a path, and an attachment's download_url wins over file_url", () => {
  assert.equal(
    resolveToolFileSource({ file_path: "./a.pdf", file_url: "https://x.test/a.pdf" }).fileUrl,
    "https://x.test/a.pdf"
  );
  assert.equal(
    resolveToolFileSource({
      file_url: "https://x.test/a.pdf",
      file_to_translate: { download_url: "https://y.test/b.pdf", file_id: "1", file_name: "b.pdf" }
    }).fileUrl,
    "https://y.test/b.pdf"
  );
});

test("base64 is decoded only when it is the sole source", () => {
  const { fileBuffer } = resolveToolFileSource({
    file_content_base64: Buffer.from("hello").toString("base64")
  });
  assert.equal(Buffer.from(fileBuffer).toString(), "hello");

  assert.equal(
    resolveToolFileSource({ file_path: "./a.pdf", file_content_base64: "aGk=" }).fileBuffer,
    undefined
  );
});

test("base64url without padding still decodes", () => {
  const { fileBuffer } = resolveToolFileSource({ file_content_base64: "a_-9" });
  assert.equal(fileBuffer.length, 3);
});

test("no source at all is an error", () => {
  assert.throws(() => resolveToolFileSource({}), /Missing source file/);
});

test("oversized base64 is refused before decoding", () => {
  assert.throws(
    () => resolveToolFileSource({ file_content_base64: "A".repeat(3 * 1024 * 1024) }),
    /2MB/
  );
});
