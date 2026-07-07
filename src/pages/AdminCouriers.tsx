import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, MapPin, Pause, Play, Trash2, Bike } from "lucide-react";

type Courier = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "suspended";
  approved_at: string | null;
  created_at: string;
};

type Loc = { courier_id: string; lat: number; lng: number; updated_at: string };

const AdminCouriers = () => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [locations, setLocations] = useState<Record<string, Loc>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [cRes, lRes] = await Promise.all([
      supabase.from("couriers").select("*").order("created_at", { ascending: false }),
      supabase.from("courier_locations").select("*"),
    ]);
    setCouriers((cRes.data as Courier[]) ?? []);
    const map: Record<string, Loc> = {};
    ((lRes.data as Loc[]) ?? []).forEach(l => { map[l.courier_id] = l; });
    setLocations(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-couriers")
      .on("postgres_changes", { event: "*", schema: "public", table: "couriers" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "courier_locations" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (c: Courier, status: Courier["status"]) => {
    const patch: any = { status };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      const { data: sess } = await supabase.auth.getSession();
      patch.approved_by = sess.session?.user.id ?? null;
    }
    const { error } = await supabase.from("couriers").update(patch).eq("id", c.id);
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: status === "approved" ? "אושר ✅" : status === "suspended" ? "הושבת" : "עודכן" });
      if (status === "approved") {
        // Grant courier role
        const { error: rErr } = await supabase.from("user_roles").insert({ user_id: c.user_id, role: "courier" as any });
        if (rErr && (rErr as any).code !== "23505") console.warn("role insert", rErr);
      }
    }
  };

  const remove = async (c: Courier) => {
    if (!confirm(`למחוק את ${c.name}?`)) return;
    await supabase.from("couriers").delete().eq("id", c.id);
    toast({ title: "נמחק" });
  };

  if (loading) return <div className="p-8">טוען...</div>;

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Bike className="h-6 w-6" /> ניהול שליחים</h1>
      <div className="space-y-3 max-w-3xl">
        {couriers.length === 0 && <p className="text-muted-foreground">אין בקשות שליחים.</p>}
        {couriers.map(c => {
          const loc = locations[c.id];
          const wazeUrl = loc ? `https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes` : null;
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {c.name}
                  <Badge variant={c.status === "approved" ? "default" : c.status === "pending" ? "secondary" : "destructive"}>
                    {c.status === "approved" ? "מאושר" : c.status === "pending" ? "ממתין" : "מושבת"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <a href={`tel:${c.phone}`} className="underline">{c.phone}</a>
                  {" · נרשם: "}{new Date(c.created_at).toLocaleDateString("he-IL")}
                </p>
                {loc && (
                  <p className="text-xs">
                    <a href={wazeUrl!} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> מיקום אחרון · {new Date(loc.updated_at).toLocaleTimeString("he-IL")}
                    </a>
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {c.status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus(c, "approved")}>
                      <Check className="ml-1 h-4 w-4" /> אשר
                    </Button>
                  )}
                  {c.status === "approved" && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(c, "suspended")}>
                      <Pause className="ml-1 h-4 w-4" /> השבת
                    </Button>
                  )}
                  {c.status === "suspended" && (
                    <Button size="sm" onClick={() => setStatus(c, "approved")}>
                      <Play className="ml-1 h-4 w-4" /> הפעל מחדש
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCouriers;
