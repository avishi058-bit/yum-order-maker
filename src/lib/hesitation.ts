// Items the customer hesitated over during this order: opened and closed
// without adding, or added and then took out. The cart's "ממליצים לך להוסיף"
// rail shows these first, as if by chance. Kept in memory only and cleared
// with the cart (the kiosk serves a new customer after every order).
const scores = new Map<string, { score: number; at: number }>();

export const noteHesitation = (menuItemId: string | undefined | null, weight = 1) => {
  if (!menuItemId) return;
  const cur = scores.get(menuItemId);
  scores.set(menuItemId, { score: (cur?.score ?? 0) + weight, at: Date.now() });
};

/** Most hesitated first; ties go to the most recent. */
export const hesitatedItemIds = (): string[] =>
  [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[1].at - a[1].at)
    .map(([id]) => id);

export const clearHesitation = () => scores.clear();
