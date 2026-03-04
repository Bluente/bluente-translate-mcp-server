import { executeTool } from "../lib/mcp-result.js";
import { documentWorkflowSchema } from "./schemas.js";

const TOOL_NAME = "bluente_translate_document_workflow";

export function registerTranslateDocumentWorkflowTool(server, { workflowService }) {
  server.tool(
    TOOL_NAME,
    "Run end-to-end translation: upload, start, poll until READY, and optionally download.",
    documentWorkflowSchema,
    async (args) =>
      executeTool(TOOL_NAME, async () =>
        workflowService.runDocumentWorkflow({
          filePath: args.file_path,
          from: args.from,
          to: args.to,
          toType: args.to_type,
          engine: args.engine,
          glossary: args.glossary,
          customGlossary: args.custom_glossary,
          bilingual: args.bilingual,
          verticalBilingual: args.vertical_bilingual,
          scanned: args.scanned,
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
