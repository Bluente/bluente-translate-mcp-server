import { executeTool } from "../lib/mcp-result.js";
import { translateFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_translate_file";

export function registerTranslateFileTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        "Cancel a translation task by id. This tool cannot start a translation: starting deducts credits and only happens through bluente_translate_document_workflow, after the user has confirmed the page count and settings.",
      inputSchema: translateFileSchema
    },
    async (args) =>
      executeTool(TOOL_NAME, async () => client.translateFile({ id: args.id, action: "cancel" }))
  );
}
