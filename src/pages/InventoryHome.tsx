// Installed stock app opens here (the install file holds no access link):
// continue to the link saved on this device the first time it was opened.
import { Navigate } from "react-router-dom";

export const INVENTORY_TOKEN_KEY = "habikta_inventory_token";

const InventoryHome = () => {
  let token: string | null = null;
  try { token = localStorage.getItem(INVENTORY_TOKEN_KEY); } catch { /* storage blocked */ }
  if (token && /^[A-Za-z0-9_-]{16,128}$/.test(token)) return <Navigate to={`/inventory/${token}`} replace />;
  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center bg-background text-foreground">
      <p className="text-lg font-bold max-w-sm">פותחים פעם אחת את הקישור האישי לניהול המלאי, ומאז האפליקציה זוכרת אותו.</p>
    </main>
  );
};

export default InventoryHome;
