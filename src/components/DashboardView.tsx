import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Clock, Globe, Monitor } from "lucide-react";

interface Order {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  order_source: string;
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#eab308"];

const DashboardView = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<"today" | "yesterday" | "week" | "month">("today");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total, status, created_at, payment_method, order_source")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (data) setOrders(data as Order[]);
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.created_at);
      switch (period) {
        case "today": return d >= todayStart;
        case "yesterday": return d >= yesterdayStart && d < todayStart;
        case "week": return d >= weekStart;
        case "month": return d >= monthStart;
      }
    });
  }, [orders, period]);

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
  const orderCount = filteredOrders.length;
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

  const websiteOrders = filteredOrders.filter((o) => o.order_source !== "station");
  const stationOrders = filteredOrders.filter((o) => o.order_source === "station");
  const websiteRevenue = websiteOrders.reduce((s, o) => s + o.total, 0);
  const stationRevenue = stationOrders.reduce((s, o) => s + o.total, 0);

  const pieData = [
    { name: "אתר", value: websiteRevenue, count: websiteOrders.length },
    { name: "קיוסק", value: stationRevenue, count: stationOrders.length },
  ].filter((d) => d.value > 0);

  const cashOrders = filteredOrders.filter((o) => o.payment_method === "cash");
  const creditOrders = filteredOrders.filter((o) => o.payment_method !== "cash");
  const paymentPieData = [
    { name: "מזומן", value: cashOrders.reduce((s, o) => s + o.total, 0) },
    { name: "אשראי", value: creditOrders.reduce((s, o) => s + o.total, 0) },
  ].filter((d) => d.value > 0);

  // Hourly breakdown for today/yesterday
  const hourlyData = useMemo(() => {
    const hours: Record<number, { hour: string; revenue: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) {
      hours[h] = { hour: `${h.toString().padStart(2, "0")}:00`, revenue: 0, orders: 0 };
    }
    filteredOrders.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      hours[h].revenue += o.total;
      hours[h].orders += 1;
    });
    return Object.values(hours).filter((h) => h.revenue > 0 || h.orders > 0);
  }, [filteredOrders]);

  // Daily breakdown for week/month
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; revenue: number; orders: number; website: number; station: number }> = {};
    filteredOrders.forEach((o) => {
      const d = new Date(o.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
      if (!days[d]) days[d] = { date: d, revenue: 0, orders: 0, website: 0, station: 0 };
      days[d].revenue += o.total;
      days[d].orders += 1;
      if (o.order_source === "station") days[d].station += o.total;
      else days[d].website += o.total;
    });
    return Object.values(days);
  }, [filteredOrders]);

  const periodLabel: Record<string, string> = {
    today: "היום",
    yesterday: "אתמול",
    week: "שבוע אחרון",
    month: "חודש אחרון",
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Period Selector */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} dir="rtl">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="today">היום</TabsTrigger>
          <TabsTrigger value="yesterday">אתמול</TabsTrigger>
          <TabsTrigger value="week">שבוע</TabsTrigger>
          <TabsTrigger value="month">חודש</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <DollarSign className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">הכנסות {periodLabel[period]}</p>
              <p className="text-2xl font-black text-foreground">₪{totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <ShoppingBag className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">הזמנות</p>
              <p className="text-2xl font-black text-foreground">{orderCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <TrendingUp className="text-purple-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ממוצע להזמנה</p>
              <p className="text-2xl font-black text-foreground">₪{avgOrder.toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/20">
              <Clock className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">שעת שיא</p>
              <p className="text-2xl font-black text-foreground">
                {hourlyData.length > 0
                  ? hourlyData.reduce((max, h) => (h.revenue > max.revenue ? h : max), hourlyData[0]).hour
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Source Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe size={18} className="text-orange-400" />
              הכנסות לפי מקור
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ₪{d.value.toLocaleString()} · {d.count} הזמנות
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים לתקופה זו</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign size={18} className="text-green-400" />
              חלוקה לפי תשלום
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i + 2]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {paymentPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i + 2] }} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">₪{d.value.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" />
            {period === "today" || period === "yesterday" ? "הכנסות לפי שעה" : "הכנסות לפי יום"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(period === "today" || period === "yesterday") ? (
            hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "revenue" ? [`₪${value}`, "הכנסות"] : [value, "הזמנות"]
                    }
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      direction: "rtl",
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים לתקופה זו</p>
            )
          ) : (
            dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { website: "אתר", station: "קיוסק" };
                      return [`₪${value}`, labels[name] || name];
                    }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      direction: "rtl",
                    }}
                  />
                  <Legend formatter={(v) => (v === "website" ? "אתר" : "קיוסק")} />
                  <Bar dataKey="website" stackId="a" fill="#f97316" name="website" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="station" stackId="a" fill="#3b82f6" name="station" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים לתקופה זו</p>
            )
          )}
        </CardContent>
      </Card>

      {/* Orders count over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag size={18} className="text-purple-400" />
            כמות הזמנות לפי {period === "today" || period === "yesterday" ? "שעה" : "יום"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(period === "today" || period === "yesterday") ? (
            hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "הזמנות"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      direction: "rtl",
                    }}
                  />
                  <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים</p>
            )
          ) : (
            dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "הזמנות"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      direction: "rtl",
                    }}
                  />
                  <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">אין נתונים</p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;
