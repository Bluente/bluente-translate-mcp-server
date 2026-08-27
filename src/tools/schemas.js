import { z } from "zod";

export const engineSchema = z.enum(["GTC", "LLM", "PPE"]).default("LLM");
export const binaryFlagSchema = z.number().int().min(0).max(1);

const LANGUAGE_CODE_DESCRIPTION =
  "Bluente language code, e.g. en, zh (Simplified Chinese), cht (Traditional Chinese), jp (Japanese), kor (Korean), fra (French), spa (Spanish), de (German). Common ISO codes like zh-CN/ja/ko/fr/es are auto-aliased. For other languages call bluente_get_supported_languages.";

// The API's bilingual flag is binary; line/paragraph are legacy aliases for on.
export const bilingualSchema = z
  .enum(["on", "off", "none", "line", "paragraph"])
  .default("off")
  .describe(
    "Bilingual output: 'on' keeps the original text alongside the translation, 'off' (default) produces a clean translated document. ('none' means off; 'line'/'paragraph' are legacy aliases for on.)"
  );

export const pageRangeSchema = z
  .string()
  .regex(/^[ \t]*\d+([ \t]*-[ \t]*\d+)?([ \t]*,[ \t]*\d+([ \t]*-[ \t]*\d+)?)*[ \t]*$/, "e.g. 1-3,5")
  .optional()
  .describe(
    "Pages to translate, e.g. '1-3,5'. Defaults to the whole document. Credits are charged only for the selected pages; the backend validates the range against the document's page count at start."
  );

export const modeSchema = z
  .enum(["standard", "scanned (text)", "scanned (overlay)", "image"])
  .optional()
  .describe(
    "Document mode. 'standard' — normal digital documents (e.g. exported from Word or PowerPoint); this fits most files. 'scanned (text)' — the document is a scan: OCR the text, translate it, and put it in a NEW document without the original's non-text elements. 'scanned (overlay)' — the document is a scan: OCR the text, translate it, and place it back over the original layout, keeping the original elements. 'image' — image generation that re-renders a graphic (brochure, poster) in the target language while preserving its visual style, colours, and layout; not for translating text out of an image. Costs more per page."
  );

export const uploadFileSchema = {
  file_path: z.string().min(1).describe("Absolute or relative path to source file."),
  engine: engineSchema.describe("Translation engine option."),
  glossary: binaryFlagSchema.default(0).describe("Enable glossary matching: 0 or 1.")
};

export const getStatusSchema = {
  id: z.string().min(1).describe("Task id returned by upload endpoint."),
  entry: z.enum(["pdf", "word"]).default("pdf")
};

export const translateFileSchema = {
  id: z.string().min(1),
  action: z.enum(["start", "cancel"]).default("start"),
  from: z.string().min(2).optional().describe(LANGUAGE_CODE_DESCRIPTION),
  to: z.string().min(2).optional().describe(LANGUAGE_CODE_DESCRIPTION),
  engine: engineSchema,
  glossary: binaryFlagSchema
    .default(0)
    .describe("Glossary flag. The backend applies the glossary only when BOTH glossary and custom_glossary are 1."),
  custom_glossary: binaryFlagSchema
    .default(0)
    .describe("Custom glossary flag. Set together with glossary; either alone has no effect."),
  bilingual: bilingualSchema,
  vertical_bilingual: binaryFlagSchema.default(0),
  mode: modeSchema,
  scanned: z
    .number()
    .int()
    .min(0)
    .max(3)
    .optional()
    .describe("Deprecated numeric alias for mode (scanned_option 0-3); prefer mode."),
  page_range: pageRangeSchema,
  namespace: z.string().optional(),
  metadata: z.record(z.any()).optional()
};

export const downloadFileSchema = {
  id: z.string().min(1),
  to_type: z.enum(["pdf", "docx", "xlsx"]).default("docx"),
  output_path: z.string().optional()
};

export const documentWorkflowSchema = {
  file_path: z.string().min(1),
  from: z.string().min(2).describe(LANGUAGE_CODE_DESCRIPTION),
  to: z.string().min(2).describe(LANGUAGE_CODE_DESCRIPTION),
  to_type: z.enum(["pdf", "docx", "xlsx"]).default("docx"),
  engine: engineSchema,
  glossary: binaryFlagSchema.optional().describe("Deprecated and ignored; glossary is always on."),
  custom_glossary: binaryFlagSchema
    .optional()
    .describe("Deprecated and ignored; glossary is always on."),
  bilingual: bilingualSchema,
  vertical_bilingual: binaryFlagSchema.default(0),
  mode: modeSchema,
  scanned: z
    .number()
    .int()
    .min(0)
    .max(3)
    .optional()
    .describe("Deprecated numeric alias for mode (scanned_option 0-3); prefer mode."),
  page_range: pageRangeSchema,
  namespace: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  poll_interval_ms: z.number().int().min(500).max(60_000).default(3_000),
  max_poll_attempts: z.number().int().min(1).max(2_000).default(120),
  auto_download: z.boolean().default(true),
  status_entry: z.enum(["pdf", "word"]).default("pdf"),
  output_path: z.string().optional()
};
