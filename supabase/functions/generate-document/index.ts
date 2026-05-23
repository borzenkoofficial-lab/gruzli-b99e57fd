// Generate official documents: act of completed works (АКТ) or self-employed receipt (ЧЕК)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import {
  FONT_REGULAR_URL, FONT_BOLD_URL, loadFontBuf,
  fmtMoney, rublesToWords, fmtDate, fmtDateLong, fmtDateTime,
} from "../_shared/pdf-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;

function shortNumber(prefix: string, id: string) {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

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
    const type = String(body?.type || "");
    const job_id = String(body?.job_id || "");
    const worker_id = String(body?.worker_id || "");
    const amountInput = body?.amount != null ? Number(body.amount) : null;
    const hoursInput = body?.hours != null ? Number(body.hours) : null;

    if (!["act", "receipt"].includes(type) || !job_id || !worker_id) {
      return new Response(JSON.stringify({ error: "type, job_id, worker_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: job } = await admin.from("jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job || job.dispatcher_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: response } = await admin
      .from("job_responses").select("*")
      .eq("job_id", job_id).eq("worker_id", worker_id).maybeSingle();

    const [{ data: dispatcher }, { data: worker }] = await Promise.all([
      admin.from("profiles").select("full_name, phone, inn, is_self_employed").eq("user_id", user.id).maybeSingle(),
      admin.from("profiles").select("full_name, phone, inn, is_self_employed").eq("user_id", worker_id).maybeSingle(),
    ]);

    const hours = hoursInput ?? Number(response?.hours_worked || job?.duration_hours || 0);
    const rate = Number(job?.hourly_rate || 0);
    const amount = Math.max(0, amountInput ?? Number(response?.earned || (hours * rate) || 0));

    const docTitle = type === "act" ? "Акт выполненных работ" : "Чек самозанятого";
    const { data: docRow, error: insErr } = await admin
      .from("job_documents")
      .insert({
        job_id, dispatcher_id: user.id, worker_id, type,
        title: docTitle, amount: Math.round(amount), hours,
        metadata: {
          dispatcher_name: dispatcher?.full_name || "",
          dispatcher_inn: dispatcher?.inn || "",
          worker_name: worker?.full_name || "",
          worker_inn: worker?.inn || "",
          worker_phone: worker?.phone || "",
          job_title: job?.title || "",
        },
      })
      .select().single();
    if (insErr || !docRow) {
      return new Response(JSON.stringify({ error: insErr?.message || "DB error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const number = type === "act" ? shortNumber("АКТ", docRow.id) : shortNumber("ЧК", docRow.id);

    if (!cachedFont) cachedFont = await loadFontBuf(FONT_REGULAR_URL);
    if (!cachedBoldFont) cachedBoldFont = await loadFontBuf(FONT_BOLD_URL);

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(cachedFont!);
    const fontBold = await pdf.embedFont(cachedBoldFont!);

    let page = pdf.addPage([595, 842]);
    const { width } = page.getSize();
    const margin = 50;
    let y = 842 - margin;

    const ensureSpace = (need: number) => {
      if (y - need < margin) { page = pdf.addPage([595, 842]); y = 842 - margin; }
    };
    const drawText = (text: string, opts: any = {}) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const lineHeight = opts.lineHeight ?? size * 1.4;
      const maxWidth = opts.maxWidth ?? width - margin * 2;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);
      const align = opts.align ?? "left";
      for (const para of String(text).split("\n")) {
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
          if (usedFont.widthOfTextAtSize(test, size) > maxWidth && line) { flush(); line = w; }
          else line = test;
        }
        flush();
      }
    };
    const drawDivider = () => {
      ensureSpace(10);
      page.drawLine({
        start: { x: margin, y: y - 2 }, end: { x: width - margin, y: y - 2 },
        thickness: 0.5, color: rgb(0.75, 0.75, 0.75),
      });
      y -= 12;
    };

    if (type === "act") {
      // === АКТ ===
      drawText("АКТ", { size: 24, bold: true, align: "center" });
      drawText("выполненных работ (оказанных услуг)", { size: 11, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 4;
      drawText(`№ ${number}  от  ${fmtDateLong(new Date())}`, { size: 11, bold: true, align: "center" });
      drawText(`к договору на оказание услуг «${job.title || "Услуги"}»`, { size: 10, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 8;
      drawDivider();

      drawText(
        `Мы, нижеподписавшиеся, Заказчик — ${dispatcher?.full_name || "—"}${dispatcher?.inn ? ` (ИНН ${dispatcher.inn})` : ""}${dispatcher?.phone ? `, тел. ${dispatcher.phone}` : ""}, с одной стороны, и Исполнитель — ${worker?.full_name || "—"}${worker?.inn ? ` (ИНН ${worker.inn})` : ""}${worker?.phone ? `, тел. ${worker.phone}` : ""}${worker?.is_self_employed ? ", применяющий специальный налоговый режим «Налог на профессиональный доход»" : ""}, с другой стороны, составили настоящий акт о том, что Исполнителем выполнены, а Заказчиком приняты следующие работы (услуги):`
      );
      y -= 6;

      drawText("ПРЕДМЕТ", { size: 11, bold: true });
      drawText(`• Наименование: ${job.title || "Услуги"}`);
      if (job.address) drawText(`• Место выполнения: ${job.address}`);
      if (job.start_time) drawText(`• Дата выполнения: ${fmtDateTime(new Date(job.start_time))}`);
      drawText(`• Объём работ: ${hours} ч`);
      drawText(`• Ставка: ${fmtMoney(rate)} ₽/час`);
      y -= 4;
      drawDivider();

      drawText("СТОИМОСТЬ РАБОТ", { size: 11, bold: true });
      drawText(`${fmtMoney(amount)} ₽`, { size: 16, bold: true });
      drawText(`Сумма прописью: ${rublesToWords(amount)}.`, { size: 10, color: rgb(0.25, 0.25, 0.25) });
      drawText("НДС не облагается (Исполнитель не является плательщиком НДС).", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 6;
      drawDivider();

      drawText(
        "Работы выполнены полностью и в установленный срок. Качество работ соответствует требованиям Заказчика. Стороны взаимных претензий по объёму, качеству и срокам выполнения работ не имеют. Настоящий акт составлен в двух экземплярах, имеющих равную юридическую силу."
      );
      y -= 14;

      ensureSpace(110);
      drawText("ПОДПИСИ СТОРОН", { size: 11, bold: true });
      y -= 8;
      const colY = y;
      page.drawText("Заказчик:", { x: margin, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`${dispatcher?.full_name || "—"}`, { x: margin, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawLine({ start: { x: margin, y: colY - 40 }, end: { x: margin + 200, y: colY - 40 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("(подпись)", { x: margin, y: colY - 54, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

      const rightX = width / 2 + 10;
      page.drawText("Исполнитель:", { x: rightX, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`${worker?.full_name || "—"}`, { x: rightX, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawLine({ start: { x: rightX, y: colY - 40 }, end: { x: rightX + 200, y: colY - 40 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("(подпись)", { x: rightX, y: colY - 54, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    } else {
      // === ЧЕК самозанятого ===
      drawText("ЧЕК", { size: 28, bold: true, align: "center" });
      drawText("на оказание услуг (Налог на профессиональный доход)", {
        size: 10, align: "center", color: rgb(0.4, 0.4, 0.4),
      });
      y -= 6;
      drawText(`№ ${number}`, { size: 11, bold: true, align: "center" });
      drawText(`Дата формирования: ${fmtDateTime(new Date())}`, {
        size: 10, align: "center", color: rgb(0.4, 0.4, 0.4),
      });
      y -= 10;
      drawDivider();

      drawText("ИСПОЛНИТЕЛЬ (получатель дохода)", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${worker?.full_name || "—"}`, { size: 14, bold: true });
      if (worker?.inn) drawText(`ИНН: ${worker.inn}`, { size: 10 });
      if (worker?.phone) drawText(`Телефон: ${worker.phone}`, { size: 10 });
      drawText("Налоговый режим: НПД (плательщик налога на профессиональный доход)", {
        size: 9, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 6;

      drawText("ЗАКАЗЧИК (плательщик)", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${dispatcher?.full_name || "—"}`, { size: 12, bold: true });
      if (dispatcher?.inn) drawText(`ИНН: ${dispatcher.inn}`, { size: 10 });
      if (dispatcher?.phone) drawText(`Телефон: ${dispatcher.phone}`, { size: 10 });
      y -= 6;
      drawDivider();

      drawText("НАИМЕНОВАНИЕ УСЛУГИ", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${job.title || "Услуги по договору"}`, { size: 12, bold: true });
      if (job.address) drawText(`Место оказания: ${job.address}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      if (job.start_time) drawText(`Дата оказания: ${fmtDate(new Date(job.start_time))}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 4;

      // Calculation table
      drawText("РАСЧЁТ", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`Часов: ${hours}  ×  Ставка: ${fmtMoney(rate)} ₽`, { size: 10 });
      y -= 6;
      drawDivider();

      drawText("ИТОГО К ОПЛАТЕ", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${fmtMoney(amount)} ₽`, { size: 28, bold: true });
      drawText(`Сумма прописью: ${rublesToWords(amount)}.`, { size: 10, color: rgb(0.25, 0.25, 0.25) });
      y -= 6;
      drawDivider();

      drawText(
        "Настоящий чек подтверждает факт оказания услуг и получения дохода Исполнителем в рамках применения специального налогового режима «Налог на профессиональный доход» (Федеральный закон от 27.11.2018 № 422-ФЗ). Чек должен быть зарегистрирован в приложении «Мой налог».",
        { size: 9, color: rgb(0.35, 0.35, 0.35) }
      );
      y -= 4;
      drawText(`Идентификатор документа: ${docRow.id}`, { size: 8, color: rgb(0.55, 0.55, 0.55) });
    }

    const pdfBytes = await pdf.save();
    const path = `${docRow.id}/${type}-${Date.now()}.pdf`;
    const up = await admin.storage.from("documents").upload(path, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) {
      return new Response(JSON.stringify({ error: up.error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("job_documents").update({ pdf_path: path, number }).eq("id", docRow.id);

    const { data: signed } = await admin.storage.from("documents").createSignedUrl(path, 60 * 60);

    return new Response(
      JSON.stringify({ ok: true, document_id: docRow.id, signed_url: signed?.signedUrl, number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
