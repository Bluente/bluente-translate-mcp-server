import { executeTool } from "../lib/mcp-result.js";
import { downloadFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_download_file";

export function registerDownloadFileTool(server, { client }) {
  server.tool(
    TOOL_NAME,
    "Download the translated file once the task status is READY.",
    downloadFileSchema,
    async ({ id, to_type: toType, output_path: outputPath }) =>
      executeTool(TOOL_NAME, async () => client.downloadFile({ id, toType, outputPath }))
  );
}
