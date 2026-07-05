import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render the contract as a Hebrew/RTL HTML block off-screen, capture with
 * html2canvas, and paginate into a jsPDF A4 document. This preserves Hebrew
 * characters (jsPDF's default fonts don't).
 */
export async function generateContractPdf(opts: {
  contractText: string;
  customerSignature: string;
  businessSignature: string;
  signedAt: string;
  clientIp: string;
  bookingId: string;
}): Promise<Blob> {
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.position = "fixed";
  container.style.top = "-10000px";
  container.style.right = "0";
  container.style.width = "794px"; // ~ A4 @ 96dpi
  container.style.padding = "40px 48px";
  container.style.background = "#ffffff";
  container.style.color = "#111";
  container.style.fontFamily =
    "'Heebo', 'Rubik', 'Arial Hebrew', 'Segoe UI', system-ui, sans-serif";
  container.style.fontSize = "15px";
  container.style.lineHeight = "1.8";

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">
      <h1 style="font-size:24px;margin:0;font-weight:800">חוזה אירוע – המבורגר הבקתה</h1>
      <div style="font-size:12px;color:#555;margin-top:4px">מספר הזמנה: ${escapeHtml(
        opts.bookingId
      )}</div>
    </div>
    <hr style="margin:16px 0;border:0;border-top:1px solid #ddd" />
    <div style="white-space:pre-wrap;text-align:right">${escapeHtml(opts.contractText)}</div>
    <div style="margin-top:24px;font-size:12px;color:#555;text-align:right">
      נחתם בתאריך: ${escapeHtml(opts.signedAt)} &nbsp;•&nbsp; IP: ${escapeHtml(opts.clientIp || "-")}
    </div>
    <div style="margin-top:24px;display:flex;justify-content:space-between;gap:24px">
      <div style="flex:1;text-align:center">
        <div style="font-weight:700;margin-bottom:4px">חתימת בעל העסק</div>
        <img src="${opts.businessSignature}" style="max-height:120px;max-width:100%;border-bottom:1px solid #999" />
      </div>
      <div style="flex:1;text-align:center">
        <div style="font-weight:700;margin-bottom:4px">חתימת לקוח</div>
        <img src="${opts.customerSignature}" style="max-height:120px;max-width:100%;border-bottom:1px solid #999" />
      </div>
    </div>
  `;

  document.body.appendChild(container);
  try {
    // Wait a tick so fonts/images settle
    await new Promise((r) => setTimeout(r, 50));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
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
