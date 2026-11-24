// Z-Credit rejects the whole payment page ("Input Error - Parameter
// 'AdditionalText'") when the customer's name has a geresh or quote mark
// (ג׳ני, Ma'ayan). Only what is sent to Z-Credit is cleaned - the order,
// the kitchen and the receipt keep the name exactly as typed.
const QUOTES = /[׳״'"`‘’“”´]/g;

export const zcreditSafeText = (text: string | null | undefined): string =>
  String(text ?? "").replace(QUOTES, "").replace(/\s+/g, " ").trim();
