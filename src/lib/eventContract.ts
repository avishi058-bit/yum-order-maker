import jsPDF from "jspdf";

export interface ContractData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  event_address: string;
  guests_count: number;
  package_name: string;
  package_price: number;
  addons_list: string;
  total_price: number;
}

export function fillTemplate(template: string, data: ContractData): string {
  const map: Record<string, string> = {
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    customer_email: data.customer_email,
    event_type: data.event_type,
    event_date: data.event_date,
    start_time: data.start_time,
    end_time: data.end_time,
    event_address: data.event_address,
    guests_count: String(data.guests_count),
    package_name: data.package_name,
    package_price: String(data.package_price),
    addons_list: data.addons_list || "ללא",
    total_price: String(data.total_price),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? "");
}

export async function generateContractPdf(opts: {
  contractText: string;
  customerSignature: string;
  businessSignature: string;
  signedAt: string;
  clientIp: string;
  bookingId: string;
}): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;

  // Simple RTL: reverse each line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.setFontSize(14);
  doc.text("Event Contract / חוזה אירוע", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Booking ID: ${opts.bookingId}`, pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(11);
  const lines = opts.contractText.split("\n");
  let y = 32;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    for (const w of wrapped) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.text(w, pageWidth - margin, y, { align: "right" });
      y += 6;
    }
  }

  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  y += 6;
  doc.setFontSize(10);
  doc.text(`Signed at: ${opts.signedAt}   IP: ${opts.clientIp}`, pageWidth - margin, y, { align: "right" });
  y += 10;

  doc.text("Customer signature:", pageWidth - margin, y, { align: "right" });
  doc.text("Business signature:", margin, y);
  y += 3;
  try {
    doc.addImage(opts.customerSignature, "PNG", pageWidth - margin - 70, y, 70, 30);
  } catch { /* ignore */ }
  try {
    doc.addImage(opts.businessSignature, "PNG", margin, y, 70, 30);
  } catch { /* ignore */ }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function fetchClientIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const j = await res.json();
    return j.ip || "";
  } catch {
    return "";
  }
}
