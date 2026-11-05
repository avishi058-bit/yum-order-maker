// Edge deployment cannot import src files. Keep the single pure implementation
// in the deployable shared directory and expose it here to the browser.
export { CUSTOMER_NAME_BLOCKLIST, CELEBRITY_NAMES, CUSTOMER_NAME_MESSAGE, CUSTOMER_NAME_REPEAT_MESSAGE, STAFF_NAME_MESSAGE, cleanCustomerName, normalizeBlockedName, validateCustomerName } from "../../supabase/functions/_shared/nameValidation";