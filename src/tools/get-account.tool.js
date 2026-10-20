import { executeTool } from "../lib/mcp-result.js";

const TOOL_NAME = "bluente_get_account";

const DESCRIPTION =
  "Get the signed-in Bluente user's account: email, name, organisation (name and role, or null), and credits per feature (translate always; transcribe and rewrite only when they have a balance). Use this whenever the user asks who they are signed in as, which organisation they belong to, how many credits they have, or when their credits expire. For each feature, say who pays: paid_by 'organization' means the organisation's shared pool (name the organisation), 'personal' means the user's own credits. Lead with the soonest expiry and its amount (expiries[0]), then the rest, e.g. '50 expire on 31 Oct 2026; the other 1,150 last until 1 Mar 2027'. Expiry times are UTC; convert them when you know the user's timezone. Read-only: never changes credits.";

export function registerGetAccountTool(server, { client }) {
  server.registerTool(
    TOOL_NAME,
    {
      description: DESCRIPTION,
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    async () =>
      executeTool(TOOL_NAME, async () => {
        const payload = await client.getAccount();
        return payload.data;
      })
  );
}
