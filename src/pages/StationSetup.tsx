import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getKioskKey, setKioskKey } from "@/lib/kioskKey";

const StationSetup = () => {
  const [isStation] = useState(() => localStorage.getItem("habakta_station") === "true");
  const [hasKioskKey, setHasKioskKey] = useState(() => getKioskKey() !== "");
  const [kioskKeyInput, setKioskKeyInput] = useState("");
  const navigate = useNavigate();

  const saveKioskKey = () => {
    setKioskKey(kioskKeyInput);
    setKioskKeyInput("");
    setHasKioskKey(getKioskKey() !== "");
  };

  const enable = () => {
    localStorage.setItem("habakta_station", "true");
    navigate("/");
    window.location.reload();
  };

  const disable = () => {
    localStorage.removeItem("habakta_station");
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-6">
        <h1 className="text-2xl font-black text-foreground">⚙️ הגדרת מכשיר</h1>
        <p className="text-muted-foreground">
          סמן את המכשיר הזה כעמדת הזמנות אם הוא נמצא בתוך המסעדה.
          <br />
          מכשירים רגילים (לקוחות מהאינטרנט) לא צריכים הגדרה.
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm font-medium">סטטוס נוכחי:</span>
          <span className={`font-bold ${isStation ? "text-primary" : "text-muted-foreground"}`}>
            {isStation ? "🖥️ עמדת הזמנות" : "🌐 אתר רגיל"}
          </span>
        </div>
        <div className="flex gap-3 justify-center">
          {!isStation ? (
            <button
              onClick={enable}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              הפעל כעמדת הזמנות
            </button>
          ) : (
            <button
              onClick={disable}
              className="px-6 py-3 bg-destructive text-destructive-foreground rounded-xl font-bold hover:bg-destructive/90 transition-colors"
            >
              בטל עמדת הזמנות
            </button>
          )}
        </div>
        <div className="border-t border-border pt-6 space-y-3">
          <h2 className="text-lg font-bold text-foreground">💳 מפתח מסוף אשראי (קיוסק)</h2>
          <p className="text-sm text-muted-foreground">
            רק מכשיר עם המפתח הזה יכול לשלוח חיוב למסוף האשראי.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-medium">סטטוס:</span>
            <span className={`font-bold ${hasKioskKey ? "text-primary" : "text-muted-foreground"}`}>
              {hasKioskKey ? "✅ מוגדר" : "לא מוגדר"}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              value={kioskKeyInput}
              onChange={(e) => setKioskKeyInput(e.target.value)}
              placeholder="הדבק כאן את המפתח"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-foreground"
              dir="ltr"
            />
            <button
              onClick={saveKioskKey}
              disabled={!kioskKeyInput.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              שמור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationSetup;
