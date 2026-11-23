// One stuck group order on the kitchen screen, the size of an order card.
// Shows the organizer's name and phone and a QR code that dials them.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle } from "lucide-react";
import type { StuckGroup } from "@/hooks/useStuckGroups";

const formatPhone = (p: string) => (/^0\d{9}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p);

const StuckGroupCard = ({ group, onAcknowledge }: { group: StuckGroup; onAcknowledge: () => void }) => {
  const [qr, setQr] = useState<string | null>(null);
  const phone = group.phone ?? "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(group.created_at).getTime()) / 60000));

  useEffect(() => {
    if (!phone) return;
    let alive = true;
    QRCode.toDataURL(`tel:${phone}`, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { /* the phone number is shown anyway */ });
    return () => { alive = false; };
  }, [phone]);

  return (
    <div role="alert" className="rounded-xl border-4 border-amber-500 bg-amber-500/10 p-4 flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xl font-black text-amber-500">
        <AlertTriangle size={24} /> הזמנה קבוצתית נתקעה - נא ליצור קשר
      </p>
      <p className="text-2xl font-black">
        {group.organizer}
        {phone && <> - <span dir="ltr">{formatPhone(phone)}</span></>}
      </p>
      <p className="font-bold text-muted-foreground">
        {group.paid} שילמו, {group.unpaid} עוד לא שילמו - פתוחה {minutes} דקות
      </p>
      {qr && (
        <div className="flex items-center gap-3">
          <img src={qr} alt={`ברקוד להתקשרות אל ${group.organizer}`} className="h-28 w-28 rounded bg-white p-1" />
          <span className="font-bold">סרקו להתקשרות</span>
        </div>
      )}
      <button
        onClick={onAcknowledge}
        className="mt-auto h-14 rounded-xl bg-amber-500 text-xl font-black text-black active:scale-[0.98]"
      >
        הבנתי
      </button>
    </div>
  );
};

export default StuckGroupCard;
