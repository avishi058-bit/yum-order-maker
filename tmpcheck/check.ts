import { menuItems, mealSideOptions, mealDrinkOptions, dealDrinkOptions, sauceOptions } from "@/data/menu";
import { computeCartItemUnitPrice } from "@/lib/cartPricing";
import { MENU_ITEMS_PRICING, TOPPINGS_PRICING, MEAL_SIDES_PRICING, MEAL_DRINKS_PRICING, DEAL_DRINKS_PRICING, MEAL_UPGRADE_PRICE } from "../supabase/functions/_shared/menu-pricing";

const M = new Map(MENU_ITEMS_PRICING.map(m=>[m.id,m]));
const T = Object.fromEntries(TOPPINGS_PRICING.map(t=>[t.id,t]));
const S = Object.fromEntries(MEAL_SIDES_PRICING.map(t=>[t.id,t]));
const D = Object.fromEntries(MEAL_DRINKS_PRICING.map(t=>[t.id,t]));
const DD = Object.fromEntries(DEAL_DRINKS_PRICING.map(t=>[t.id,t]));

function server(item:any){
  const mi = M.get(item.menuItemId); if(!mi) return {err:`unknown ${item.menuItemId}`};
  let unit = mi.price;
  for(const t of item.toppings||[]){ const x=T[t]; if(!x) return {err:`topping ${t}`}; 
    const isAray = (mi.id==="arayes-special"||mi.id==="arayes-special-4") && (item.toppings||[]).every((y:string)=>y==="arayes-extra-quarter");
    if(mi.category!=="burger"&&mi.category!=="meal"&&!isAray) return {err:`toppings not allowed on ${mi.id}`};
    unit+=x.price; }
  if(item.withMeal && mi.category==="burger") unit+=MEAL_UPGRADE_PRICE;
  const mealCtx = mi.category==="meal" || !!item.withMeal;
  if(item.mealSideId){ if(!mealCtx) return {err:`side not allowed ${mi.id}`}; const s=S[item.mealSideId]; if(!s) return {err:`side ${item.mealSideId}`}; unit+=s.price; }
  if(item.mealDrinkId){ if(!mealCtx) return {err:`drink not allowed ${mi.id}`}; const d=D[item.mealDrinkId]; if(!d) return {err:`drink ${item.mealDrinkId}`}; unit+=d.price; }
  for(const dd of item.dealDrinks||[]){ if(mi.category!=="deal") return {err:"dealdrink"}; const d=DD[dd.id]; if(!d) return {err:`dealdrink ${dd.id}`}; unit+=d.price; }
  for(const b of item.dealBurgers||[]) for(const t of b.toppings||[]){ const x=T[t]; if(!x) return {err:`deal topping ${t}`}; unit+=x.price; }
  return {unit};
}
const problems:string[]=[];
function chk(label:string,item:any){
  const c = computeCartItemUnitPrice({quantity:1,removals:[],toppings:[],...item} as any);
  const s = server(item);
  if((s as any).err) problems.push(`SERVER-REJECT ${label}: ${(s as any).err}`);
  else if(Math.abs(c-(s as any).unit)>0.001) problems.push(`MISMATCH ${label}: client ${c} vs server ${(s as any).unit}`);
}
// 0. menu.ts prices vs pricing source
for(const m of menuItems){ const p=M.get(m.id); if(!p) problems.push(`menu.ts item not in pricing: ${m.id}`); else if(p.price!==m.price) problems.push(`price differs ${m.id}: ui ${m.price} vs src ${p.price}`); }
for(const p of MENU_ITEMS_PRICING) if(!menuItems.find(m=>m.id===p.id)) problems.push(`pricing item missing in UI menu: ${p.id}`);

for(const m of menuItems){
  chk(`plain ${m.id}`,{menuItemId:m.id,name:m.name,price:m.price});
  if(m.category==="burger"||m.category==="meal"){
    for(const t of TOPPINGS_PRICING) chk(`${m.id}+${t.id}`,{menuItemId:m.id,name:m.name,price:m.price,toppings:[t.id]});
    chk(`${m.id} all toppings`,{menuItemId:m.id,name:m.name,price:m.price,toppings:TOPPINGS_PRICING.map(t=>t.id)});
  }
  if(m.category==="burger"){
    for(const s of mealSideOptions) for(const d of [mealDrinkOptions[0],mealDrinkOptions[mealDrinkOptions.length-1]])
      chk(`${m.id} meal ${s.id}/${d.id}`,{menuItemId:m.id,name:m.name,price:m.price,withMeal:true,mealSideId:s.id,mealDrinkId:d.id});
    chk(`${m.id} meal+topping`,{menuItemId:m.id,name:m.name,price:m.price,withMeal:true,mealSideId:"side-tempura",mealDrinkId:"drink-weiss",toppings:["roastbeef","egg"]});
  }
  if(m.category==="meal"){
    for(const s of mealSideOptions) chk(`${m.id} side ${s.id}`,{menuItemId:m.id,name:m.name,price:m.price,mealSideId:s.id,mealDrinkId:"drink-goldstar"});
  }
}
// deals as built by UI
for(const dealId of ["friends-deal","family-deal"]){
  const base = M.get(dealId)!.price;
  const prefix = dealId==="friends-deal"?"deal-":"fam-";
  const opts = DEAL_DRINKS_PRICING.filter(d=>d.id.startsWith(prefix));
  for(const d of opts){
    const drinks=[{id:d.id,extraCost:d.price}];
    const extra=d.price;
    chk(`${dealId} drink ${d.id}`,{menuItemId:dealId,name:dealId,price:base+extra,dealDrinks:drinks,dealBurgers:[{name:"קלאסי",toppings:["egg"]}]});
  }
}
// mealSideOptions/mealDrinkOptions parity with server lists
for(const s of mealSideOptions){ const x=S[s.id]; if(!x) problems.push(`side missing server: ${s.id}`); else if(x.price!==s.price) problems.push(`side price ${s.id}: ui ${s.price} srv ${x.price}`);}
for(const d of mealDrinkOptions){ const x=D[d.id]; if(!x) problems.push(`mealdrink missing server: ${d.id}`); else if(x.price!==d.price) problems.push(`mealdrink price ${d.id}: ui ${d.price} srv ${x.price}`);}
for(const d of dealDrinkOptions){ const x=DD[d.id]; if(!x) problems.push(`dealdrink missing server: ${d.id}`); else if(x.price!==d.price) problems.push(`dealdrink price ${d.id}: ui ${d.price} srv ${x.price}`);}
console.log(problems.length? problems.join("\n") : "ALL OK");
console.log("checks problems:",problems.length);
