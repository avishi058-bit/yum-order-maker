import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateIsraeliPhone } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = "הסרה מרשימת התפוצה | הבקתה";
  }, []);

  const submit = async () => {
    const check = validateIsraeliPhone(phone);
    if (!check.valid) {
      toast({ title: check.error, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("unsubscribe-marketing", {
        body: { phone: phone.trim() },
      });
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      toast({ title: e?.message || "שגיאה, נסו שוב", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-6 space-y-5">
        <h1 className="text-2xl font-bold text-foreground">הסרה מרשימת התפוצה</h1>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 size={64} className="text-primary mx-auto" />
            <p className="text-foreground font-medium">הוסרת בהצלחה מרשימת התפוצה השיווקית.</p>
            <p className="text-sm text-muted-foreground">
              לא תקבל/י מאיתנו הודעות שיווקיות נוספות. הודעות הקשורות להזמנות שלך ימשיכו להישלח כרגיל.
            </p>
            <Link to="/" className="inline-block text-sm text-primary hover:underline">
              חזרה לאתר
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              הכנס/י את מספר הטלפון שאיתו נרשמת כדי להסיר את עצמך מרשימת הדיוור השיווקית.
              ההסרה מיידית ואינה דורשת התחברות.
            </p>
            <input
              type="tel"
              inputMode="tel"
              placeholder="0501234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-right"
              autoFocus
            />
            <button
              onClick={submit}
              disabled={loading || !phone.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "מסיר..." : "הסר אותי מרשימת התפוצה"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              הסרה זו לא מוחקת את החשבון שלך — רק מפסיקה קבלת הודעות שיווקיות.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
