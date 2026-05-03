import { supabase } from "@/integrations/supabase/client";
import type { Topping } from "@/data/menu";
import { useEffect, useState } from "react";

type Listener = () => void;

let cache: Topping[] = [];
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((l) => l());

export const getCustomToppings = (): Topping[] => cache;

export const findToppingPrice = (id: string): number | undefined => {
  const t = cache.find((x) => x.id === id);
  return t?.price;
};

export const findToppingName = (id: string): string | undefined => {
  return cache.find((x) => x.id === id)?.name;
};

let initStarted = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

const fetchAll = async () => {
  const { data } = await supabase
    .from("custom_toppings")
    .select("id, item_id, name, price");
  if (data) {
    cache = data.map((r: any) => ({ id: r.item_id, name: r.name, price: Number(r.price) }));
    notify();
  }
};

export const initCustomToppings = () => {
  if (initStarted) return;
  initStarted = true;
  fetchAll();
  channel = supabase
    .channel("custom-toppings-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "custom_toppings" },
      () => fetchAll()
    )
    .subscribe();
};

export const useCustomToppings = (): Topping[] => {
  const [list, setList] = useState<Topping[]>(cache);
  useEffect(() => {
    initCustomToppings();
    const l = () => setList([...cache]);
    listeners.add(l);
    setList([...cache]);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return list;
};
