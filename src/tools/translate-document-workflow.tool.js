import { executeTool } from "../lib/mcp-result.js";
import { documentWorkflowSchema } from "./schemas.js";

const TOOL_NAME = "bluente_translate_document_workflow";

const MODE_GUIDANCE =
  "Pick mode from the document; most files are 'standard' (normal digital documents exported from Word/PowerPoint). Detect the two exceptions rather than defaulting: (1) A scanned/photographed document — a PDF whose pages are images of text, with little or no selectable text layer. This server runs on the user's machine, so read the file and check for an extractable text layer; a PDF that yields little or no text is almost certainly scanned. When it is a scan, ASK the user which they want: 'scanned (text)' rebuilds a clean text-only document (drops the original's non-text elements), 'scanned (overlay)' keeps the original layout and places the translation back in place. Do not guess between these two. (2) A graphic whose visual design must be preserved — a brochure or poster where the goal is to re-render the image in the target language keeping its style, colours, and layout — is 'image' (image generation, not OCR; costs more per page). A scan run as standard translates blank pages and wastes credits.";

export function registerTranslateDocumentWorkflowTool(server, { workflowService }) {
  server.tool(
    TOOL_NAME,
    `Run end-to-end translation: upload, start, poll until READY, and optionally download. Starting a translation deducts Bluente credits (charged per page). ${MODE_GUIDANCE}`,
    documentWorkflowSchema,
    async (args) =>
      executeTool(TOOL_NAME, async () =>
        workflowService.runDocumentWorkflow({
          filePath: args.file_path,
          from: args.from,
          to: args.to,
          toType: args.to_type,
          engine: args.engine,
          bilingual: args.bilingual,
          verticalBilingual: args.vertical_bilingual,
          // The deprecated numeric scanned is only honoured when mode is absent.
          scanned: args.mode ?? args.scanned,
          pageRange: args.page_range,
          namespace: args.namespace,
          metadata: args.metadata,
          pollIntervalMs: args.poll_interval_ms,
          maxPollAttempts: args.max_poll_attempts,
          autoDownload: args.auto_download,
          statusEntry: args.status_entry,
          outputPath: args.output_path
        })
      )
  );
}
