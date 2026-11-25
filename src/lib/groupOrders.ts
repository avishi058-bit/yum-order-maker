// Group orders (src/pages/GroupOrder.tsx): every participant pays their own
// order, and the orders stay hidden from the kitchen (group_hold) until the
// whole group is paid. Once released, the kitchen shows them as ONE order:
// one card, one bon, a name on every dish. This merges the rows for the
// kitchen screen and remembers which real order ids stand behind each card,
// so a status change on the card is applied to all of them.

const OWNER_PREFIX = "__OWNER__:";

type Row = {
  id: string;
  created_at: string;
  customer_name: string;
  total: number | string;
  notes?: string | null;
  status: string;
  group_id?: string | null;
  group_hold?: boolean | null;
  order_items?: Array<{ removals: string[] | null } & Record<string, unknown>>;
};

export const mergeGroupOrders = <T extends Row>(rows: T[]): { orders: T[]; ids: Map<string, string[]> } => {
  const ids = new Map<string, string[]>();
  const visible = rows.filter((r) => !r.group_hold);
  const byGroup = new Map<string, T[]>();
  for (const r of visible) {
    if (!r.group_id || ["cancelled", "payment_failed", "pending_payment"].includes(r.status)) continue;
    const list = byGroup.get(r.group_id) ?? [];
    list.push(r);
    byGroup.set(r.group_id, list);
  }
  const merged = new Map<string, T>();
  const absorbed = new Set<string>();
  for (const list of byGroup.values()) {
    if (list.length < 2) continue;
    const members = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const base = members[0];
    const items = members.flatMap((m) =>
      (m.order_items ?? []).map((it) => {
        const removals = it.removals ?? [];
        const hasOwner = removals.some((r) => typeof r === "string" && r.startsWith(OWNER_PREFIX));
        return hasOwner ? it : { ...it, removals: [`${OWNER_PREFIX}${m.customer_name}`, ...removals] };
      }),
    );
    const notes = members
      .filter((m) => m.notes && m.notes.trim())
      .map((m) => `${m.customer_name}: ${m.notes!.trim()}`)
      .join("\n");
    merged.set(base.id, {
      ...base,
      customer_name: `${base.customer_name} - קבוצה (${members.length})`,
      total: members.reduce((s, m) => s + Number(m.total || 0), 0),
      notes: notes || null,
      order_items: items,
    });
    ids.set(base.id, members.map((m) => m.id));
    members.slice(1).forEach((m) => absorbed.add(m.id));
  }
  const orders = visible
    .filter((r) => !absorbed.has(r.id))
    .map((r) => merged.get(r.id) ?? r);
  return { orders, ids };
};
