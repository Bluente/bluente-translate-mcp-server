import { executeTool } from "../lib/mcp-result.js";
import { uploadFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_upload_file";

export function registerUploadFileTool(server, { client }) {
  server.tool(
    TOOL_NAME,
    "Upload a source document to Bluente and get a translation task id.",
    uploadFileSchema,
    async ({ file_path: filePath, engine, glossary }) =>
      executeTool(TOOL_NAME, async () => client.uploadFile({ filePath, engine, glossary }))
  );
}
