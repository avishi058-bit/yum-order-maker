import { useState } from "react";
import { useNavigate } from "react-router-dom";

const StationSetup = () => {
  const [isStation] = useState(() => localStorage.getItem("habakta_station") === "true");
  const navigate = useNavigate();

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
      </div>
    </div>
  );
};

export default StationSetup;
