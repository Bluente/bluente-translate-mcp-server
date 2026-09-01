import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { API_PATHS } from "../constants/api.js";
import { BluenteApiError } from "../lib/errors.js";
import { normalizeLanguageCode } from "../lib/language-codes.js";

export const MAX_INLINE_DOWNLOAD_BYTES = 2 * 1024 * 1024;

function inferFilename(fileUrl) {
  try {
    const pathname = new URL(fileUrl).pathname;
    const fileName = pathname.split("/").filter(Boolean).pop();
    return fileName || "document";
  } catch {
    return "document";
  }
}

// The server picks this name from the source document, so it is untrusted:
// only a bare file name survives, never a directory component.
function safeFileName(name) {
  const base = path.basename(name.replace(/[\x00-\x1f\x7f]/g, ""));
  return base && base !== "." && base !== ".." ? base : null;
}

export function parseContentDispositionFileName(contentDisposition) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return safeFileName(decodeURIComponent(utf8Match[1]));
    } catch {
      return safeFileName(utf8Match[1]);
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ? safeFileName(basicMatch[1]) : null;
}

function defaultOutputDir() {
  return process.env.BLUENTE_OUTPUT_DIR || path.join(os.homedir(), "Downloads", "bluente");
}

// Never clobbers: "wx" fails if the path exists, so a translated file can not
// overwrite something the user already had there.
export async function writeNewFile(filePath, data) {
  try {
    await fs.writeFile(filePath, data, { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new BluenteApiError(
        `A file already exists at ${filePath}; it was not overwritten. Pass a different output_path.`,
        { output_path: filePath }
      );
    }
    throw error;
  }
}

// The API takes a numeric task id; hosts routinely hand ids back as strings.
function normalizeTaskId(id) {
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }

  if (typeof id === "string" && id.trim()) {
    const asNumber = Number(id);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }

  return id;
}

// The platform runs a single engine; the parameter survives only for wire
// compatibility, so every request pins it rather than trusting the caller.
export function toEngineParam(engine) {
  void engine;
  return 3;
}

export function toBilingualParam(value) {
  if (value === 1 || value === "1") return 1;
  if (value === 0 || value === "0" || value === "off") return 0;
  // The API is binary; line/paragraph are legacy aliases for on.
  if (value === "on" || value === "line" || value === "paragraph") return 1;
  return 0;
}

// Backend layout flag: IsVerticalBilingual = (vertical_bilingual == "1").
// Left-Right (side by side) is 0, Top-Down (stacked) is 1; only read when
// bilingual is on. The numeric alias keeps stale sessions working.
export function toVerticalBilingualParam(layout, verticalBilingual) {
  if (layout === "top-down") return 1;
  if (layout === "left-right") return 0;
  return verticalBilingual === 1 || verticalBilingual === "1" ? 1 : 0;
}

// scanned_option: 0 none, 1 text OCR, 2 overlay, 3 image translation.
const SCANNED_MODES = {
  standard: 0,
  "scanned (text)": 1,
  "scanned (overlay)": 2,
  image: 3,
  // legacy aliases
  none: 0,
  text: 1,
  overlay: 2
};

export function toScannedParam(value) {
  if (typeof value === "string" && value in SCANNED_MODES) return SCANNED_MODES[value];
  const asNumber = Number(value);
  return Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 3 ? asNumber : 0;
}

function isRuntimeUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readFileFromUrl({ fileUrl, fileName }) {
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new BluenteApiError("Failed to download source file from URL.", {
      fileUrl,
      status: fileResponse.status,
      statusText: fileResponse.statusText
    });
  }

  const fileBuffer = await fileResponse.arrayBuffer();
  const resolvedFileName =
    fileName ||
    parseContentDispositionFileName(fileResponse.headers.get("content-disposition")) ||
    inferFilename(fileUrl);

  return { fileBuffer, resolvedFileName };
}

async function readLocalUploadSource({ filePath, fileName }) {
  const absolutePath = path.resolve(filePath);
  try {
    return {
      fileBuffer: await fs.readFile(absolutePath),
      resolvedFileName: fileName || path.basename(absolutePath)
    };
  } catch (error) {
    throw new BluenteApiError("Failed to read the local file.", {
      filePath,
      reason: error?.message || String(error)
    });
  }
}

async function readUploadSource({ fileUrl, filePath, fileBuffer, fileName }) {
  if (fileBuffer) {
    return { fileBuffer, resolvedFileName: fileName || "document" };
  }

  if (isRuntimeUrl(fileUrl)) {
    return readFileFromUrl({ fileUrl, fileName });
  }

  if (typeof filePath === "string" && filePath.trim()) {
    return readLocalUploadSource({ filePath, fileName });
  }

  throw new BluenteApiError(
    "Missing source file. Provide file_path for a file on this machine, or file_url for a publicly accessible link."
  );
}

export class BluenteHttpClient {
  constructor({ apiKey, baseUrl, timeoutMs = 90_000 }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async getSupportedLanguages() {
    return this.requestJson(API_PATHS.SUPPORTED_LANGUAGES, { method: "GET" });
  }

  async uploadFile({ fileUrl, filePath, fileBuffer, fileName, engine, glossary }) {
    const source = await readUploadSource({ fileUrl, filePath, fileBuffer, fileName });

    const form = new FormData();
    form.append("file", new File([source.fileBuffer], source.resolvedFileName));
    form.append("engine", String(toEngineParam(engine)));
    form.append("glossary", String(glossary));

    return this.requestJson(API_PATHS.UPLOAD_FILE, {
      method: "POST",
      body: form
    });
  }

  async getTranslationStatus({ id, entry }) {
    return this.requestJson(API_PATHS.GET_TRANSLATION_STATUS, {
      method: "GET",
      query: { id, entry }
    });
  }

  async translateFile(request) {
    const body = {
      id: normalizeTaskId(request.id),
      action: request.action,
      from: normalizeLanguageCode(request.from),
      to: normalizeLanguageCode(request.to)
    };

    if (request.pageRange) {
      body.page_range = request.pageRange;
    }

    if (request.namespace) {
      body.namespace = request.namespace;
    }

    if (request.metadata) {
      body.metadata = request.metadata;
    }

    // The translation options ride as query params, not in the body: that is
    // what the backend reads on a start. Only a start carries them.
    return this.requestJson(API_PATHS.TRANSLATE_FILE, {
      method: "POST",
      query:
        request.action === "start"
          ? {
              engine: toEngineParam(request.engine),
              glossary: request.glossary,
              custom_glossary: request.customGlossary,
              bilingual: toBilingualParam(request.bilingual),
              vertical_bilingual: toVerticalBilingualParam(
                request.bilingualLayout,
                request.verticalBilingual
              ),
              scanned: toScannedParam(request.scanned)
            }
          : undefined,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async downloadFile({ id, toType, includeFileContent = false, outputPath, outputDir }) {
    const response = await this.requestRaw(API_PATHS.DOWNLOAD_FILE, {
      method: "GET",
      query: { id, to_type: toType }
    });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition") || "";

    if (contentType.includes("application/json")) {
      const payload = await response.json();
      this.assertBluenteSuccess(payload, API_PATHS.DOWNLOAD_FILE);
      throw new BluenteApiError("Unexpected JSON payload returned for file download.", {
        apiPath: API_PATHS.DOWNLOAD_FILE,
        payload
      });
    }

    const outputBuffer = Buffer.from(await response.arrayBuffer());
    const bytes = outputBuffer.length;
    const fileName = parseContentDispositionFileName(contentDisposition) || `${id}.${toType}`;

    // Base64 file content rides through the model's context window; past ~2MB it
    // floods the chat instead of delivering a file. The file is on disk anyway.
    if (includeFileContent && bytes > MAX_INLINE_DOWNLOAD_BYTES) {
      throw new BluenteApiError(
        `The translated file is ${bytes} bytes, too large to return inline as base64. Call again without include_file_content and read it from output_path.`,
        { file_name: fileName, bytes }
      );
    }

    // Unlike the hosted server, which hands out signed links, this one runs on
    // the user's machine and simply saves the file where they can open it. The
    // default is a Downloads folder, not whatever cwd the MCP host launched us in.
    let resolvedPath;
    if (outputPath) {
      resolvedPath = path.resolve(outputPath);
    } else {
      const dir = outputDir || defaultOutputDir();
      await fs.mkdir(dir, { recursive: true });
      resolvedPath = path.resolve(dir, fileName);
    }
    await writeNewFile(resolvedPath, outputBuffer);

    return {
      translate_id: String(id),
      file_name: fileName,
      content_type: contentType,
      bytes,
      output_path: resolvedPath,
      file_base64: includeFileContent ? outputBuffer.toString("base64") : undefined
    };
  }

  async requestJson(apiPath, options) {
    const response = await this.requestRaw(apiPath, options);
    const payload = await response.json();
    this.assertBluenteSuccess(payload, apiPath);
    return payload;
  }

  async requestRaw(apiPath, { method = "GET", headers = {}, query, body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestUrl = new URL(`${this.baseUrl}${apiPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          requestUrl.searchParams.set(key, String(value));
        }
      }
    }

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...headers
        },
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new BluenteApiError("Bluente API request failed.", {
          apiPath,
          status: response.status,
          statusText: response.statusText,
          responseText
        });
      }

      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new BluenteApiError("Bluente API request timed out.", {
          apiPath,
          timeoutMs: this.timeoutMs
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  assertBluenteSuccess(payload, apiPath) {
    if (!payload || payload.code !== 0) {
      throw new BluenteApiError("Bluente API returned a non-success result.", {
        apiPath,
        code: payload?.code,
        message: payload?.message,
        payload
      });
    }
  }
}
