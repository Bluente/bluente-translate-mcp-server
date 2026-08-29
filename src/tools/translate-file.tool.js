import { executeTool } from "../lib/mcp-result.js";
import { BluenteApiError } from "../lib/errors.js";
import { translateFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_translate_file";

export function registerTranslateFileTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        "Start or cancel translation for an uploaded file. Starts immediately with no confirmation step; for user-facing flows prefer bluente_translate_document_workflow, which shows the page count and settings for the user to confirm first.",
      inputSchema: translateFileSchema
    },
    async (args) =>
      executeTool(TOOL_NAME, async () => {
        if (args.action === "start" && (!args.from || !args.to)) {
          throw new BluenteApiError("Fields 'from' and 'to' are required when action is 'start'.");
        }

        return client.translateFile({
          id: args.id,
          action: args.action,
          from: args.from,
          to: args.to,
          engine: args.engine,
          glossary: args.glossary,
          customGlossary: args.custom_glossary,
          bilingual: args.bilingual,
          bilingualLayout: args.bilingual_layout,
          verticalBilingual: args.vertical_bilingual,
          scanned: args.scanned,
          pageRange: args.page_range,
          namespace: args.namespace,
          metadata: args.metadata
        });
      })
  );
}
