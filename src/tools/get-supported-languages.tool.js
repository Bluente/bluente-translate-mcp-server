import { executeTool } from "../lib/mcp-result.js";

const TOOL_NAME = "bluente_get_supported_languages";

export function registerGetSupportedLanguagesTool(server, { client }) {
  server.tool(
    TOOL_NAME,
    "List all language pairs currently supported by the Bluente translation platform.",
    {},
    async () => executeTool(TOOL_NAME, async () => client.getSupportedLanguages())
  );
}
