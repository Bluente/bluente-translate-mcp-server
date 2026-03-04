import fs from "node:fs/promises";
import path from "node:path";
import { API_PATHS } from "../constants/api.js";
import { BluenteApiError } from "../lib/errors.js";

export class BluenteHttpClient {
  constructor({ apiKey, baseUrl, timeoutMs = 90_000 }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async getSupportedLanguages() {
    return this.requestJson(API_PATHS.SUPPORTED_LANGUAGES, { method: "GET" });
  }

  async uploadFile({ filePath, engine, glossary }) {
    const resolvedPath = path.resolve(filePath);
    const fileName = path.basename(resolvedPath);
    const fileBuffer = await fs.readFile(resolvedPath);

    const form = new FormData();
    form.append("file", new Blob([fileBuffer]), fileName);
    form.append("engine", String(engine));
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
      id: request.id,
      action: request.action,
      from: request.from,
      to: request.to,
      engine: request.engine,
      glossary: request.glossary,
      custom_glossary: request.customGlossary,
      bilingual: request.bilingual,
      vertical_bilingual: request.verticalBilingual,
      scanned: request.scanned
    };

    if (request.namespace) {
      body.namespace = request.namespace;
    }

    if (request.metadata) {
      body.metadata = request.metadata;
    }

    return this.requestJson(API_PATHS.TRANSLATE_FILE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async downloadFile({ id, toType, outputPath }) {
    const response = await this.requestRaw(API_PATHS.DOWNLOAD_FILE, {
      method: "GET",
      query: { id, to_type: toType }
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      this.assertBluenteSuccess(payload, API_PATHS.DOWNLOAD_FILE);
      throw new BluenteApiError("Unexpected JSON payload returned for file download.", {
        apiPath: API_PATHS.DOWNLOAD_FILE,
        payload
      });
    }

    const outputBuffer = Buffer.from(await response.arrayBuffer());
    const resolvedPath = outputPath
      ? path.resolve(outputPath)
      : path.resolve(process.cwd(), `${id}.${toType}`);

    await fs.writeFile(resolvedPath, outputBuffer);

    return {
      outputPath: resolvedPath,
      contentType: contentType || "application/octet-stream",
      bytes: outputBuffer.length
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
