import { DEFAULT_API_BASE_URL } from "../constants/api.js";

const DEFAULT_TIMEOUT_MS = 90_000;
const TRUSTED_HOST = /(^|\.)bluente\.(com|cn)$/i;

function parseTimeoutMs(rawValue) {
  if (!rawValue) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

// The API key rides as a bearer token to whatever this points at, so it must be
// https and, when it is not Bluente, the operator is told about it at startup.
function parseApiBaseUrl(rawValue) {
  const value = (rawValue || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid BLUENTE_API_BASE_URL: "${rawValue}" is not a URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`Invalid BLUENTE_API_BASE_URL: must use https://, got "${url.protocol}//".`);
  }

  if (!TRUSTED_HOST.test(url.hostname)) {
    console.error(
      `[bluente-translate-mcp-server] Warning: BLUENTE_API_BASE_URL host "${url.hostname}" is not a bluente.com domain; your API key will be sent there.`
    );
  }

  return value;
}

export function loadEnv() {
  const apiKey = process.env.BLUENTE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing BLUENTE_API_KEY. Please configure it in your environment.");
  }

  return {
    apiKey,
    apiBaseUrl: parseApiBaseUrl(process.env.BLUENTE_API_BASE_URL),
    timeoutMs: parseTimeoutMs(process.env.BLUENTE_API_TIMEOUT_MS)
  };
}
