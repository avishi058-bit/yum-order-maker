import businessSignatureImg from "@/assets/business-signature.png";

/**
 * Fixed signature of the business owner, stamped automatically on every event
 * contract. Replace src/assets/business-signature.png to change it.
 */
export const BUSINESS_SIGNATURE_SRC = businessSignatureImg;

/** Convert the static signature asset into a data URL (needed for PDF + DB storage). */
export async function getBusinessSignatureDataUrl(): Promise<string> {
  const res = await fetch(BUSINESS_SIGNATURE_SRC);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
