import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, makePaymentReference, makeSupporterCode, readJson, safeSourceKey, watchPartyConfig } from "@/lib/watchparty";

export const Route = createFileRoute("/api/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = await readJson(request);
        const full_name = String(data.full_name || "").trim();
        const mobile = String(data.mobile || "").trim();
        const email = String(data.email || "").trim().toLowerCase();
        const province = String(data.province || "").trim();
        const source_key = safeSourceKey(data.source_key);
        const cfg = watchPartyConfig(source_key);
        const source_location = String(data.source_location || cfg.location).trim().slice(0, 80);
        const watch_party_venue = String(data.watch_party_venue || cfg.venue).trim().slice(0, 120);
        if (!full_name || !mobile || !email.includes("@")) {
          return jsonResponse({ error: "name, mobile, and valid email are required" }, { status: 400 });
        }
        const created_at = new Date().toISOString();
        const supporter_code = makeSupporterCode(source_key);
        const payment_reference = makePaymentReference(source_key);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("audit_logs").insert({
          action_type: "watchparty_signup",
          actor_role: "public",
          target_type: "watchparty",
          target_id: supporter_code,
          metadata: {
            source_key,
            source_location,
            watch_party_venue,
            full_name,
            email,
            mobile,
            province,
            supporter_code,
            payment_reference,
            consent_to_contact: Boolean(data.consent_to_contact),
            disclosure_acknowledged: Boolean(data.disclosure_acknowledged),
            provider: data.provider || "manual_eft",
            requested_gateway: data.requested_gateway || null,
            created_at,
          },
        });
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({
          supporter_code,
          membership_tier: "founding_member",
          membership_status: "Link Sent",
          instructions: {
            provider: "manual_eft",
            payment_method: "eft",
            amount_zar: Number(process.env.SAFC_FOUNDING_FEE_ZAR || 899),
            payment_reference,
            message: "Use this reference exactly when paying. This founder-window MVP uses a manual EFT collection workflow while formal merchant onboarding is being finalized.",
            account_name: process.env.SAFC_COLLECTION_ACCOUNT_NAME || "Founder Collection Account",
            bank_name: process.env.SAFC_COLLECTION_BANK_NAME || "Configure SAFC_COLLECTION_BANK_NAME",
            account_mask: process.env.SAFC_COLLECTION_ACCOUNT_MASK || "Configure SAFC_COLLECTION_ACCOUNT_MASK",
            payment_note: process.env.SAFC_COLLECTION_PAYMENT_NOTE || "Collections may temporarily settle under founder details pending company merchant onboarding.",
          },
          source_key,
          source_location,
          watch_party_venue,
        });
      },
    },
  },
});
