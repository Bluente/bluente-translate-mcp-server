import { executeTool } from "../lib/mcp-result.js";
import { resolveToolFileSource } from "../lib/file-source.js";
import { OPENAI_FILE_PARAMS_META, uploadFileSchema } from "./schemas.js";

const TOOL_NAME = "bluente_upload_file";

export function registerUploadFileTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        "Upload a source document and get a translation task id. Pass file_path for a file on this machine, or file_url for a publicly accessible link.",
      inputSchema: uploadFileSchema,
      _meta: OPENAI_FILE_PARAMS_META
    },
    async (args) =>
      executeTool(TOOL_NAME, async () => {
        const { fileUrl, filePath, fileBuffer, fileName } = resolveToolFileSource(args);
        return client.uploadFile({
          fileUrl,
          filePath,
          fileBuffer,
          fileName,
          engine: args.engine,
          glossary: args.glossary
        });
      })
  );
}
