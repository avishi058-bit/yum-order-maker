// Saves a signed event contract. The customer sends only their own signature;
// the fixed business signature is attached here, server-side, from a table
// that only admins (and this function) can read.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeadersFor } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/clientIp.ts";

const s = (max: number) => z.string().trim().max(max);

const BodySchema = z.object({
  customer_name: s(120).min(1),
  customer_phone: s(20).min(6),
  customer_email: s(254).min(3),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: s(10).min(1),
  end_time: s(10).min(1),
  event_type: s(100).min(1),
  event_address: s(300).min(1),
  at_venue: z.boolean(),
  seating_preference: s(100).nullable().optional(),
  business_id: s(30).nullable().optional(),
  invoice_name: s(200).nullable().optional(),
  guests_count: z.number().int().min(1).max(2000),
  package_id: s(100).min(1),
  package_name: s(200).min(1),
  package_price_per_person: z.number().nonnegative().max(10000),
  addons: z.array(z.record(z.unknown())).max(50),
  subtotal: z.number().nonnegative().max(10_000_000),
  total_price: z.number().nonnegative().max(10_000_000),
  min_applied: z.boolean(),
  drink_selections: z.record(z.number().int().min(0).max(10000)),
  contract_text: z.string().min(1).max(20000),
  customer_signature: z.string().startsWith("data:image/").max(200000),
});

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid_body" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = getClientIp(req);

    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_action: "event_booking", p_key: `ip:${ip}`, p_max_attempts: 5, p_window: "1 hour",
    });
    if (allowed === false) return json({ error: "rate_limited" }, 429);
    await supabase.rpc("record_rate_limit_attempt", { p_action: "event_booking", p_key: `ip:${ip}`, p_ip_address: ip });

    const { data: priv } = await supabase
      .from("business_private_settings").select("business_signature").eq("id", 1).maybeSingle();
    const businessSignature = priv?.business_signature;
    if (!businessSignature) {
      console.error("submit-event-booking: business signature not configured");
      return json({ error: "business_signature_missing" }, 503);
    }

    const signedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("event_bookings")
      .insert({
        ...parsed.data,
        business_signature: businessSignature,
        signed_at: signedAt,
        client_ip: ip === "unknown" ? null : ip,
        status: "signed",
      })
      .select("id")
      .single();
    if (error) {
      console.error("submit-event-booking insert failed", error.message);
      return json({ error: "save_failed" }, 500);
    }

    // The signed contract copy (PDF) shown to the customer includes the
    // business signature, so it is returned once for this booking only.
    return json({ id: data.id, signedAt, clientIp: ip === "unknown" ? null : ip, businessSignature });
  } catch (e) {
    console.error("submit-event-booking error", e);
    return json({ error: "server_error" }, 500);
  }
});
