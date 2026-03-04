import { executeTool } from "../lib/mcp-result.js";
import { getStatusSchema } from "./schemas.js";

const TOOL_NAME = "bluente_get_translation_status";

export function registerGetTranslationStatusTool(server, { client }) {
  server.tool(
    TOOL_NAME,
    "Query a task status by id. Use this to poll progress after starting translation.",
    getStatusSchema,
    async ({ id, entry }) => executeTool(TOOL_NAME, async () => client.getTranslationStatus({ id, entry }))
  );
}
