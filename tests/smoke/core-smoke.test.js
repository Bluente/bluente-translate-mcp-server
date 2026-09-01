import test from "node:test";
import assert from "node:assert/strict";

import { loadEnv } from "../../src/config/env.js";

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

test("loadEnv rejects a non-https base URL and accepts a Bluente https one", () => {
  process.env.BLUENTE_API_KEY = "test_key";
  process.env.BLUENTE_API_BASE_URL = "http://attacker.example/api";
  assert.throws(() => loadEnv(), /https/);

  process.env.BLUENTE_API_BASE_URL = "https://api.bluente.com/api/20250924";
  assert.equal(loadEnv().apiBaseUrl, "https://api.bluente.com/api/20250924");
});

test.after(() => {
  if (originalEnv.BLUENTE_API_KEY === undefined) delete process.env.BLUENTE_API_KEY;
  else process.env.BLUENTE_API_KEY = originalEnv.BLUENTE_API_KEY;

  if (originalEnv.BLUENTE_API_BASE_URL === undefined) delete process.env.BLUENTE_API_BASE_URL;
  else process.env.BLUENTE_API_BASE_URL = originalEnv.BLUENTE_API_BASE_URL;

  if (originalEnv.BLUENTE_API_TIMEOUT_MS === undefined) delete process.env.BLUENTE_API_TIMEOUT_MS;
  else process.env.BLUENTE_API_TIMEOUT_MS = originalEnv.BLUENTE_API_TIMEOUT_MS;
});
