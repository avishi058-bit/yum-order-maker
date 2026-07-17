import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

const DEVICE_TOKEN_KEY = "habakta_device_token";

/**
 * Customer preferences — self-service page where a customer can toggle
 * marketing consent off (or back on) without contacting the business.
 * Requires the device token issued by CustomerAuthContext.
 */
const Preferences = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; phone: string; marketing_consent: boolean } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    supabase.functions
      .invoke("customer-auth?action=get-preferences", { body: { deviceToken: token } })
      .then(({ data, error }) => {
        if (error || !data?.customer) return;
        setCustomer(data.customer);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleMarketing = async (next: boolean) => {
    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token || !customer) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke(
      "customer-auth?action=update-marketing-consent",
      { body: { deviceToken: token, marketingConsent: next } },
    );
    setSaving(false);
    if (error || !data?.success) {
      toast.error("לא ניתן לעדכן כרגע — נסו שוב");
      return;
    }
    setCustomer({ ...customer, marketing_consent: next });
    toast.success(next ? "ההסכמה עודכנה — תקבלו עדכונים ומבצעים" : "ההסכמה בוטלה — לא נשלח לכם דיוור");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h1 className="text-2xl font-black text-foreground">העדפות תקשורת</h1>
          <p className="text-muted-foreground">
            כדי לנהל את העדפות התקשורת שלך יש להזמין ולהתחבר מהמכשיר הזה. אם ברצונך
            להסיר את עצמך מדיוור בלי להתחבר — פנה אלינו טלפונית ב־058-4633-555 ונטפל ידנית.
          </p>
          <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline font-bold">
            <ArrowRight size={16} /> חזרה לדף הראשי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-black text-foreground mb-1">העדפות תקשורת</h1>
          <p className="text-muted-foreground text-sm">
            שלום {customer.name}, ניתן לנהל כאן את ההסכמות לדיוור שלנו.
          </p>
        </header>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-bold text-foreground">מבצעים ועדכונים ב־WhatsApp</h2>
            <p className="text-sm text-muted-foreground mt-1">
              קבלת עדכונים על מבצעים, חידושים בתפריט והנחות. אין קשר לעדכוני
              הזמנה שוטפים — אלה נשלחים תמיד.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-bold text-foreground">
              {customer.marketing_consent ? "ההסכמה פעילה" : "ההסכמה בוטלה"}
            </span>
            <input
              type="checkbox"
              checked={customer.marketing_consent}
              onChange={(e) => toggleMarketing(e.target.checked)}
              disabled={saving}
              className="w-11 h-11 accent-primary cursor-pointer"
              aria-label="הסכמה לקבלת עדכונים שיווקיים"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            ניתן לשנות את ההסכמה בכל עת. השינוי מתועד ביומן הסכמות בהתאם
            לחוק התקשורת (בזק ושידורים).
          </p>
        </div>

        <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline font-bold">
          <ArrowRight size={16} /> חזרה לדף הראשי
        </Link>
      </div>
    </div>
  );
};

export default Preferences;
