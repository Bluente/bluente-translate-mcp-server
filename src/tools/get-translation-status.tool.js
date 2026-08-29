import { executeTool } from "../lib/mcp-result.js";
import { getStatusSchema } from "./schemas.js";

const TOOL_NAME = "bluente_get_translation_status";

export function registerGetTranslationStatusTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        "Query a task by id using Bluente's check API. Use entry=get_status to poll processing or translation progress, or entry=get_page_count to read the uploaded file's page count.",
      inputSchema: getStatusSchema
    },
    async ({ id, entry }) =>
      executeTool(TOOL_NAME, async () => {
        const result = await client.getTranslationStatus({ id, entry });
        if (result?.data?.status === "READY") {
          result.next_steps =
            "Translation is complete. Call bluente_download_file with this id and the desired to_type.";
        }

        return result;
      })
  );
}
