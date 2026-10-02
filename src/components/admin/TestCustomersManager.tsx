import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { loadTestCustomers } from "@/lib/testCustomers";

type Row = { id: string; kind: "name" | "phone"; value: string };

const TestCustomersManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState<"name" | "phone">("name");
  const [value, setValue] = useState("");

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("test_customers")
      .select("id, kind, value")
      .order("kind")
      .order("value");
    if (error) return toast.error("טעינת הרשימה נכשלה");
    setRows((data ?? []) as Row[]);
    loadTestCustomers(true);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const v = value.trim();
    if (v.length < 2) return toast.error("ערך קצר מדי");
    const { error } = await (supabase as any).from("test_customers").insert({ kind, value: v });
    if (error) return toast.error("ההוספה נכשלה");
    setValue("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("test_customers").delete().eq("id", id);
    if (error) return toast.error("המחיקה נכשלה");
    load();
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h2 className="text-lg font-black mb-2">לקוחות בדיקה</h2>
      <p className="text-sm text-muted-foreground mb-4">
        הזמנות עם שם שמכיל אחד מהביטויים או מהטלפונים האלה לא נספרות בדוחות ובסיכום היומי.
      </p>
      <div className="flex gap-2 mb-4">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "name" | "phone")}
          className="bg-secondary border border-border rounded-xl px-3 py-2 text-foreground"
        >
          <option value="name">שם</option>
          <option value="phone">טלפון</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          dir={kind === "phone" ? "ltr" : "rtl"}
          inputMode={kind === "phone" ? "tel" : "text"}
          placeholder={kind === "phone" ? "05XXXXXXXX" : "שם או חלק משם"}
          className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-foreground"
        />
        <button onClick={add} className="bg-primary text-primary-foreground rounded-xl px-4 flex items-center gap-1 font-bold">
          <Plus size={16} /> הוסף
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between bg-secondary rounded-xl px-3 py-2">
            <span>
              <span className="text-xs text-muted-foreground ml-2">{r.kind === "phone" ? "טלפון" : "שם"}</span>
              <span dir={r.kind === "phone" ? "ltr" : "rtl"}>{r.value}</span>
            </span>
            <button onClick={() => remove(r.id)} aria-label="מחק" className="text-destructive p-1">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted-foreground">אין לקוחות בדיקה</li>}
      </ul>
    </div>
  );
};

export default TestCustomersManager;
