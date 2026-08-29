import { normalizeError } from "./errors.js";

export function toMcpJson(payload) {
  // A render_to_user string on the data becomes its own leading text content
  // item (MCP results may carry several). Hosts and models surface a plain
  // text item far more reliably than a field buried inside the JSON blob,
  // which is what lets the confirmation card reach the user verbatim.
  const renderToUser = payload?.data?.render_to_user;
  const content = [];

  if (typeof renderToUser === "string" && renderToUser.length > 0) {
    content.push({ type: "text", text: renderToUser });
  }

  content.push({
    type: "text",
    text: JSON.stringify(payload, null, 2)
  });

  return { content };
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
