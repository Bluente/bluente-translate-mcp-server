import { z } from "zod";

export const engineSchema = z.enum(["GTC", "LLM", "PPE"]).default("LLM");
export const binaryFlagSchema = z.number().int().min(0).max(1);

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
  from: z.string().min(2).optional(),
  to: z.string().min(2).optional(),
  engine: engineSchema,
  glossary: binaryFlagSchema.default(0),
  custom_glossary: binaryFlagSchema.default(0),
  bilingual: z.enum(["line", "paragraph", "none"]).default("line"),
  vertical_bilingual: binaryFlagSchema.default(0),
  scanned: binaryFlagSchema.default(0),
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
  from: z.string().min(2),
  to: z.string().min(2),
  to_type: z.enum(["pdf", "docx", "xlsx"]).default("docx"),
  engine: engineSchema,
  glossary: binaryFlagSchema.default(0),
  custom_glossary: binaryFlagSchema.default(0),
  bilingual: z.enum(["line", "paragraph", "none"]).default("line"),
  vertical_bilingual: binaryFlagSchema.default(0),
  scanned: binaryFlagSchema.default(0),
  namespace: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  poll_interval_ms: z.number().int().min(500).max(60_000).default(3_000),
  max_poll_attempts: z.number().int().min(1).max(2_000).default(120),
  auto_download: z.boolean().default(true),
  status_entry: z.enum(["pdf", "word"]).default("pdf"),
  output_path: z.string().optional()
};
