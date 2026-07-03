import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "send_money",
  title: "Send money to an OpenPay user",
  description:
    "Send funds from the signed-in user's OpenPay wallet to another user by their @username. Requires the sender's MPIN handled elsewhere in the app; the model must confirm with the user before invoking.",
  inputSchema: {
    recipient_username: z.string().min(3).describe("Recipient's OpenPay @username (without @)."),
    amount: z.number().positive().describe("Amount to send in the sender's wallet currency."),
    note: z.string().max(200).optional().describe("Optional note for the recipient."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  needsApproval: true,
  handler: async ({ recipient_username, amount, note }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.functions.invoke("send-money", {
      body: { recipient_username, amount, note: note ?? "" },
      headers: { Authorization: `Bearer ${ctx.getToken()}` },
    });
    if (error) {
      return { content: [{ type: "text", text: error.message ?? "send-money failed" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { result: data },
    };
  },
});
