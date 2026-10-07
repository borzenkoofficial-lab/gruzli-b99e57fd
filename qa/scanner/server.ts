import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import type {
  QaAiConfig,
  QaCapture,
  QaFinding,
  QaRole,
  QaScanConfig,
  QaScanReport,
  QaViewport,
} from "./types";

const PORT = Number(process.env.QA_PORT || 4174);
const DEFAULT_BASE_URL = process.env.QA_BASE_URL || "http://127.0.0.1:4173";

const safeText = (value: string) => value.replace(/\\s+/g, " ").trim();
const slug = (value: string) =>
  safeText(value).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "surface";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(res: any, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function parseAiJson(content: string): QaFinding[] {
  const cleaned = content.replace(/^﻿/, "").trim().replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function analyzeWithAi(
  ai: QaAiConfig,
  capture: QaCapture,
  role: QaRole,
  viewport: QaViewport,
): Promise<QaFinding[]> {
  if (!ai.apiKey || !ai.endpoint || !ai.model) return [];

  const prompt = [
    "Ты senior QA/UI reviewer для web marketplace Gruzli.",
    "Анализируй только то, что подтверждено screenshot и telemetry.",
    "Не выдумывай бизнес-правила. Не называй нормальный пустой экран ошибкой без доказательства.",
    "Особенно ищи: кривый layout, overlap, overflow, обрезанный текст, несогласованные кнопки/отступы, dead-end UX, runtime/network evidence.",
    "Верни ТОЛЬКО JSON-массив. Каждый объект: severity(critical|high|medium|low), category(functional|runtime|visual|ux|responsive|accessibility), title, description, confidence(0..1).",
    "Если проблем нет — верни [].",
    "",
    JSON.stringify({
      role,
      viewport,
      surface: capture.surface,
      action: capture.action,
      url: capture.url,
      consoleErrors: capture.consoleErrors,
      networkErrors: capture.networkErrors,
      geometryIssues: capture.geometryIssues,
      buttons: capture.domSummary.buttons.slice(0, 30),
      links: capture.domSummary.links.slice(0, 30),
      headings: capture.domSummary.headings.slice(0, 15),
      bodyText: capture.domSummary.bodyText.slice(0, 5000),
    }),
  ].join("\n");

  const response = await fetch(ai.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Отвечай только JSON без markdown." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${capture.screenshotBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI request failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const payload = await response.json() as any;
  const content = String(payload?.choices?.[0]?.message?.content || "");
  return parseAiJson(content).map((finding) => ({
    ...finding,
    role,
    viewport,
    surface: capture.surface,
    url: capture.url,
    action: capture.action,
    evidence: {
      screenshot: capture.screenshotFile,
      console: capture.consoleErrors,
      network: capture.networkErrors,
    },
  }));
}

async function collectDom(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const s = getComputedStyle(el as HTMLElement);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const label = (el: Element) => {
      const html = el as HTMLElement;
      return (
        html.getAttribute("aria-label") ||
        html.textContent ||
        html.getAttribute("title") ||
        (html as HTMLInputElement).placeholder ||
        ""
      ).replace(/\s+/g, " ").trim();
    };

    const buttons = Array.from(document.querySelectorAll("button,[role='button']")).filter(visible).map(label).filter(Boolean);
    const links = Array.from(document.querySelectorAll("a")).filter(visible).map(label).filter(Boolean);
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5")).filter(visible).map(label).filter(Boolean);

    const body = document.body;
    const geometryIssues: string[] = [];
    if (body.scrollWidth > window.innerWidth + 4) {
      geometryIssues.push(`Horizontal overflow: body scrollWidth=${body.scrollWidth}, viewport=${window.innerWidth}`);
    }

    for (const el of Array.from(document.querySelectorAll("button,input,textarea,select,[role='button']")).filter(visible)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.right > window.innerWidth + 2 || r.left < -2 || r.bottom > window.innerHeight + 2) {
        const text = label(el).slice(0, 60);
        geometryIssues.push(`Interactive element outside viewport: "${text}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}]`);
      }
      if ((el.tagName === "BUTTON" || el.getAttribute("role") === "button") && (r.width < 24 || r.height < 24)) {
        geometryIssues.push(`Small interactive target: "${label(el).slice(0, 60)}" size=${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }

    const text = Array.from(document.body.querySelectorAll("*"))
      .filter((el) => visible(el) && el.children.length === 0)
      .map((el) => label(el))
      .filter(Boolean)
      .slice(0, 250)
      .join(" | ");

    return {
      buttons: Array.from(new Set(buttons)),
      links: Array.from(new Set(links)),
      headings: Array.from(new Set(headings)),
      bodyText: text,
      geometryIssues: Array.from(new Set(geometryIssues)).slice(0, 40),
    };
  });
}

function isSafeAction(label: string) {
  const value = label.toLowerCase();
  const blocked = [
    "выйти", "удалить", "отменить", "закрыть", "отклонить", "принять",
    "купить", "оплатить", "подтвердить", "подписать", "отправить",
    "удалить аккаунт", "заблокировать",
  ];
  return !blocked.some((token) => value.includes(token)) && value.length > 0;
}

async function captureState(
  page: Page,
  role: QaRole,
  viewport: QaViewport,
  surface: string,
  action: string,
  runDir: string,
  errors: { console: string[]; network: string[] },
): Promise<QaCapture> {
  const dom = await collectDom(page);
  const fileName = `${role}-${viewport.name}-${slug(surface)}-${String(Date.now())}.png`;
  const absolute = join(runDir, fileName);
  const buffer = await page.screenshot({ type: "png" });
  await writeFile(absolute, buffer);

  return {
    role,
    viewport,
    surface,
    action,
    url: page.url(),
    screenshotBase64: buffer.toString("base64"),
    screenshotFile: absolute,
    consoleErrors: [...errors.console],
    networkErrors: [...errors.network],
    domSummary: {
      buttons: dom.buttons,
      links: dom.links,
      headings: dom.headings,
      bodyText: dom.bodyText,
    },
    geometryIssues: dom.geometryIssues,
  };
}

async function addDeterministicFindings(capture: QaCapture): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];
  for (const issue of capture.geometryIssues) {
    findings.push({
      severity: issue.startsWith("Horizontal overflow") ? "high" : "medium",
      category: issue.startsWith("Horizontal overflow") ? "responsive" : "visual",
      title: issue.startsWith("Horizontal overflow") ? "Горизонтальный overflow" : "Проблема геометрии интерфейса",
      description: issue,
      confidence: 1,
      role: capture.role,
      viewport: capture.viewport,
      surface: capture.surface,
      url: capture.url,
      action: capture.action,
      evidence: { screenshot: capture.screenshotFile, console: capture.consoleErrors, network: capture.networkErrors },
    });
  }
  for (const error of capture.consoleErrors) {
    findings.push({
      severity: "high",
      category: "runtime",
      title: "Console error",
      description: error,
      confidence: 1,
      role: capture.role,
      viewport: capture.viewport,
      surface: capture.surface,
      url: capture.url,
      action: capture.action,
      evidence: { screenshot: capture.screenshotFile, console: capture.consoleErrors, network: capture.networkErrors },
    });
  }
  for (const error of capture.networkErrors) {
    findings.push({
      severity: "high",
      category: "runtime",
      title: "Network error",
      description: error,
      confidence: 1,
      role: capture.role,
      viewport: capture.viewport,
      surface: capture.surface,
      url: capture.url,
      action: capture.action,
      evidence: { screenshot: capture.screenshotFile, console: capture.consoleErrors, network: capture.networkErrors },
    });
  }
  return findings;
}

async function runForRoleViewport(
  browser: any,
  config: QaScanConfig,
  role: QaRole,
  viewport: QaViewport,
  runDir: string,
): Promise<{ captures: QaCapture[]; findings: QaFinding[] }> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "ru-RU",
    colorScheme: "light",
    deviceScaleFactor: 1,
  });

  await context.addInitScript(({ role }) => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", role);
    localStorage.setItem("onboarding_completed", "1");
  }, { role });

  const page = await context.newPage();
  const captures: QaCapture[] = [];
  const findings: QaFinding[] = [];

  const errors = { console: [] as string[], network: [] as string[] };
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.console.push(msg.text());
  });
  page.on("pageerror", (error) => errors.console.push(`PAGEERROR: ${error.message}`));
  page.on("requestfailed", (request) => errors.network.push(`REQUESTFAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.network.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
  });

  const visit = async (surface: string, action: string) => {
    await sleep(350);
    const capture = await captureState(page, role, viewport, surface, action, runDir, errors);
    captures.push(capture);
    findings.push(...await addDeterministicFindings(capture));
  };

  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await visit("Старт", "open application");

  const navCandidates = await page.locator("nav button, .desktop-nav-item, .bottom-nav-pill button, [role='tab']").evaluateAll((els) =>
    els.map((el) => ({
      label: (
        (el as HTMLElement).getAttribute("aria-label") ||
        (el as HTMLElement).textContent ||
        (el as HTMLElement).getAttribute("title") ||
        ""
      ).replace(/\s+/g, " ").trim(),
    })).filter((x) => x.label),
  );

  const uniqueNav = Array.from(new Set(navCandidates.map((x) => x.label))).slice(0, 20);

  for (const label of uniqueNav) {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(300);
    const candidate = page.getByRole("button", { name: label, exact: false }).first();
    if (!await candidate.count()) continue;
    if (!isSafeAction(label)) continue;

    errors.console.length = 0;
    errors.network.length = 0;

    try {
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ timeout: 4000 });
      await visit(label, `click "${label}"`);

      // Open the first visible job/card or obvious detail action for a second-level state.
      if (config.maxActionsPerSurface > 1) {
        const detailCandidate = page.locator(".gruzli-job-card, [data-testid='job-card']").first();
        if (await detailCandidate.count()) {
          const detailLabel = await detailCandidate.getAttribute("aria-label").catch(() => null) || await detailCandidate.textContent().catch(() => "");
          if (isSafeAction(String(detailLabel))) {
            try {
              await detailCandidate.scrollIntoViewIfNeeded();
              await detailCandidate.click({ timeout: 2500 });
              await visit(`${label} → detail`, `open first detail from "${label}"`);
            } catch {}
          }
        }
      }
    } catch (error) {
      findings.push({
        severity: "high",
        category: "functional",
        title: "Не удалось выполнить действие навигации",
        description: `"${label}": ${String(error instanceof Error ? error.message : error)}`,
        confidence: 1,
        role,
        viewport,
        surface: label,
        url: page.url(),
        action: `click "${label}"`,
      });
    }
  }

  await context.close();
  return { captures, findings };
}

function dedupeFindings(findings: QaFinding[]) {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const groups = new Map<string, QaFinding>();
  for (const finding of findings) {
    const key = [
      finding.category,
      finding.role,
      finding.surface,
      safeText(finding.title).toLowerCase().slice(0, 120),
    ].join("|");
    const previous = groups.get(key);
    if (!previous || rank[finding.severity] > rank[previous.severity] || finding.confidence > previous.confidence) {
      groups.set(key, finding);
    }
  }
  return Array.from(groups.values()).map((finding, index) => ({ ...finding, id: `BUG-${String(index + 1).padStart(3, "0")}` }));
}

async function runScan(config: QaScanConfig): Promise<QaScanReport> {
  const startedAt = new Date().toISOString();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const reportRoot = join(process.cwd(), "qa", "reports");
  const runDir = join(reportRoot, "runs", runId);
  await mkdir(runDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const allCaptures: QaCapture[] = [];
  const rawFindings: QaFinding[] = [];
  const roles = config.roles.length ? config.roles : ["worker", "dispatcher", "client"] as QaRole[];
  const viewports = config.viewports.length ? config.viewports : [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const role of roles) {
    for (const viewport of viewports) {
      const result = await runForRoleViewport(browser, config, role, viewport, runDir);
      allCaptures.push(...result.captures);
      rawFindings.push(...result.findings);
    }
  }

  await browser.close();

  if (config.ai.apiKey && config.maxAiAnalyses > 0) {
    const roleOrder: Record<QaRole, number> = { dispatcher: 0, client: 1, worker: 2 };
    const viewportOrder: Record<string, number> = { mobile: 0, desktop: 1, tablet: 2 };
    const selected = [...allCaptures]
      .sort((a, b) => (roleOrder[a.role] - roleOrder[b.role]) || ((viewportOrder[a.viewport.name] ?? 9) - (viewportOrder[b.viewport.name] ?? 9)))
      .slice(0, Math.max(1, Math.min(config.maxAiAnalyses, allCaptures.length)));

    for (const capture of selected) {
      try {
        rawFindings.push(...await analyzeWithAi(config.ai, capture, capture.role, capture.viewport));
      } catch (error) {
        rawFindings.push({
          severity: "medium",
          category: "runtime",
          title: "AI analyzer request failed",
          description: String(error instanceof Error ? error.message : error),
          confidence: 1,
          role: capture.role,
          viewport: capture.viewport,
          surface: capture.surface,
          url: capture.url,
          action: capture.action,
          evidence: { screenshot: capture.screenshotFile, console: capture.consoleErrors, network: capture.networkErrors },
        });
      }
    }
  }

  const findings = dedupeFindings(rawFindings);
  const finishedAt = new Date().toISOString();
  const report: QaScanReport = {
    runId,
    startedAt,
    finishedAt,
    config: {
      baseUrl: config.baseUrl,
      roles,
      viewports,
      maxActionsPerSurface: config.maxActionsPerSurface,
      maxAiAnalyses: config.maxAiAnalyses,
      ai: { enabled: Boolean(config.ai.apiKey), model: config.ai.model || undefined },
    },
    coverage: {
      roles: Object.fromEntries(roles.map((role) => [role, allCaptures.filter((capture) => capture.role === role).length])),
      captures: allCaptures.length,
      deterministicFindings: rawFindings.filter((f) => f.title !== "AI analyzer request failed" && !f.title.includes("AI analyzer")).length,
      aiFindings: rawFindings.filter((f) => f.evidence?.screenshot && !["Console error","Network error","Горизонтальный overflow","Проблема геометрии интерфейса"].includes(f.title) && f.category !== "runtime").length,
    },
    findings,
    captures: allCaptures.map(({ screenshotBase64, ...capture }) => capture),
  };

  const md = [
    "# GRUZLI AI QA REPORT",
    "",
    `Run: ${runId}`,
    `Started: ${startedAt}`,
    `Finished: ${finishedAt}`,
    "",
    `Captures: ${report.coverage.captures}`,
    `Issues: ${report.findings.length}`,
    "",
    ...report.findings.map((f) => [
      `## ${f.id} — ${f.severity.toUpperCase()} — ${f.title}`,
      `- Role: ${f.role}`,
      `- Viewport: ${f.viewport.name} (${f.viewport.width}×${f.viewport.height})`,
      `- Surface: ${f.surface}`,
      `- Category: ${f.category}`,
      `- Confidence: ${Math.round(f.confidence * 100)}%`,
      `- Description: ${f.description}`,
      f.action ? `- Action: ${f.action}` : "",
      f.evidence?.screenshot ? `- Evidence: ${f.evidence.screenshot}` : "",
      "",
    ].filter(Boolean).join("\n")),
  ].join("\n");

  await writeFile(join(reportRoot, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(join(reportRoot, "latest.md"), md, "utf8");

  return report;
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, service: "gruzli-ai-qa-scanner", port: PORT });
  }

  if (req.method === "POST" && req.url === "/scan") {
    try {
      const config = await parseBody(req) as QaScanConfig;
      if (!config.baseUrl) config.baseUrl = DEFAULT_BASE_URL;
      const report = await runScan(config);
      return json(res, 200, report);
    } catch (error) {
      return json(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
    }
  }

  return json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Gruzli AI QA] scanner listening on http://127.0.0.1:${PORT}`);
  console.log(`[Gruzli AI QA] app target: ${DEFAULT_BASE_URL}`);
});