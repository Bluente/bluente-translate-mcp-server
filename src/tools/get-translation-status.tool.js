import { clipBackendText } from "../clients/bluente-http-client.js";
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
        // Free-text fields on the status payload are backend-authored (and, for
        // OCR/translation errors, can quote the document): clip them in place.
        for (const holder of [result, result?.data]) {
          for (const key of ["message", "message_json"]) {
            if (typeof holder?.[key] === "string") holder[key] = clipBackendText(holder[key]);
          }
        }
        if (result?.data?.status === "READY") {
          result.next_steps =
            "Translation is complete. Call bluente_download_file with this id and the desired to_type.";
        }

        return result;
      })
  );
}
