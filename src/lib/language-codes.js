// Bluente's API takes iFlytek language codes (zh, cht, jp, kor, fra, spa...),
// but models habitually send ISO codes and get "target language zh-CN is not
// valid" back. Map the common ISO spellings; anything unknown passes through
// untouched so the backend stays the single validator.
const LANGUAGE_ALIASES = {
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-tw": "cht",
  "zh-hant": "cht",
  ja: "jp",
  ko: "kor",
  kr: "kor",
  fr: "fra",
  es: "spa"
};

export function normalizeLanguageCode(code) {
  if (typeof code !== "string") {
    return code;
  }
  return LANGUAGE_ALIASES[code.toLowerCase()] || code;
}
