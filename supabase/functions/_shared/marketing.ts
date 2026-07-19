// Marketing message compliance helpers — Israeli Spam Law (חוק התקשורת תיקון 40).
//
// Any WhatsApp/SMS/email message that qualifies as "דבר פרסומת" MUST:
//   1. Start with the word "פרסומת" clearly visible.
//   2. Include the sender's identity ("הבקתה").
//   3. Include a one-click, no-login-required unsubscribe mechanism —
//      currently: https://yum-order-maker.lovable.app/unsubscribe?phone=<phone>
//   4. Only be sent to customers whose `customers.marketing_consent = true`,
//      recorded via a granted `consent_events` row.
//
// Any new edge function that sends marketing content must import
// `buildMarketingBody` from this file and never hand-roll the wrapper.
// Transactional messages (order status, OTP, reopen alerts) are NOT
// "דבר פרסומת" and do not go through this helper.

const UNSUBSCRIBE_BASE = 'https://yum-order-maker.lovable.app/unsubscribe'
const SENDER_NAME = 'הבקתה'

export function buildMarketingBody(opts: {
  phone: string           // recipient phone in local Israeli format (05XXXXXXXX)
  message: string         // the raw marketing text
}): string {
  const unsub = `${UNSUBSCRIBE_BASE}?phone=${encodeURIComponent(opts.phone)}`
  return [
    'פרסומת',
    '',
    opts.message.trim(),
    '',
    `— ${SENDER_NAME}`,
    `להסרה מרשימת התפוצה: ${unsub}`,
  ].join('\n')
}

// Guard used at send-time. Returns customers eligible to receive marketing.
// Do NOT bypass this check.
export async function loadMarketingRecipients(
  supabase: any,
  phones?: string[],
): Promise<Array<{ id: string; phone: string; name: string | null }>> {
  let q = supabase
    .from('customers')
    .select('id, phone, name')
    .eq('marketing_consent', true)
  if (phones && phones.length > 0) q = q.in('phone', phones)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Array<{ id: string; phone: string; name: string | null }>
}
