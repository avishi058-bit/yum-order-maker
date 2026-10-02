import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAgentSecret, setAgentSecret } from "@/lib/localPrintAgent";

const StationSetup = () => {
  const [isStation] = useState(() => localStorage.getItem("habakta_station") === "true");
  const navigate = useNavigate();
  const [agentCode, setAgentCode] = useState("");
  const [hasAgentCode, setHasAgentCode] = useState(() => !!getAgentSecret());

  const saveAgentCode = () => {
    const v = agentCode.trim();
    if (v.length < 16) return;
    setAgentSecret(v);
    setAgentCode("");
    setHasAgentCode(true);
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

        <div className="border-t border-border pt-6 space-y-3 text-right">
          <h2 className="font-black text-foreground">🖨️ קוד אפליקציית ההדפסה</h2>
          <p className="text-sm text-muted-foreground">
            פתחו את אפליקציית ההדפסה בטאבלט והקלידו כאן את הקוד שמוצג בה. הקוד נשמר רק במכשיר הזה.
          </p>
          <p className="text-sm font-bold">{hasAgentCode ? "✅ קוד שמור במכשיר" : "⚠️ לא נשמר קוד - ההדפסה דרך האפליקציה לא תעבוד"}</p>
          <div className="flex gap-2">
            <input
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              dir="ltr"
              autoCapitalize="off"
              autoComplete="off"
              placeholder="קוד מהאפליקציה"
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-foreground font-mono"
            />
            <button
              onClick={saveAgentCode}
              disabled={agentCode.trim().length < 16}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50"
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
