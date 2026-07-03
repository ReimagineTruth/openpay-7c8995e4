import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getWalletBalance from "./tools/get-wallet-balance";
import listTransactions from "./tools/list-transactions";
import getProfile from "./tools/get-profile";
import sendMoney from "./tools/send-money";

// Build the OAuth issuer from the Supabase project ref (not SUPABASE_URL, which
// may be a .lovable.cloud proxy). Vite inlines this literal at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "openpay-mcp",
  title: "OpenPay",
  version: "0.1.0",
  instructions:
    "OpenPay wallet tools for the signed-in user. Use `get_profile` and `get_wallet_balance` for read-only lookups, `list_transactions` to review recent activity, and `send_money` to transfer funds to another @username (always confirm amount and recipient with the user before sending).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, getWalletBalance, listTransactions, sendMoney],
});
