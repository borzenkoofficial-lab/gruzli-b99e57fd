// Generate official documents: act of completed works (АКТ) or self-employed receipt (ЧЕК)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;
async function loadFont(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Font load failed");
  return await r.arrayBuffer();
}

function fmtDate(d: Date) {
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtMoney(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}
function moneyToWords(amount: number): string {
  // Simplified — kopeks shown as digits. Format: "5 000 руб. 00 коп."
  const rub = Math.floor(amount);
  const kop = Math.round((amount - rub) * 100);
  return `${fmtMoney(rub)} руб. ${String(kop).padStart(2, "0")} коп.`;
}
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
      .from("job_responses")
      .select("*")
      .eq("job_id", job_id)
      .eq("worker_id", worker_id)
      .maybeSingle();

    const [{ data: dispatcher }, { data: worker }] = await Promise.all([
      admin.from("profiles").select("full_name, phone, inn, is_self_employed").eq("user_id", user.id).maybeSingle(),
      admin.from("profiles").select("full_name, phone, inn, is_self_employed").eq("user_id", worker_id).maybeSingle(),
    ]);

    const hours = hoursInput ?? Number(response?.hours_worked || job?.duration_hours || 0);
    const amount = amountInput ?? Number(response?.earned || (hours * (job?.hourly_rate || 0)));

    // Insert document row first to get an id (needed for storage path)
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
        },
      })
      .select()
      .single();
    if (insErr || !docRow) {
      return new Response(JSON.stringify({ error: insErr?.message || "DB error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const number = type === "act"
      ? shortNumber("АКТ", docRow.id)
      : shortNumber("ЧК", docRow.id);

    if (!cachedFont) cachedFont = await loadFont("https://cdn.jsdelivr.net/npm/@fontsource/pt-sans/files/pt-sans-cyrillic-400-normal.woff");
    if (!cachedBoldFont) cachedBoldFont = await loadFont("https://cdn.jsdelivr.net/npm/@fontsource/pt-sans/files/pt-sans-cyrillic-700-normal.woff");

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(cachedFont!);
    const fontBold = await pdf.embedFont(cachedBoldFont!);

    const page = pdf.addPage([595, 842]);
    const { width } = page.getSize();
    const margin = 50;
    let y = 842 - margin;

    const drawText = (text: string, opts: any = {}) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const lineHeight = opts.lineHeight ?? size * 1.4;
      const maxWidth = opts.maxWidth ?? width - margin * 2;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);
      const align = opts.align ?? "left";
      const paragraphs = String(text).split("\n");
      for (const para of paragraphs) {
        const words = para.split(" ");
        let line = "";
        const flush = () => {
          if (!line) return;
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

    const drawLine = (yOffset = 0) => {
      page.drawLine({
        start: { x: margin, y: y - yOffset },
        end: { x: width - margin, y: y - yOffset },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= yOffset + 8;
    };

    if (type === "act") {
      // === АКТ ВЫПОЛНЕННЫХ РАБОТ ===
      drawText("АКТ", { size: 22, bold: true, align: "center" });
      drawText("выполненных работ (оказанных услуг)", { size: 11, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 8;
      drawText(`№ ${number}`, { size: 11, bold: true, align: "center" });
      drawText(`от ${fmtDate(new Date())}`, { size: 10, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      drawLine();

      drawText("СТОРОНЫ", { size: 11, bold: true });
      drawText(`Заказчик: ${dispatcher?.full_name || "—"}${dispatcher?.inn ? ` (ИНН ${dispatcher.inn})` : ""}${dispatcher?.phone ? `, тел. ${dispatcher.phone}` : ""}`);
      drawText(`Исполнитель: ${worker?.full_name || "—"}${worker?.inn ? ` (ИНН ${worker.inn})` : ""}${worker?.phone ? `, тел. ${worker.phone}` : ""}${worker?.is_self_employed ? " (самозанятый)" : ""}`);
      y -= 8;
      drawLine();

      drawText("ПРЕДМЕТ", { size: 11, bold: true });
      drawText(`Настоящий акт составлен о том, что Исполнитель выполнил, а Заказчик принял следующие работы (услуги):`);
      y -= 4;
      drawText(`• ${job.title || "Работы"}${job.address ? ` по адресу: ${job.address}` : ""}`);
      if (job.start_time) drawText(`• Дата выполнения: ${fmtDateTime(new Date(job.start_time))}`);
      drawText(`• Отработано часов: ${hours}`);
      drawText(`• Ставка: ${fmtMoney(job.hourly_rate || 0)} ₽/час`);
      y -= 8;
      drawLine();

      drawText("СУММА", { size: 11, bold: true });
      drawText(`Стоимость работ: ${fmtMoney(amount)} ₽`, { size: 13, bold: true });
      drawText(`(${moneyToWords(amount)})`, { size: 10, color: rgb(0.4, 0.4, 0.4) });
      y -= 8;
      drawText("Стороны претензий друг к другу не имеют. Работы выполнены полностью и в срок, качество соответствует требованиям Заказчика.");
      y -= 16;
      drawLine();

      drawText("ПОДПИСИ СТОРОН", { size: 11, bold: true });
      y -= 10;
      const colY = y;
      // Left column — dispatcher
      page.drawText("Заказчик:", { x: margin, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`${dispatcher?.full_name || "—"}`, { x: margin, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawLine({ start: { x: margin, y: colY - 36 }, end: { x: margin + 180, y: colY - 36 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("(подпись)", { x: margin, y: colY - 50, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      // Right column — worker
      const rightX = width / 2 + 10;
      page.drawText("Исполнитель:", { x: rightX, y: colY, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`${worker?.full_name || "—"}`, { x: rightX, y: colY - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      page.drawLine({ start: { x: rightX, y: colY - 36 }, end: { x: rightX + 180, y: colY - 36 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("(подпись)", { x: rightX, y: colY - 50, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    } else {
      // === ЧЕК самозанятого (формат как в "Мой налог") ===
      drawText("ЧЕК", { size: 26, bold: true, align: "center" });
      drawText("на оказание услуг", { size: 11, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 6;
      drawText(`№ ${number}`, { size: 10, align: "center" });
      drawText(`Дата формирования: ${fmtDateTime(new Date())}`, { size: 10, align: "center", color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      drawLine();

      drawText("Исполнитель", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${worker?.full_name || "—"}`, { size: 13, bold: true });
      if (worker?.inn) drawText(`ИНН: ${worker.inn}`, { size: 10 });
      if (worker?.is_self_employed) drawText("Налоговый режим: НПД (самозанятый)", { size: 10, color: rgb(0.4, 0.4, 0.4) });
      y -= 8;

      drawText("Заказчик", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${dispatcher?.full_name || "—"}`, { size: 12, bold: true });
      if (dispatcher?.inn) drawText(`ИНН: ${dispatcher.inn}`, { size: 10 });
      y -= 8;
      drawLine();

      drawText("НАИМЕНОВАНИЕ УСЛУГИ", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${job.title || "Услуги по договору"}`);
      if (job.address) drawText(`Место оказания: ${job.address}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`Часов: ${hours} × ${fmtMoney(job.hourly_rate || 0)} ₽`, { size: 10, color: rgb(0.4, 0.4, 0.4) });
      y -= 10;
      drawLine();

      drawText("ИТОГО", { size: 9, color: rgb(0.4, 0.4, 0.4) });
      drawText(`${fmtMoney(amount)} ₽`, { size: 24, bold: true });
      drawText(`(${moneyToWords(amount)})`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      drawLine();

      drawText("Чек подтверждает факт оказания услуг и получения дохода исполнителем.", {
        size: 9, color: rgb(0.4, 0.4, 0.4),
      });
      drawText(`ID документа: ${docRow.id}`, { size: 8, color: rgb(0.55, 0.55, 0.55) });
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
