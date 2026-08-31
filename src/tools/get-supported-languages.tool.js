import { executeTool } from "../lib/mcp-result.js";

const TOOL_NAME = "bluente_get_supported_languages";

// The backend returns ~130 verbose DB records (timestamps, flags, ids); only
// the language code and display name matter to a model. Entries without the
// expected shape pass through untouched rather than losing data.
export function trimLanguageRecord(entry) {
  if (!entry || typeof entry !== "object" || !entry.svcCode) {
    return entry;
  }
  return { code: entry.svcCode, name: entry.name || entry.language };
}

export function registerGetSupportedLanguagesTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description: "List all language pairs currently supported by the Bluente translation platform.",
      inputSchema: {}
    },
    async () =>
      executeTool(TOOL_NAME, async () => {
        const payload = await client.getSupportedLanguages();
        if (!Array.isArray(payload?.data)) {
          return payload;
        }
        return { ...payload, data: payload.data.map(trimLanguageRecord) };
      })
  );
}
