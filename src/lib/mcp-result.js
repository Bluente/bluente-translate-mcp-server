import { normalizeError } from "./errors.js";

export function toMcpJson(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export function toMcpError(error, toolName) {
  const normalized = normalizeError(error);

  return {
    isError: true,
    ...toMcpJson({
      ok: false,
      tool: toolName,
      error: normalized
    })
  };
}

export async function executeTool(toolName, operation) {
  try {
    const data = await operation();
    return toMcpJson({ ok: true, tool: toolName, data });
  } catch (error) {
    return toMcpError(error, toolName);
  }
}
