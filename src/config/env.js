import { DEFAULT_API_BASE_URL } from "../constants/api.js";

const DEFAULT_TIMEOUT_MS = 90_000;

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

export function loadEnv() {
  const apiKey = process.env.BLUENTE_API_KEY;
  const apiBaseUrl = (process.env.BLUENTE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

  if (!apiKey) {
    throw new Error("Missing BLUENTE_API_KEY. Please configure it in your environment.");
  }

  return {
    apiKey,
    apiBaseUrl,
    timeoutMs: parseTimeoutMs(process.env.BLUENTE_API_TIMEOUT_MS)
  };
}
