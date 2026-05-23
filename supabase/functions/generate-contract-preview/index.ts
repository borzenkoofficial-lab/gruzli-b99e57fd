// Generate contract PDF preview for dispatcher (unsigned or with optional worker)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import {
  FONT_REGULAR_URL, FONT_BOLD_URL, loadFontBuf,
  fmtMoney, rublesToWords, fmtDate, fmtDateLong, buildLegalContractBody,
} from "../_shared/pdf-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contract_id = String(body?.contract_id || "");
    const worker_id: string | null = body?.worker_id ? String(body.worker_id) : null;
    if (!contract_id) {
      return new Response(JSON.stringify({ error: "contract_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: contract } = await admin.from("job_contracts").select("*").eq("id", contract_id).maybeSingle();
    if (!contract) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (contract.dispatcher_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await admin.from("jobs").select("*").eq("id", contract.job_id).maybeSingle();
    const { data: dispatcher } = await admin.from("profiles")
      .select("full_name, phone, inn").eq("user_id", contract.dispatcher_id).maybeSingle();

    let workerProfile: any = null;
    let signatureBytes: Uint8Array | null = null;
    let signedAt: string | null = null;
    let workerResp: any = null;
    if (worker_id) {
      const { data: wp } = await admin.from("profiles")
        .select("full_name, phone, inn, is_self_employed").eq("user_id", worker_id).maybeSingle();
      workerProfile = wp;
      const { data: wr } = await admin.from("job_responses")
        .select("hours_worked, earned").eq("job_id", contract.job_id).eq("worker_id", worker_id).maybeSingle();
      workerResp = wr;
      const { data: sig } = await admin.from("contract_signatures").select("*")
        .eq("contract_id", contract_id).eq("worker_id", worker_id).maybeSingle();
      if (sig?.signature_url) {
        const dl = await admin.storage.from("contracts").download(sig.signature_url);
        if (dl.data) signatureBytes = new Uint8Array(await dl.data.arrayBuffer());
        signedAt = sig.signed_at;
      }
    }

    const hours = Number(workerResp?.hours_worked || job?.duration_hours || 0);
    const amount = Number(workerResp?.earned || (hours * (job?.hourly_rate || 0)) || 0);

    if (!cachedFont) cachedFont = await loadFontBuf(FONT_REGULAR_URL);
    if (!cachedBoldFont) cachedBoldFont = await loadFontBuf(FONT_BOLD_URL);

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(cachedFont!);
    const fontBold = await pdf.embedFont(cachedBoldFont!);
    const sigImage = signatureBytes ? await pdf.embedPng(signatureBytes) : null;

    let page = pdf.addPage([595, 842]);
    const { width } = page.getSize();
    const margin = 50;
    let y = 842 - margin;

    const ensureSpace = (need: number) => {
      if (y - need < margin) { page = pdf.addPage([595, 842]); y = 842 - margin; }
    };

    const drawText = (text: string, opts: any = {}) => {
      const size = opts.size ?? 10.5;
      const usedFont = opts.bold ? fontBold : font;
      const lineHeight = opts.lineHeight ?? size * 1.45;
      const maxWidth = opts.maxWidth ?? width - margin * 2;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);
      const align = opts.align ?? "left";
      const paragraphs = String(text).split("\n");
      for (const para of paragraphs) {
        if (!para.trim()) { y -= lineHeight * 0.5; continue; }
        const words = para.split(" ");
        let line = "";
        const flush = () => {
          if (!line) return;
          ensureSpace(lineHeight);
          const w = usedFont.widthOfTextAtSize(line, size);
          const x = align === "center" ? (width - w) / 2 : margin;
          page.drawText(line, { x, y, size, font: usedFont, color });
          y -= lineHeight;
        };
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (usedFont.widthOfTextAtSize(test, size) > maxWidth && line) {
            flush(); line = w;
          } else line = test;
        }
        flush();
      }
    };

    drawText("ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ", { size: 15, bold: true, align: "center" });
    drawText(`№ ${contract.id.slice(0, 8).toUpperCase()}`, { size: 11, bold: true, align: "center" });
    drawText(fmtDateLong(new Date(contract.created_at)), {
      size: 10, align: "center", color: rgb(0.35, 0.35, 0.35),
    });
    y -= 10;

    drawText(
      `Гражданин(ка) ${dispatcher?.full_name || "—"}${dispatcher?.phone ? `, контактный телефон ${dispatcher.phone}` : ""}${dispatcher?.inn ? `, ИНН ${dispatcher.inn}` : ""}, именуемый(ая) в дальнейшем «Заказчик», с одной стороны, и ${workerProfile?.full_name ? `гражданин(ка) ${workerProfile.full_name}${workerProfile?.phone ? `, контактный телефон ${workerProfile.phone}` : ""}${workerProfile?.inn ? `, ИНН ${workerProfile.inn}` : ""}${workerProfile?.is_self_employed ? ", применяющий(ая) специальный налоговый режим «Налог на профессиональный доход»" : ""}` : "Исполнитель (будет указан при подписании)"}, именуемый(ая) в дальнейшем «Исполнитель», с другой стороны, заключили настоящий договор о нижеследующем:`
    );
    y -= 10;

    const legalBody = buildLegalContractBody({
      jobTitle: job?.title || contract.title || "Услуги",
      jobAddress: job?.address || undefined,
      startTime: job?.start_time || undefined,
      durationHours: job?.duration_hours || undefined,
      hourlyRate: job?.hourly_rate || undefined,
      amount, hours,
      dispatcherName: dispatcher?.full_name || "",
      workerName: workerProfile?.full_name || "",
      customBody: contract.body || undefined,
    });

    for (const ln of legalBody.split("\n")) {
      if (/^\d+\.\s+[А-ЯЁ]/.test(ln)) { y -= 4; drawText(ln, { size: 11, bold: true }); }
      else drawText(ln);
    }
    y -= 14;

    ensureSpace(160);
    drawText("ПОДПИСИ СТОРОН", { size: 11, bold: true });
    y -= 6;
    const colY = y;

    page.drawText("Заказчик:", { x: margin, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`${dispatcher?.full_name || "—"}`, { x: margin, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawLine({ start: { x: margin, y: colY - 56 }, end: { x: margin + 200, y: colY - 56 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    page.drawText("(подпись)", { x: margin, y: colY - 70, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

    const rightX = width / 2 + 10;
    page.drawText("Исполнитель:", { x: rightX, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`${workerProfile?.full_name || "(не указан)"}`, { x: rightX, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    if (sigImage) {
      const sd = sigImage.scale(0.35);
      const s = Math.min(1, 200 / sd.width);
      const sw = sd.width * s; const sh = Math.min(60, sd.height * s);
      page.drawImage(sigImage, { x: rightX, y: colY - 56 - sh + 14, width: sw, height: sh });
      if (signedAt) page.drawText(`Подписано: ${fmtDate(new Date(signedAt))}`, { x: rightX, y: colY - 32, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    }
    page.drawLine({ start: { x: rightX, y: colY - 56 }, end: { x: rightX + 200, y: colY - 56 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    page.drawText("(подпись)", { x: rightX, y: colY - 70, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

    y = colY - 90;
    y -= 10;
    drawText(`Итоговая сумма по договору: ${fmtMoney(amount)} ₽ (${rublesToWords(amount)})`, {
      size: 10, bold: true,
    });

    const pdfBytes = await pdf.save();
    const path = `${contract_id}/preview-${worker_id || "blank"}-${Date.now()}.pdf`;
    const up = await admin.storage.from("contracts").upload(path, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) {
      return new Response(JSON.stringify({ error: up.error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: signed } = await admin.storage.from("contracts").createSignedUrl(path, 60 * 60);
    return new Response(JSON.stringify({ ok: true, signed_url: signed?.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
