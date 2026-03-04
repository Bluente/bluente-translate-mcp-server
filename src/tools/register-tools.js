import { registerGetSupportedLanguagesTool } from "./get-supported-languages.tool.js";
import { registerUploadFileTool } from "./upload-file.tool.js";
import { registerGetTranslationStatusTool } from "./get-translation-status.tool.js";
import { registerTranslateFileTool } from "./translate-file.tool.js";
import { registerDownloadFileTool } from "./download-file.tool.js";
import { registerTranslateDocumentWorkflowTool } from "./translate-document-workflow.tool.js";

export function registerTools(server, dependencies) {
  registerGetSupportedLanguagesTool(server, dependencies);
  registerUploadFileTool(server, dependencies);
  registerGetTranslationStatusTool(server, dependencies);
  registerTranslateFileTool(server, dependencies);
  registerDownloadFileTool(server, dependencies);
  registerTranslateDocumentWorkflowTool(server, dependencies);
}
