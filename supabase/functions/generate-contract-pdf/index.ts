// Generate signed contract PDF (cyrillic) using pdf-lib + fontkit
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // user-scoped client to verify identity
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contract_id = String(body?.contract_id || "");
    const signature_path = String(body?.signature_path || "");
    if (!contract_id || !signature_path) {
      return new Response(JSON.stringify({ error: "contract_id and signature_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load contract + job + profiles
    const { data: contract, error: cErr } = await admin
      .from("job_contracts")
      .select("*")
      .eq("id", contract_id)
      .maybeSingle();
    if (cErr || !contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify this user is an accepted worker on the job
    const { data: resp } = await admin
      .from("job_responses")
      .select("id, status")
      .eq("job_id", contract.job_id)
      .eq("worker_id", user.id)
      .maybeSingle();
    if (!resp || resp.status !== "accepted") {
      return new Response(JSON.stringify({ error: "Not an accepted worker for this job" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await admin.from("jobs").select("*").eq("id", contract.job_id).maybeSingle();
    const { data: dispatcher } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", contract.dispatcher_id)
      .maybeSingle();
    const { data: workerProfile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    // Download signature
    const sigDl = await admin.storage.from("contracts").download(signature_path);
    if (sigDl.error || !sigDl.data) {
      return new Response(JSON.stringify({ error: "Signature file not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigBytes = new Uint8Array(await sigDl.data.arrayBuffer());

    // Load fonts (cached)
    if (!cachedFont) {
      cachedFont = await loadFont(
        "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.ttf"
      );
    }
    if (!cachedBoldFont) {
      cachedBoldFont = await loadFont(
        "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf"
      );
    }

    // Build PDF
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(cachedFont!);
    const fontBold = await pdf.embedFont(cachedBoldFont!);
    const sigImage = await pdf.embedPng(sigBytes);

    const page = pdf.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const drawText = (text: string, opts: { size?: number; bold?: boolean; color?: any; lineHeight?: number; maxWidth?: number } = {}) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const lineHeight = opts.lineHeight ?? size * 1.4;
      const maxWidth = opts.maxWidth ?? width - margin * 2;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);

      // Word wrap
      const paragraphs = String(text).split("\n");
      for (const para of paragraphs) {
        const words = para.split(" ");
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          const wWidth = usedFont.widthOfTextAtSize(test, size);
          if (wWidth > maxWidth && line) {
            page.drawText(line, { x: margin, y, size, font: usedFont, color });
            y -= lineHeight;
            line = w;
          } else {
            line = test;
          }
        }
        if (line) {
          page.drawText(line, { x: margin, y, size, font: usedFont, color });
          y -= lineHeight;
        }
      }
    };

    // Header
    drawText(contract.title || "Договор подряда", { size: 18, bold: true });
    y -= 6;
    drawText(`№ ${contract.id.slice(0, 8).toUpperCase()} от ${fmtDate(new Date(contract.created_at))}`, {
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;

    // Parties
    drawText("СТОРОНЫ", { size: 11, bold: true });
    drawText(`Заказчик: ${dispatcher?.full_name || "—"}${dispatcher?.phone ? `, тел. ${dispatcher.phone}` : ""}`);
    drawText(`Исполнитель: ${workerProfile?.full_name || "—"}${workerProfile?.phone ? `, тел. ${workerProfile.phone}` : ""}`);
    y -= 8;

    // Job details
    drawText("ПРЕДМЕТ ДОГОВОРА", { size: 11, bold: true });
    drawText(`Объект работ: ${job?.title || "—"}`);
    if (job?.address) drawText(`Адрес: ${job.address}`);
    if (job?.start_time) drawText(`Дата и время: ${fmtDate(new Date(job.start_time))}`);
    if (job?.duration_hours) drawText(`Длительность: ${job.duration_hours} ч`);
    if (job?.hourly_rate) drawText(`Ставка: ${job.hourly_rate} ₽/час`);
    y -= 8;

    // Body
    if (contract.body) {
      drawText("УСЛОВИЯ", { size: 11, bold: true });
      drawText(contract.body);
      y -= 8;
    }

    // Signatures section
    if (y < 220) {
      // new page if no room
      const np = pdf.addPage([595, 842]);
      page.drawText("", { x: 0, y: 0 });
      // continue on new page handled crudely: redraw signatures on np
      const ny = np.getHeight() - margin;
      np.drawText("ПОДПИСИ СТОРОН", { x: margin, y: ny, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      // Worker sig image
      const sigDims = sigImage.scale(0.35);
      const maxW = 180;
      const scale = Math.min(1, maxW / sigDims.width);
      const sw = sigDims.width * scale;
      const sh = sigDims.height * scale;
      np.drawImage(sigImage, { x: margin, y: ny - 80, width: sw, height: sh });
      np.drawText(`Исполнитель: ${workerProfile?.full_name || "—"}`, {
        x: margin, y: ny - 100, size: 10, font, color: rgb(0.1, 0.1, 0.1),
      });
      np.drawText(`Подписано: ${fmtDate(new Date())}`, {
        x: margin, y: ny - 115, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
      np.drawText(`Заказчик: ${dispatcher?.full_name || "—"} (подтверждено выпуском договора)`, {
        x: margin, y: ny - 145, size: 10, font, color: rgb(0.1, 0.1, 0.1),
      });
    } else {
      drawText("ПОДПИСИ СТОРОН", { size: 11, bold: true });
      y -= 6;
      const sigDims = sigImage.scale(0.35);
      const maxW = 180;
      const scale = Math.min(1, maxW / sigDims.width);
      const sw = sigDims.width * scale;
      const sh = sigDims.height * scale;
      page.drawImage(sigImage, { x: margin, y: y - sh, width: sw, height: sh });
      y -= sh + 6;
      drawText(`Исполнитель: ${workerProfile?.full_name || "—"}`, { size: 10 });
      drawText(`Подписано: ${fmtDate(new Date())}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 10;
      drawText(`Заказчик: ${dispatcher?.full_name || "—"} (подтверждено выпуском договора)`, { size: 10 });
    }

    const pdfBytes = await pdf.save();

    const pdfPath = `${contract_id}/signed-${user.id}-${Date.now()}.pdf`;
    const up = await admin.storage.from("contracts").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) {
      return new Response(JSON.stringify({ error: up.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    await admin.from("contract_signatures").upsert(
      {
        contract_id,
        worker_id: user.id,
        signature_url: signature_path,
        signed_pdf_url: pdfPath,
        signed_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: ua,
      },
      { onConflict: "contract_id,worker_id" }
    );

    // Return signed URL
    const { data: signedUrl } = await admin.storage
      .from("contracts")
      .createSignedUrl(pdfPath, 60 * 60);

    return new Response(
      JSON.stringify({ ok: true, pdf_path: pdfPath, signed_url: signedUrl?.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
