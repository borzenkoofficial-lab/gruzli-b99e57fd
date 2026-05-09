// Generate contract PDF preview for dispatcher (unsigned or with optional worker)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

let cachedFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;

async function loadFont(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch font");
  return await r.arrayBuffer();
}

function fmtDate(d: Date) {
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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
    const { data: dispatcher } = await admin.from("profiles").select("full_name, phone").eq("user_id", contract.dispatcher_id).maybeSingle();

    let workerProfile: any = null;
    let signatureBytes: Uint8Array | null = null;
    let signedAt: string | null = null;
    if (worker_id) {
      const { data: wp } = await admin.from("profiles").select("full_name, phone").eq("user_id", worker_id).maybeSingle();
      workerProfile = wp;
      const { data: sig } = await admin
        .from("contract_signatures")
        .select("*")
        .eq("contract_id", contract_id)
        .eq("worker_id", worker_id)
        .maybeSingle();
      if (sig?.signature_url) {
        const dl = await admin.storage.from("contracts").download(sig.signature_url);
        if (dl.data) signatureBytes = new Uint8Array(await dl.data.arrayBuffer());
        signedAt = sig.signed_at;
      }
    }

    if (!cachedFont) cachedFont = await loadFont("https://cdn.jsdelivr.net/npm/@fontsource/pt-sans/files/pt-sans-cyrillic-400-normal.woff");
    if (!cachedBoldFont) cachedBoldFont = await loadFont("https://cdn.jsdelivr.net/npm/@fontsource/pt-sans/files/pt-sans-cyrillic-700-normal.woff");

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(cachedFont!);
    const fontBold = await pdf.embedFont(cachedBoldFont!);
    const sigImage = signatureBytes ? await pdf.embedPng(signatureBytes) : null;

    const page = pdf.addPage([595, 842]);
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const drawText = (text: string, opts: any = {}) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const lineHeight = opts.lineHeight ?? size * 1.4;
      const maxWidth = opts.maxWidth ?? width - margin * 2;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);
      const paragraphs = String(text).split("\n");
      for (const para of paragraphs) {
        const words = para.split(" ");
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (usedFont.widthOfTextAtSize(test, size) > maxWidth && line) {
            page.drawText(line, { x: margin, y, size, font: usedFont, color });
            y -= lineHeight; line = w;
          } else line = test;
        }
        if (line) {
          page.drawText(line, { x: margin, y, size, font: usedFont, color });
          y -= lineHeight;
        }
      }
    };

    drawText(contract.title || "Договор подряда", { size: 18, bold: true });
    y -= 6;
    drawText(`№ ${contract.id.slice(0, 8).toUpperCase()} от ${fmtDate(new Date(contract.created_at))}`, {
      size: 9, color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;

    drawText("СТОРОНЫ", { size: 11, bold: true });
    drawText(`Заказчик: ${dispatcher?.full_name || "—"}${dispatcher?.phone ? `, тел. ${dispatcher.phone}` : ""}`);
    drawText(`Исполнитель: ${workerProfile?.full_name || "(не указан)"}${workerProfile?.phone ? `, тел. ${workerProfile.phone}` : ""}`);
    y -= 8;

    drawText("ПРЕДМЕТ ДОГОВОРА", { size: 11, bold: true });
    drawText(`Объект работ: ${job?.title || "—"}`);
    if (job?.address) drawText(`Адрес: ${job.address}`);
    if (job?.start_time) drawText(`Дата и время: ${fmtDate(new Date(job.start_time))}`);
    if (job?.duration_hours) drawText(`Длительность: ${job.duration_hours} ч`);
    if (job?.hourly_rate) drawText(`Ставка: ${job.hourly_rate} ₽/час`);
    y -= 8;

    if (contract.body) {
      drawText("УСЛОВИЯ", { size: 11, bold: true });
      drawText(contract.body);
      y -= 8;
    }

    drawText("ПОДПИСИ СТОРОН", { size: 11, bold: true });
    y -= 6;
    if (sigImage) {
      const sigDims = sigImage.scale(0.35);
      const scale = Math.min(1, 180 / sigDims.width);
      const sw = sigDims.width * scale; const sh = sigDims.height * scale;
      page.drawImage(sigImage, { x: margin, y: y - sh, width: sw, height: sh });
      y -= sh + 6;
      drawText(`Исполнитель: ${workerProfile?.full_name || "—"}`, { size: 10 });
      if (signedAt) drawText(`Подписано: ${fmtDate(new Date(signedAt))}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
    } else {
      drawText("Исполнитель: ___________________________  (подпись)", { size: 10 });
      y -= 4;
    }
    y -= 10;
    drawText(`Заказчик: ${dispatcher?.full_name || "—"} (подтверждено выпуском договора)`, { size: 10 });

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
