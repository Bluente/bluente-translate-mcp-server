import { z } from "zod";
import { DEFAULT_MAX_POLL_ATTEMPTS, DEFAULT_POLL_INTERVAL_MS } from "../constants/api.js";

export const engineSchema = z.number().int().default(3).describe("Translation engine code. Use 3.");
export const binaryFlagSchema = z.number().int().min(0).max(1);

const LANGUAGE_CODE_DESCRIPTION =
  "Bluente language code, e.g. en, zh (Simplified Chinese), cht (Traditional Chinese), jp (Japanese), kor (Korean), fra (French), spa (Spanish), de (German). Common ISO codes like zh-CN/ja/ko/fr/es are auto-aliased. For other languages call bluente_get_supported_languages.";

// Shape mandated by OpenAI's file-input spec: all four properties must be declared,
// with download_url and file_id required. Kept in step with the hosted server so a
// host that supplies attachments works against either.
const fileObjectSchema = z.object({
  download_url: z.string().describe("Platform-provided URL for downloading the attached source file."),
  file_id: z.string(),
  mime_type: z.string().optional(),
  file_name: z.string().optional()
});

// Names the top-level fields a host should populate from a user's attachment.
export const OPENAI_FILE_PARAMS_META = { "openai/fileParams": ["file_to_translate"] };

// This server runs on the user's own machine, so unlike the hosted one it always
// offers a local path as a file source.
const filePathSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Path to a file on the machine running this MCP server. Use instead of file_url.");

const includeFileContentSchema = z
  .boolean()
  .default(false)
  .describe("Also return the file bytes as base64 in the result. Files over 2MB are refused.");

const fileContentBase64Schema = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Last resort for very small files only (max 2MB decoded): the raw file bytes as base64. Prefer file_path, file_to_translate, or file_url."
  );

const fileSourceSchema = {
  file_path: filePathSchema,
  file_to_translate: fileObjectSchema.optional(),
  file_url: z.string().url().optional().describe("Publicly accessible source file URL."),
  file_content_base64: fileContentBase64Schema
};

export const bilingualLayoutSchema = z
  .enum(["left-right", "top-down"])
  .optional()
  .describe(
    "Bilingual page layout. Bluente supports EXACTLY two layouts and no others. When bilingual is on you must ask the user to pick one and pass it verbatim: 'left-right' = the original and the translation side by side in two columns; 'top-down' = the translation placed directly under the original. Do NOT offer, invent, rephrase, or accept any other arrangement — line-by-line and paragraph-by-paragraph are NOT options and must never be presented to the user."
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
    "Document mode. 'standard' — normal digital documents (e.g. exported from Word or PowerPoint); this fits most files. 'scanned (text)' — the document is a scan: OCR the text, translate it, and put it in a NEW document without the original's non-text elements. 'scanned (overlay)' — the document is a scan: OCR the text, translate it, and place it back over the original layout, keeping the original elements. 'image' — image generation that re-renders a graphic (brochure, poster) in the target language while preserving its visual style, colours, and layout; not for translating text out of an image. Image mode is the only mode charged above the standard rate: 5 credits per page. Both scanned modes cost the same 1 credit per page as standard. If you cannot tell whether the file is digital or scanned and cannot inspect it, ask the user rather than defaulting; the confirmation card will show Mode as a decision, not a default."
  );

export const toTypeSchema = z.enum(["pdf", "word", "pptx"]);

export const uploadFileSchema = {
  ...fileSourceSchema,
  file_name: z.string().optional().describe("Optional file name override used on upload."),
  engine: engineSchema,
  glossary: binaryFlagSchema.default(0).describe("Enable glossary matching: 0 or 1.")
};

export const getStatusSchema = {
  id: z.string().min(1).describe("Task id returned by upload endpoint."),
  entry: z.enum(["get_page_count", "get_status"]).default("get_status")
};

// Cancel only. Starting is deliberately not offered here: it deducts credits
// and must go through the workflow tool's confirmation gate.
export const translateFileSchema = {
  id: z.string().min(1).describe("Task id to cancel."),
  action: z.enum(["cancel"]).default("cancel")
};

export const downloadFileSchema = {
  id: z.string().min(1),
  to_type: toTypeSchema.default("word"),
  output_path: z
    .string()
    .optional()
    .describe("Where to save the file on this machine. Defaults to the returned file name under BLUENTE_OUTPUT_DIR, else ~/Downloads/bluente. An existing file is never overwritten."),
  include_file_content: includeFileContentSchema
};

export const documentWorkflowSchema = {
  ...fileSourceSchema,
  task_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Task id returned by a prior unconfirmed call to this tool (or by bluente_upload_file). When set, the upload step is skipped and no file source is needed."
    ),
  file_name: z.string().optional(),
  from: z.string().min(2).describe(LANGUAGE_CODE_DESCRIPTION),
  to: z
    .string()
    .min(2)
    .describe(`Target language. Ask the user; do not assume. ${LANGUAGE_CODE_DESCRIPTION}`),
  // to_type, glossary, and bilingual deliberately have no defaults here: the confirm
  // gate must be able to tell "user chose the default" from "model never asked".
  to_type: z
    .union([toTypeSchema, z.array(toTypeSchema).min(1)])
    .optional()
    .describe(
      "Output format, or an array of formats to receive several at once (formats are download-time conversions of the same finished translation — no extra translation or credits). Ask the user; required when confirmed=true. Also used when auto_download is true."
    ),
  engine: engineSchema,
  glossary: binaryFlagSchema.optional().describe("Deprecated and ignored; glossary is always on."),
  custom_glossary: binaryFlagSchema
    .optional()
    .describe("Deprecated and ignored; glossary is always on."),
  bilingual: z
    .enum(["on", "off", "none"])
    .optional()
    .describe(
      "Bilingual output: 'on' keeps the original text alongside the translation, 'off' (or 'none') produces a clean translated document. When 'on', also set bilingual_layout (left-right or top-down) — ask the user which. Ask the user; required when confirmed=true."
    ),
  bilingual_layout: bilingualLayoutSchema.describe(
    `${bilingualLayoutSchema.description} When you ask the user, present only these two choices, labelled Left-Right (side by side) and Top-Down (stacked). Required when confirmed=true and bilingual is on; ignored when bilingual is off.`
  ),
  vertical_bilingual: binaryFlagSchema
    .optional()
    .describe(
      "Deprecated numeric alias for bilingual_layout: 0 left-right, 1 top-down. bilingual_layout wins when both are given."
    ),
  page_range: pageRangeSchema,
  mode: modeSchema,
  scanned: z
    .number()
    .int()
    .min(0)
    .max(3)
    .optional()
    .describe("Deprecated numeric alias for mode (0-3); prefer mode."),
  confirmed: z
    .boolean()
    .default(false)
    .describe(
      "Set true only after the user has seen the confirmation card returned by a first call and replied confirming it. Requires task_id, confirm_token, and the same settings the card showed. While false (the default) the call stops after returning the card: nothing starts and no credits are deducted."
    ),
  confirm_token: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The confirm_token returned by the unconfirmed call whose card the user confirmed. Required when confirmed=true; single-use; refused for 20 seconds after the card was issued and after 15 minutes."
    ),
  namespace: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  poll_interval_ms: z.number().int().min(2_000).max(60_000).default(DEFAULT_POLL_INTERVAL_MS),
  max_poll_attempts: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(DEFAULT_MAX_POLL_ATTEMPTS)
    .describe("Total status polls allowed across both the upload and translation phases (max 100, at least 2 s apart)."),
  auto_download: z
    .boolean()
    .default(false)
    .describe(
      "Set to true to block until translation finishes and save the file to disk. Only safe for small documents: translation often takes minutes and the host may time out the request first. Defaults to false, which returns as soon as translation starts."
    ),
  output_path: z
    .string()
    .optional()
    .describe("Where to save the file when auto_download is true. Defaults to BLUENTE_OUTPUT_DIR, else ~/Downloads/bluente. An existing file is never overwritten."),
  status_entry: z.enum(["get_page_count", "get_status"]).default("get_status")
};
