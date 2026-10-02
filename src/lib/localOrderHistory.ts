// Device-only order history. Nothing here is ever sent to or read from the
// server - switching device/browser starts with an empty history.

const KEY = "habakta_order_history";
const MAX = 50;

export interface LocalHistoryItem {
  item_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
  toppings: string[] | null;
  removals: string[] | null;
  with_meal: boolean | null;
  meal_side: string | null;
  meal_drink: string | null;
  deal_burgers: any;
  deal_drinks: any;
}

export interface LocalHistoryOrder {
  id: string;
  order_number: number | null;
  created_at: string;
  total: number;
  payment_method: string | null;
  notes: string | null;
  items: LocalHistoryItem[];
  /** false until a card payment is confirmed; unconfirmed orders are hidden. */
  confirmed: boolean;
}

const readAll = (): LocalHistoryOrder[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const writeAll = (rows: LocalHistoryOrder[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
  } catch { /* storage full / blocked */ }
};

export function addLocalOrder(order: LocalHistoryOrder): void {
  const rows = readAll().filter((o) => o.id !== order.id);
  rows.unshift(order);
  writeAll(rows);
}

export function confirmLocalOrder(id: string, orderNumber?: number | null): void {
  const rows = readAll();
  const row = rows.find((o) => o.id === id);
  if (!row) return;
  row.confirmed = true;
  if (orderNumber) row.order_number = orderNumber;
  writeAll(rows);
}

/** Confirmed orders on this device, newest first (max 50). */
export function getLocalOrders(): LocalHistoryOrder[] {
  return readAll().filter((o) => o.confirmed).slice(0, MAX);
}
