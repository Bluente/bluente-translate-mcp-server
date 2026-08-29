import { executeTool } from "../lib/mcp-result.js";
import { resolveToolFileSource } from "../lib/file-source.js";
import { OPENAI_FILE_PARAMS_META, documentWorkflowSchema } from "./schemas.js";

const TOOL_NAME = "bluente_translate_document_workflow";

const SOURCE_GUIDANCE =
  "Translate a document. Pass file_path for a file on this machine, or file_url for a publicly accessible link.";

const MODE_GUIDANCE =
  "Pick mode from the document; most files are 'standard' (normal digital documents exported from Word/PowerPoint). Detect the two exceptions rather than defaulting: (1) A scanned/photographed document — a PDF whose pages are images of text, with little or no selectable text layer. This server runs on the user's machine, so read the file and check for an extractable text layer; a PDF that yields little or no text is almost certainly scanned. When it is a scan, ASK the user which they want: 'scanned (text)' rebuilds a clean text-only document (drops the original's non-text elements), 'scanned (overlay)' keeps the original layout and places the translation back in place. Do not guess between these two. (2) A graphic whose visual design must be preserved — a brochure or poster where the goal is to re-render the image in the target language keeping its style, colours, and layout — is 'image' (image generation, not OCR; costs more per page). If you cannot tell whether the file is digital or scanned and cannot inspect it, ask the user rather than defaulting; the confirmation card will show Mode as a decision, not a default. A scan run as standard translates blank pages and wastes credits.";

const CONFIRMATION_GUIDANCE =
  "Two-call flow: the first call uploads the file and returns page_count plus a confirmation card; nothing starts and no credits are deducted until confirmed=true. The result's render_to_user contains a fenced block you MUST paste to the user exactly as-is (never paraphrase, shorten, reorder, or omit lines — cost is based on pages and the user must see it), then ask them to confirm or adjust and WAIT for their reply. Never call with confirmed=true in the same turn or before the user has replied. Then call again with the returned task_id, confirmed=true, and explicit to, to_type, and bilingual values. When bilingual is on you MUST also ask the user which layout they want — offer EXACTLY two options and no others: Left-Right (original and translation side by side) or Top-Down (translation stacked under the original) — and pass it as bilingual_layout. Never offer or invent other arrangements such as line-by-line or paragraph-by-paragraph; those are not supported. A confirmed bilingual-on call without bilingual_layout is rejected. When bilingual is off, bilingual_layout is not needed. to_type may be one format or an array of formats (e.g. [\"pptx\", \"pdf\"]) — formats are download-time conversions of the same translation and cost nothing extra.";

const BEHAVIOUR_GUIDANCE =
  "Once confirmed, this returns as soon as translation starts; follow the next_steps in the result to poll bluente_get_translation_status and then call bluente_download_file. Pass auto_download=true only for small documents to wait for the result inline and save it to disk, which can block for several minutes and may exceed the host's request timeout.";

export function registerTranslateDocumentWorkflowTool(server, { workflowService }) {
  server.registerTool(
    TOOL_NAME,
    {
      description: `${SOURCE_GUIDANCE} ${MODE_GUIDANCE} ${CONFIRMATION_GUIDANCE} ${BEHAVIOUR_GUIDANCE}`,
      inputSchema: documentWorkflowSchema,
      _meta: OPENAI_FILE_PARAMS_META
    },
    async (args) =>
      executeTool(TOOL_NAME, async () => {
        // task_id means the file was already uploaded by a prior unconfirmed
        // call; requiring a file source anyway would dead-end the confirm flow.
        const { fileUrl, filePath, fileBuffer, fileName } = args.task_id
          ? { fileName: args.file_name }
          : resolveToolFileSource(args);

        return workflowService.runDocumentWorkflow({
          taskId: args.task_id,
          fileUrl,
          filePath,
          fileBuffer,
          fileName,
          from: args.from,
          to: args.to,
          toType: args.to_type,
          engine: args.engine,
          bilingual: args.bilingual,
          bilingualLayout: args.bilingual_layout,
          verticalBilingual: args.vertical_bilingual,
          // mode is schema-optional with NO default: undefined must reach the
          // service so the confirmation card can render Mode as a decision (an
          // ask line) instead of a settled "Standard" — the same
          // explicit-vs-defaulted distinction to/to_type/bilingual rely on.
          // The deprecated numeric scanned still wins for stale sessions, and
          // the wire default to standard lives in the client's toScannedParam.
          scanned: args.mode ?? args.scanned,
          pageRange: args.page_range,
          namespace: args.namespace,
          metadata: args.metadata,
          pollIntervalMs: args.poll_interval_ms,
          maxPollAttempts: args.max_poll_attempts,
          autoDownload: args.auto_download,
          confirmed: args.confirmed,
          outputPath: args.output_path,
          statusEntry: args.status_entry
        });
      })
  );
}
