import { useState, useEffect } from "react";
import { useSiteSettings, type BusinessHoursMap } from "@/hooks/useSiteSettings";
import { menuItems } from "@/data/menu";
import { ArrowRight, GripVertical, Save, Monitor, Tablet, Type, Palette, MessageSquare, Eye, EyeOff, Clock, Sliders } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DAY_NAMES_HE, DEFAULT_HOURS } from "@/hooks/useBusinessHours";
import KioskSettingsTab from "@/components/admin/KioskSettingsTab";

const AdminSettings = () => {
  const { settings, loading, updateSettings } = useSiteSettings();
  const navigate = useNavigate();

  const [kioskScale, setKioskScale] = useState(1.0);
  const [websiteScale, setWebsiteScale] = useState(1.0);
  const [primaryColor, setPrimaryColor] = useState("25 95% 53%");
  const [bgColor, setBgColor] = useState("0 0% 100%");
  const [overrides, setOverrides] = useState<Record<string, { name?: string; description?: string }>>({});
  const [menuOrder, setMenuOrder] = useState<string[]>([]);
  const [bannerText, setBannerText] = useState("");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHoursMap>(DEFAULT_HOURS);
  const [activeTab, setActiveTab] = useState<"fonts" | "menu" | "colors" | "banner" | "order" | "hours" | "kiosk">("fonts");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setKioskScale(settings.kiosk_font_scale);
      setWebsiteScale(settings.website_font_scale);
      setPrimaryColor(settings.primary_color);
      setBgColor(settings.background_color);
      setOverrides(settings.menu_item_overrides);
      setMenuOrder(settings.menu_order.length > 0 ? settings.menu_order : menuItems.map((m) => m.id));
      setBannerText(settings.banner_text);
      setBannerEnabled(settings.banner_enabled);
      setBusinessHours(settings.business_hours || DEFAULT_HOURS);
    }
  }, [loading, settings]);

  const handleSave = async (section: string, updates: any) => {
    const error = await updateSettings(updates);
    if (error) {
      toast.error("שגיאה בשמירה");
    } else {
      toast.success(`${section} נשמר בהצלחה!`);
    }
  };

  const handleDragStart = (id: string) => setDraggedItem(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    setMenuOrder((prev) => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedItem);
      const toIdx = newOrder.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedItem);
      return newOrder;
    });
  };
  const handleDragEnd = () => setDraggedItem(null);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { id: "fonts" as const, label: "גודל כתב", icon: Type },
    { id: "kiosk" as const, label: "קיוסק", icon: Sliders },
    { id: "menu" as const, label: "שמות מנות", icon: Monitor },
    { id: "order" as const, label: "סדר מנות", icon: GripVertical },
    { id: "colors" as const, label: "צבעים", icon: Palette },
    { id: "banner" as const, label: "באנר", icon: MessageSquare },
    { id: "hours" as const, label: "שעות פעילות", icon: Clock },
  ];

  const orderedItems = menuOrder
    .map((id) => menuItems.find((m) => m.id === id))
    .filter(Boolean) as typeof menuItems;
  // Add any items not in the order
  const missingItems = menuItems.filter((m) => !menuOrder.includes(m.id));
  const allOrderedItems = [...orderedItems, ...missingItems];

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight size={24} />
          <span className="font-bold">חזרה</span>
        </button>
        <h1 className="text-xl font-black text-primary">⚙️ הגדרות האתר</h1>
        <div className="w-20" />
      </div>

      {/* Tabs */}
      <div className="flex-none flex gap-1 px-4 py-3 bg-card border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "kiosk" && <KioskSettingsTab />}

        {activeTab === "fonts" && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <Tablet size={24} className="text-primary" />
                <h2 className="text-lg font-black">גודל כתב — קיוסק</h2>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.8"
                step="0.05"
                value={kioskScale}
                onChange={(e) => setKioskScale(parseFloat(e.target.value))}
                className="w-full h-3 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>קטן (0.7x)</span>
                <span className="font-black text-primary text-lg">{kioskScale.toFixed(2)}x</span>
                <span>גדול (1.8x)</span>
              </div>
              <div className="mt-4 p-4 bg-secondary/50 rounded-xl">
                <p className="text-muted-foreground text-sm mb-2">תצוגה מקדימה:</p>
                <p style={{ fontSize: `${18 * kioskScale}px` }} className="font-bold">סמאש דאבל צ׳יז — ₪66</p>
                <p style={{ fontSize: `${14 * kioskScale}px` }} className="text-muted-foreground">חסה, חמוצים ואיולי הבית</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <Monitor size={24} className="text-primary" />
                <h2 className="text-lg font-black">גודל כתב — אתר</h2>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.8"
                step="0.05"
                value={websiteScale}
                onChange={(e) => setWebsiteScale(parseFloat(e.target.value))}
                className="w-full h-3 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>קטן (0.7x)</span>
                <span className="font-black text-primary text-lg">{websiteScale.toFixed(2)}x</span>
                <span>גדול (1.8x)</span>
              </div>
              <div className="mt-4 p-4 bg-secondary/50 rounded-xl">
                <p className="text-muted-foreground text-sm mb-2">תצוגה מקדימה:</p>
                <p style={{ fontSize: `${16 * websiteScale}px` }} className="font-bold">סמאש דאבל צ׳יז — ₪66</p>
                <p style={{ fontSize: `${13 * websiteScale}px` }} className="text-muted-foreground">חסה, חמוצים ואיולי הבית</p>
              </div>
            </div>

            <button
              onClick={() => handleSave("גודל כתב", { kiosk_font_scale: kioskScale, website_font_scale: websiteScale })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2"
            >
              <Save size={20} />
              שמור שינויים
            </button>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-muted-foreground text-sm mb-4">ערוך שמות ותיאורים של מנות. השדות הריקים ישתמשו בערכי ברירת המחדל.</p>
            {menuItems.filter((m) => m.category === "burger" || m.category === "meal").map((item) => (
              <div key={item.id} className="bg-card rounded-2xl p-5 border border-border">
                <p className="text-xs text-muted-foreground mb-2">מקור: {item.name}</p>
                <input
                  value={overrides[item.id]?.name ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [item.id]: { ...prev[item.id], name: e.target.value },
                    }))
                  }
                  placeholder={item.name}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 font-bold text-foreground mb-2 placeholder:text-muted-foreground/50"
                />
                <textarea
                  value={overrides[item.id]?.description ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [item.id]: { ...prev[item.id], description: e.target.value },
                    }))
                  }
                  placeholder={item.description}
                  rows={2}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none placeholder:text-muted-foreground/50"
                />
              </div>
            ))}
            <button
              onClick={() => handleSave("שמות מנות", { menu_item_overrides: overrides })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 sticky bottom-0"
            >
              <Save size={20} />
              שמור שינויים
            </button>
          </div>
        )}

        {activeTab === "order" && (
          <div className="max-w-2xl mx-auto space-y-2">
            <p className="text-muted-foreground text-sm mb-4">גרור כדי לשנות את סדר הופעת המנות בתפריט</p>
            {allOrderedItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragEnd={handleDragEnd}
                className={`bg-card rounded-xl p-4 border border-border flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all ${
                  draggedItem === item.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <GripVertical size={20} className="text-muted-foreground flex-none" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{overrides[item.id]?.name || item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
                <span className="text-sm font-bold text-primary">₪{item.price}</span>
              </div>
            ))}
            <button
              onClick={() => handleSave("סדר מנות", { menu_order: menuOrder })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 sticky bottom-0"
            >
              <Save size={20} />
              שמור סדר
            </button>
          </div>
        )}

        {activeTab === "colors" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-black mb-4">צבע ראשי</h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-border" style={{ backgroundColor: `hsl(${primaryColor})` }} />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="25 95% 53%"
                  className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">פורמט HSL: hue saturation% lightness% (לדוגמה: 25 95% 53%)</p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-black mb-4">צבע רקע</h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-border" style={{ backgroundColor: `hsl(${bgColor})` }} />
                <input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  placeholder="0 0% 100%"
                  className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 font-mono text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => handleSave("צבעים", { primary_color: primaryColor, background_color: bgColor })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2"
            >
              <Save size={20} />
              שמור צבעים
            </button>
          </div>
        )}

        {activeTab === "banner" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">באנר הודעה</h2>
                <button
                  onClick={() => setBannerEnabled(!bannerEnabled)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                    bannerEnabled ? "bg-green-500/20 text-green-600" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {bannerEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  {bannerEnabled ? "מופעל" : "כבוי"}
                </button>
              </div>
              <textarea
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="הקלד הודעה שתוצג בראש האתר..."
                rows={3}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground resize-none placeholder:text-muted-foreground/50"
              />
              {bannerEnabled && bannerText && (
                <div className="mt-4 bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                  <p className="text-primary font-bold text-sm">תצוגה מקדימה:</p>
                  <p className="font-bold mt-1">{bannerText}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => handleSave("באנר", { banner_text: bannerText, banner_enabled: bannerEnabled })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2"
            >
              <Save size={20} />
              שמור באנר
            </button>
          </div>
        )}

        {activeTab === "hours" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-muted-foreground text-sm mb-4">
              קבע את שעות הפעילות של העסק. שורת הסטטוס באתר תתעדכן אוטומטית.
            </p>
            {DAY_NAMES_HE.map((name, idx) => {
              const day = businessHours[String(idx)] ?? DEFAULT_HOURS[String(idx)];
              return (
                <div key={idx} className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base">{name}</h3>
                    <button
                      onClick={() =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [String(idx)]: { ...day, open: !day.open },
                        }))
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        day.open ? "bg-green-500/20 text-green-600" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {day.open ? <Eye size={14} /> : <EyeOff size={14} />}
                      {day.open ? "פתוח" : "סגור"}
                    </button>
                  </div>
                  <div className={`grid grid-cols-2 gap-3 ${day.open ? "" : "opacity-40 pointer-events-none"}`}>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">פתיחה</span>
                      <input
                        type="time"
                        value={day.from}
                        onChange={(e) =>
                          setBusinessHours((prev) => ({
                            ...prev,
                            [String(idx)]: { ...day, from: e.target.value },
                          }))
                        }
                        className="bg-secondary border border-border rounded-xl px-3 py-2 text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">סגירה</span>
                      <input
                        type="time"
                        value={day.to}
                        onChange={(e) =>
                          setBusinessHours((prev) => ({
                            ...prev,
                            [String(idx)]: { ...day, to: e.target.value },
                          }))
                        }
                        className="bg-secondary border border-border rounded-xl px-3 py-2 text-foreground"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => handleSave("שעות פעילות", { business_hours: businessHours })}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 sticky bottom-0"
            >
              <Save size={20} />
              שמור שעות פעילות
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
