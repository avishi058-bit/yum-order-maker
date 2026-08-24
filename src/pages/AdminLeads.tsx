import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const supa = supabase as any;

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  group_type: string | null;
  guests_count: number | null;
  preferred_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const AdminLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supa
      .from("event_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setLeads(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supa.from("event_leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    const { error } = await supa.from("event_leads").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold">לידים — קבוצות ואירועים</h1>
        {loading && <p className="text-muted-foreground">טוען...</p>}
        {!loading && leads.length === 0 && <p className="text-muted-foreground">אין פניות עדיין</p>}
        {leads.map((l) => (
          <Card key={l.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-lg">{l.full_name}</h2>
                <Badge variant={l.status === "done" ? "default" : "secondary"}>
                  {l.status === "done" ? "טופל" : "חדש"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>📞 {l.phone}</div>
                {l.group_type && <div>🏷️ {l.group_type}</div>}
                {l.guests_count && <div>👥 {l.guests_count}</div>}
                {l.preferred_date && <div>📅 {format(new Date(l.preferred_date + "T00:00:00"), "dd/MM/yyyy")}</div>}
              </div>
              {l.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{l.notes}</p>}
              <p className="text-xs text-muted-foreground">
                התקבל: {format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" asChild><a href={`tel:${l.phone}`}><Phone className="ml-1 w-4 h-4" /> חיוג</a></Button>
                {l.status !== "done" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "done")}>
                    <Check className="ml-1 w-4 h-4" /> סמן כטופל
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => remove(l.id)}>
                  <Trash2 className="ml-1 w-4 h-4" /> מחק
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminLeads;
