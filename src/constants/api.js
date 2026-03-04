export const DEFAULT_API_BASE_URL = "https://api.bluente.com/api/20250924";

export const API_PATHS = {
  SUPPORTED_LANGUAGES: "/blu_translate/supported_languages",
  UPLOAD_FILE: "/blu_translate/upload_file",
  GET_TRANSLATION_STATUS: "/blu_translate/get_translation_status",
  TRANSLATE_FILE: "/blu_translate/translate_file",
  DOWNLOAD_FILE: "/blu_translate/download_file"
};

export const TERMINAL_TRANSLATION_STATUSES = new Set(["READY", "ERROR"]);
