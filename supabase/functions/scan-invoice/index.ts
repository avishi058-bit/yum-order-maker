// Reads a photographed supplier invoice with AI and returns structured expense fields.
// Admin/kitchen only. Nothing is saved here — the owner reviews and confirms in the dashboard.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_invoice", "supplier", "description", "date", "total", "includes_vat", "category", "monthly"],
  properties: {
    is_invoice: { type: "boolean" },
    supplier: { type: ["string", "null"] },
    description: { type: "string", description: "Short Hebrew name of what was bought, e.g. 'סבון כלים ומפיות'" },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    total: { type: ["number", "null"], description: "Final amount paid in ILS" },
    includes_vat: { type: "boolean", description: "true if total includes VAT (סה\"כ לתשלום כולל מע\"מ)" },
    category: { type: "string", enum: ["supply", "fixed", "one_time"] },
    monthly: { type: ["number", "null"], description: "For fixed: monthly amount before VAT" },
  },
};

const PROMPT = `אתה מפענח חשבוניות/קבלות של ספקים עבור מסעדת המבורגרים קטנה בישראל.
החזר JSON לפי הסכמה. כללים:
- total = הסכום הסופי לתשלום. includes_vat=true אם הוא כולל מע"מ (ברוב החשבוניות כן).
- category:
  "supply" = מתכלים שנגמרים ונקנים שוב (סבון, מפיות, חומרי ניקוי, כפפות, רטבים כלליים, שקיות, כלים חד פעמיים).
  "fixed" = חשבון חודשי חוזר (חשמל, סלולר, אינטרנט, כשרות, פרסום, תחזוקת אתר, רואה חשבון). אז monthly = הסכום החודשי לפני מע"מ.
  "one_time" = כל השאר (תיקון, ציוד, חומרי גלם חד-פעמיים וכו').
- description בעברית, קצר.
- אם התמונה אינה חשבונית: is_invoice=false.`;

const PRODUCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_invoice", "supplier", "date", "includes_vat", "lines"],
  properties: {
    is_invoice: { type: "boolean" },
    supplier: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    includes_vat: { type: "boolean", description: "true if line totals include VAT" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw_name", "quantity", "unit", "unit_price", "total", "item_key"],
        properties: {
          raw_name: { type: "string", description: "Product name exactly as printed" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"], description: "ק\"ג / יח' / ארגז" },
          unit_price: { type: ["number", "null"] },
          total: { type: ["number", "null"], description: "Line total" },
          item_key: { type: "string", enum: ["lettuce", "tomato", "red_onion", "pickles", "white_onion", "other", "unknown"] },
        },
      },
    },
  },
};

const producePrompt = (aliases: { raw_name: string; label: string }[]) => `אתה מפענח חשבונית של ספק ירקות/מזון עבור מסעדת המבורגרים בישראל.
החזר כל שורת מוצר בחשבונית בנפרד (שם כפי שמודפס, כמות, יחידה, מחיר ליחידה, סה"כ שורה).
item_key: lettuce=חסה, tomato=עגבנייה, red_onion=בצל סגול, pickles=מלפפון חמוץ, white_onion=בצל לבן/יבש, other=מוצר ברור שאינו אחד מאלה.
אם אינך בטוח לחלוטין מה המוצר — החזר "unknown". אל תנחש.
${aliases.length ? "שמות שהבעלים כבר הגדיר:\n" + aliases.map((a) => `- "${a.raw_name}" = ${a.label}`).join("\n") : ""}
אם התמונה אינה חשבונית: is_invoice=false ו-lines ריק.`;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await anon.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    const { data: isKitchen } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "kitchen" });
    if (!isAdmin && !isKitchen) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const image = typeof body?.image === "string" ? body.image : "";
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 8_000_000)
      return json({ error: "תמונה לא תקינה" }, 400);

    const produce = body?.mode === "produce";
    const aliases = Array.isArray(body?.aliases) ? body.aliases.slice(0, 200).filter((a: any) => typeof a?.raw_name === "string" && typeof a?.label === "string") : [];
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "invoice", strict: true, schema: produce ? PRODUCE_SCHEMA : SCHEMA } },
        input: [{
          role: "user",
          content: [{ type: "input_text", text: produce ? producePrompt(aliases) : PROMPT }, { type: "input_image", image_url: image }],
        }],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("gateway", res.status, t.slice(0, 500));
      const msg = res.status === 402 ? "נגמרו קרדיטי ה-AI" : res.status === 429 ? "יותר מדי בקשות, נסה בעוד דקה" : "הפענוח נכשל";
      return json({ error: msg }, res.status === 402 || res.status === 429 ? res.status : 502);
    }

    // read SSE
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", failed = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") failed = ev.error?.message ?? ev.response?.error?.message ?? "failed";
        } catch { /* ignore */ }
      }
    }
    if (failed || !text.trim()) {
      console.error("empty/failed", failed);
      return json({ error: "הפענוח נכשל, נסה תמונה ברורה יותר" }, 502);
    }
    return json({ result: JSON.parse(text) });
  } catch (e) {
    console.error(e);
    return json({ error: "שגיאה בפענוח" }, 500);
  }
});
