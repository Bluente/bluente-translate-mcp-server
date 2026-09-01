export const DEFAULT_API_BASE_URL = "https://api.bluente.com/api/20250924";

export const API_PATHS = {
  SUPPORTED_LANGUAGES: "/blu_translate/supported_languages",
  UPLOAD_FILE: "/blu_translate/upload",
  GET_TRANSLATION_STATUS: "/blu_translate/check",
  TRANSLATE_FILE: "/blu_translate/translate",
  DOWNLOAD_FILE: "/blu_translate/download"
};

// The upload has to finish server-side processing (page count, text extraction)
// before a translation can start; that phase has its own terminal statuses.
export const PRE_TRANSLATION_TERMINAL_STATUSES = new Set(["SERVICE_PROCESSED", "ERROR"]);
export const TERMINAL_TRANSLATION_STATUSES = new Set(["READY", "ERROR"]);

export const DEFAULT_POLL_INTERVAL_MS = 3_000;
export const DEFAULT_MAX_POLL_ATTEMPTS = 100;
