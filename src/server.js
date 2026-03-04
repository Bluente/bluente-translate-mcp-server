import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BluenteHttpClient } from "./clients/bluente-http-client.js";
import { loadEnv } from "./config/env.js";
import { TranslationWorkflowService } from "./services/translation-workflow-service.js";
import { registerTools } from "./tools/register-tools.js";

export function createServer() {
  const env = loadEnv();
  const client = new BluenteHttpClient({
    apiKey: env.apiKey,
    baseUrl: env.apiBaseUrl,
    timeoutMs: env.timeoutMs
  });

  const workflowService = new TranslationWorkflowService({ client });

  const server = new McpServer({
    name: "bluente-translate",
    version: "0.2.0"
  });

  registerTools(server, {
    client,
    workflowService
  });

  return server;
}
