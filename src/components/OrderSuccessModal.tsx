import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface OrderSuccessModalProps {
  orderNumber: number;
  /** Optional hint shown under the order number (e.g. payment instructions). */
  note?: string;
  onClose: () => void;
}

/**
 * Large, unmistakable order confirmation.
 *
 * Shown right after an order is created so customers immediately see that it
 * went through — the main cause of accidental double orders was a confirmation
 * that was too subtle (toast only).
 */
const OrderSuccessModal = ({ orderNumber, note, onClose }: OrderSuccessModalProps) => {
  return (
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md rounded-3xl border-2 border-green-500 bg-card p-8 text-center shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, delay: 0.1 }}
          className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/15"
        >
          <CheckCircle2 className="h-16 w-16 text-green-500" strokeWidth={2.5} />
        </motion.div>

        <h2 className="text-3xl font-black text-green-500">ההזמנה התקבלה!</h2>
        <p className="mt-1 text-muted-foreground">ההזמנה שלך נשלחה למטבח ✅</p>

        <div className="my-6 rounded-2xl bg-muted/60 py-5">
          <div className="text-sm text-muted-foreground">מספר הזמנה</div>
          <div className="text-5xl font-black text-foreground">#{orderNumber}</div>
        </div>

        {note && <p className="mb-4 text-base font-bold text-foreground">{note}</p>}

        <p className="mb-5 text-sm text-muted-foreground">
          אפשר לעקוב אחרי סטטוס ההזמנה בסרגל שבראש המסך.
        </p>


        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-green-600 py-4 text-lg font-black text-white transition-transform active:scale-95"
        >
          הבנתי, תודה!
        </button>
      </motion.div>
    </div>
  );
};

export default OrderSuccessModal;
