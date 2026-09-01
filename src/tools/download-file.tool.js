import { executeTool } from "../lib/mcp-result.js";
import { downloadFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_download_file";

export function registerDownloadFileTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        "Download the translated document (the translation result file) once the task status is READY. Use to_type=pdf, word, or pptx. The file is saved to output_path (default: BLUENTE_OUTPUT_DIR, else ~/Downloads/bluente; an existing file is never overwritten) and the result reports where; set include_file_content=true to also receive base64 content, which is refused over 2MB.",
      inputSchema: downloadFileSchema
    },
    async ({ id, to_type: toType, output_path: outputPath, include_file_content: includeFileContent }) =>
      executeTool(TOOL_NAME, async () =>
        client.downloadFile({ id, toType, outputPath, includeFileContent })
      )
  );
}
