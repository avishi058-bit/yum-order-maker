/**
 * Runtime feature flags — temporary toggles for the soft-launch period.
 *
 * IMPORTANT: We are NOT removing any auth/OTP feature. Each flag below is a
 * single switch that bypasses behavior. Flip back to restore originals.
 */

export const RUNTIME_FLAGS = {
  /**
   * Website checkout: when true, skip the WhatsApp OTP step entirely.
   * Customer still enters name + phone (both required), and goes directly
   * to the payment step. Set to `false` to re-enable OTP verification.
   */
  WEBSITE_SKIP_OTP: true,

  /**
   * Kiosk checkout: when true, do NOT collect a phone number on the kiosk.
   * Orders are placed with the customer name only. Set to `false` to
   * restore the phone field in the kiosk flow.
   */
  KIOSK_SKIP_PHONE: true,

  /**
   * Show "תשלום בקופה בעסק" (pay at counter) as an additional payment
   * method, alongside cash and credit. The order is sent to the kitchen
   * immediately and the customer pays physically at the counter.
   */
  ENABLE_PAY_AT_COUNTER: true,
} as const;
