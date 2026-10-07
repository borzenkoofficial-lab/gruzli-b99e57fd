import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
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
const REPORT_ROOT = join(process.cwd(), "qa", "reports");
const DEFAULT_VIEWPORTS: QaViewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const DEFAULT_ROLES: QaRole[] = ["worker", "dispatcher", "client"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const safeText = (value: string) => value.replace(/\s+/g, " ").trim();
const slug = (value: string) =>
  safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "surface";

function json(res: any, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
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
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeConfig(input: Partial<QaScanConfig>): QaScanConfig {
  return {
    baseUrl: String(input.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
    roles: Array.isArray(input.roles) && input.roles.length ? input.roles : DEFAULT_ROLES,
    viewports:
      Array.isArray(input.viewports) && input.viewports.length ? input.viewports : DEFAULT_VIEWPORTS,
    maxActionsPerSurface: Math.max(1, Math.min(5, Number(input.maxActionsPerSurface) || 2)),
    maxAiAnalyses: Math.max(0, Math.min(100, Number(input.maxAiAnalyses) || 0)),
    ai: {
      endpoint: String(input.ai?.endpoint || "").trim(),
      apiKey: String(input.ai?.apiKey || "").trim(),
      model: String(input.ai?.model || "").trim(),
    },
  };
}

function parseAiJson(content: string): QaFinding[] {
  const cleaned = content
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^\x60\x60\x60json\s*/i, "")
    .replace(/\s*\x60\x60\x60$/i, "");
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
    "Не выдумывай бизнес-правила.",
    "Ищи: layout, overlap, overflow, обрезанный текст, несогласованные кнопки/отступы, dead-end UX, runtime/network evidence.",
    "Верни только JSON-массив объектов.",
    "Поля объекта: severity(critical|high|medium|low), category(functional|runtime|visual|ux|responsive|accessibility), title, description, confidence(0..1).",
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
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${capture.screenshotBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI request failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as any;
  const content = String(payload?.choices?.[0]?.message?.content || "");
  return parseAiJson(content).map((finding) => ({
    ...finding,
    role,
    viewport,
    surface: capture.surface,
    url: capture.url,
    action: capture.action,
  }));
}

async function readLocatorLabel(locator: import("@playwright/test").Locator): Promise<string> {
  const aria = await locator.getAttribute("aria-label").catch(() => null);
  const title = await locator.getAttribute("title").catch(() => null);
  const placeholder = await locator.getAttribute("placeholder").catch(() => null);
  const text = await locator.textContent().catch(() => null);
  return safeText(String(aria || text || title || placeholder || ""));
}

async function readVisibleLabels(
  page: Page,
  selector: string,
  limit = 250,
): Promise<string[]> {
  const locator = page.locator(selector);
  const count = Math.min(await locator.count(), limit);
  const labels: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    try {
      if (!(await item.isVisible())) continue;
      const label = (await readLocatorLabel(item)).slice(0, 200);
      if (label) labels.push(label);
    } catch {
      // Element may disappear while the UI rerenders.
    }
  }

  return Array.from(new Set(labels));
}

async function collectDom(page: Page, viewport: QaViewport) {
  const buttons = await readVisibleLabels(page, "button,[role='button']", 250);
  const links = await readVisibleLabels(page, "a", 150);
  const headings = await readVisibleLabels(page, "h1,h2,h3,h4,h5", 50);

  const geometryIssues: string[] = [];

  // Use a string expression so tsx cannot inject browser-side helpers such as __name.
  const scrollWidth = Number(await page.evaluate("document.body.scrollWidth"));
  const innerWidth = Number(await page.evaluate("window.innerWidth"));
  if (scrollWidth > innerWidth + 4) {
    geometryIssues.push(
      `Horizontal overflow: body scrollWidth=${scrollWidth}, viewport=${innerWidth}`,
    );
  }

  const interactive = page.locator("button,input,textarea,select,[role='button']");
  const interactiveCount = Math.min(await interactive.count(), 300);

  for (let index = 0; index < interactiveCount; index += 1) {
    const item = interactive.nth(index);
    try {
      if (!(await item.isVisible())) continue;
      const box = await item.boundingBox();
      if (!box) continue;

      const label = (await readLocatorLabel(item)).slice(0, 60);
      if (
        box.x < -2 ||
        box.y < -2 ||
        box.x + box.width > viewport.width + 2 ||
        box.y + box.height > viewport.height + 2
      ) {
        geometryIssues.push(
          `Interactive element outside viewport: "${label}" [${Math.round(
            box.x,
          )},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}]`,
        );
      }

      const role = await item.getAttribute("role").catch(() => null);
      const tagName = await item.evaluate("el => el.tagName").catch(() => "");
      if (
        (tagName === "BUTTON" || role === "button") &&
        (box.width < 24 || box.height < 24)
      ) {
        geometryIssues.push(
          `Small interactive target: "${label}" size=${Math.round(box.width)}x${Math.round(
            box.height,
          )}`,
        );
      }
    } catch {
      // Element may disappear while the UI rerenders.
    }
  }

  const bodyText = safeText((await page.locator("body").innerText()).slice(0, 12000));

  return {
    buttons,
    links,
    headings,
    bodyText: bodyText.slice(0, 5000),
    geometryIssues: Array.from(new Set(geometryIssues)).slice(0, 40),
  };
}

function isSafeAction(label: string) {
  const value = label.toLowerCase();
  const blocked = [
    "выйти",
    "удалить",
    "отменить",
    "закрыть",
    "отклонить",
    "принять",
    "купить",
    "оплатить",
    "подтвердить",
    "подписать",
    "отправить",
    "заблокировать",
  ];
  return value.length > 0 && !blocked.some((token) => value.includes(token));
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
  const fileName = `${role}-${viewport.name}-${slug(surface)}-${Date.now()}.png`;
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

function deterministicFindings(capture: QaCapture): QaFinding[] {
  const findings: QaFinding[] = [];
  const evidence = {
    screenshot: capture.screenshotFile,
    console: capture.consoleErrors,
    network: capture.networkErrors,
  };

  for (const issue of capture.geometryIssues) {
    const overflow = issue.startsWith("Horizontal overflow");
    findings.push({
      severity: overflow ? "high" : "medium",
      category: overflow ? "responsive" : "visual",
      title: overflow ? "Горизонтальный overflow" : "Проблема геометрии интерфейса",
      description: issue,
      confidence: 1,
      role: capture.role,
      viewport: capture.viewport,
      surface: capture.surface,
      url: capture.url,
      action: capture.action,
      evidence,
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
      evidence,
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
      evidence,
    });
  }

  return findings;
}

async function runForRoleViewport(
  browser: Browser,
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

  await context.addInitScript({
    content: `localStorage.setItem("gruzli_demo_worker", "1");
localStorage.setItem("gruzli_demo_role", ${JSON.stringify(role)});
localStorage.setItem("onboarding_completed", "1");`,
  });

  const page = await context.newPage();
  const captures: QaCapture[] = [];
  const findings: QaFinding[] = [];
  const errors = { console: [] as string[], network: [] as string[] };

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.console.push(msg.text());
  });
  page.on("pageerror", (error) => errors.console.push(`PAGEERROR: ${error.message}`));
  page.on("requestfailed", (request) => {
    errors.network.push(
      `REQUESTFAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.network.push(
        `HTTP ${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  const visit = async (surface: string, action: string) => {
    await sleep(350);
    const capture = await captureState(page, role, viewport, surface, action, runDir, errors);
    captures.push(capture);
    findings.push(...deterministicFindings(capture));
  };

  try {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await visit("Старт", "open application");

    const uniqueNav = await readVisibleLabels(
      page,
      "nav button, .desktop-nav-item, .bottom-nav-pill button, [role='tab']",
      40,
    );

    for (const label of uniqueNav) {
      if (!isSafeAction(label)) continue;

      await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await sleep(300);
      const candidate = page.getByRole("button", { name: label, exact: false }).first();
      if (!(await candidate.count())) continue;

      errors.console.length = 0;
      errors.network.length = 0;

      try {
        await candidate.scrollIntoViewIfNeeded();
        await candidate.click({ timeout: 4000 });
        await visit(label, `click "${label}"`);

        if (config.maxActionsPerSurface > 1) {
          const innerCandidates = await readVisibleLabels(
            page,
            "main button, main a, .desktop-detail button, [role='dialog'] button",
            80,
          );

          const navSet = new Set(uniqueNav);
          const innerLabels = innerCandidates
            .filter((value) => !navSet.has(value) && isSafeAction(value))
            .slice(0, Math.max(0, config.maxActionsPerSurface - 1));

          for (const innerLabel of innerLabels) {
            await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
            await sleep(300);

            const surfaceButton = page.getByRole("button", { name: label, exact: false }).first();
            if (!(await surfaceButton.count())) break;

            try {
              await surfaceButton.click({ timeout: 4000 });
              await sleep(350);

              const inner = page.getByRole("button", { name: innerLabel, exact: false }).first();
              if (!(await inner.count())) continue;

              await inner.scrollIntoViewIfNeeded();
              await inner.click({ timeout: 3000 });
              await visit(
                `${label} → ${innerLabel}`,
                `click "${innerLabel}" inside "${label}"`,
              );
            } catch (error) {
              findings.push({
                severity: "medium",
                category: "functional",
                title: "Внутреннее действие не выполняется",
                description: `"${innerLabel}" внутри "${label}": ${String(
                  error instanceof Error ? error.message : error,
                )}`,
                confidence: 1,
                role,
                viewport,
                surface: label,
                url: page.url(),
                action: `click "${innerLabel}"`,
              });
            }
          }
        }
      } catch (error) {
        findings.push({
          severity: "medium",
          category: "functional",
          title: "Навигационное действие не выполняется",
          description: `"${label}": ${String(
            error instanceof Error ? error.message : error,
          )}`,
          confidence: 1,
          role,
          viewport,
          surface: label,
          url: page.url(),
          action: `click "${label}"`,
        });
      }
    }
  } catch (error) {
    findings.push({
      severity: "critical",
      category: "runtime",
      title: "Приложение не удалось открыть",
      description: String(error instanceof Error ? error.message : error),
      confidence: 1,
      role,
      viewport,
      surface: "Старт",
      url: config.baseUrl,
      action: "open application",
    });
  } finally {
    await context.close();
  }

  return { captures, findings };
}

function dedupeFindings(findings: QaFinding[]): QaFinding[] {
  const seen = new Set<string>();
  const result: QaFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.category,
      finding.severity,
      finding.role,
      finding.viewport.name,
      finding.surface,
      finding.title,
      finding.description,
    ]
      .join("|")
      .toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...finding,
      id: finding.id || `QA-${String(result.length + 1).padStart(3, "0")}`,
    });
  }

  return result;
}

async function runScan(config: QaScanConfig): Promise<QaScanReport> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const startedAt = new Date().toISOString();
  const reportRoot = join(REPORT_ROOT, "runs", runId);

  await mkdir(reportRoot, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const allCaptures: QaCapture[] = [];
  const rawFindings: QaFinding[] = [];

  try {
    for (const role of config.roles) {
      for (const viewport of config.viewports) {
        const result = await runForRoleViewport(browser, config, role, viewport, reportRoot);
        allCaptures.push(...result.captures);
        rawFindings.push(...result.findings);
      }
    }

    if (config.ai.apiKey && config.ai.endpoint && config.ai.model && config.maxAiAnalyses > 0) {
      const priority = (capture: QaCapture) => {
        const roleRank = capture.role === "dispatcher" ? 0 : capture.role === "client" ? 1 : 2;
        const viewportRank = capture.viewport.name === "mobile" ? 0 : capture.viewport.name === "desktop" ? 1 : 2;
        return roleRank * 10 + viewportRank;
      };

      const selected = [...allCaptures]
        .sort((a, b) => priority(a) - priority(b))
        .slice(0, config.maxAiAnalyses);

      for (const capture of selected) {
        try {
          const aiFindings = await analyzeWithAi(
            config.ai,
            capture,
            capture.role,
            capture.viewport,
          );

          for (const finding of aiFindings) {
            finding.evidence = {
              screenshot: capture.screenshotFile,
              console: capture.consoleErrors,
              network: capture.networkErrors,
            };
            rawFindings.push(finding);
          }
        } catch (error) {
          rawFindings.push({
            severity: "high",
            category: "runtime",
            title: "AI analyzer request failed",
            description: String(error instanceof Error ? error.message : error),
            confidence: 1,
            role: capture.role,
            viewport: capture.viewport,
            surface: capture.surface,
            url: capture.url,
            action: capture.action,
            evidence: {
              screenshot: capture.screenshotFile,
              console: capture.consoleErrors,
              network: capture.networkErrors,
            },
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const findings = dedupeFindings(rawFindings);
  const finishedAt = new Date().toISOString();

  const report: QaScanReport = {
    runId,
    startedAt,
    finishedAt,
    config: {
      baseUrl: config.baseUrl,
      roles: config.roles,
      viewports: config.viewports,
      maxActionsPerSurface: config.maxActionsPerSurface,
      maxAiAnalyses: config.maxAiAnalyses,
      ai: {
        enabled: Boolean(config.ai.apiKey && config.ai.endpoint && config.ai.model),
        model: config.ai.model || undefined,
      },
    },
    coverage: {
      roles: Object.fromEntries(
        config.roles.map((role) => [
          role,
          allCaptures.filter((capture) => capture.role === role).length,
        ]),
      ),
      captures: allCaptures.length,
      deterministicFindings: rawFindings.filter((finding) => finding.title !== "AI analyzer request failed").length,
      aiFindings: rawFindings.filter((finding) => finding.evidence?.screenshot && finding.category !== "runtime").length,
    },
    findings,
    captures: allCaptures.map(({ screenshotBase64: _screenshotBase64, ...capture }) => capture),
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
    ...report.findings.map((finding) =>
      [
        `## ${finding.id} — ${finding.severity.toUpperCase()} — ${finding.title}`,
        `- Role: ${finding.role}`,
        `- Viewport: ${finding.viewport.name} (${finding.viewport.width}×${finding.viewport.height})`,
        `- Surface: ${finding.surface}`,
        `- Category: ${finding.category}`,
        `- Confidence: ${Math.round(finding.confidence * 100)}%`,
        `- Description: ${finding.description}`,
        finding.action ? `- Action: ${finding.action}` : "",
        finding.evidence?.screenshot ? `- Evidence: ${finding.evidence.screenshot}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");

  await writeFile(join(REPORT_ROOT, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(join(REPORT_ROOT, "latest.md"), md, "utf8");

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
    return json(res, 200, {
      ok: true,
      service: "gruzli-ai-qa-scanner",
      port: PORT,
    });
  }

  if (req.method === "POST" && req.url === "/scan") {
    try {
      const input = (await parseBody(req)) as Partial<QaScanConfig>;
      const config = normalizeConfig(input);
      const report = await runScan(config);
      return json(res, 200, report);
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: String(error instanceof Error ? error.message : error),
      });
    }
  }

  return json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Gruzli AI QA] scanner listening on http://127.0.0.1:${PORT}`);
  console.log(`[Gruzli AI QA] app target: ${DEFAULT_BASE_URL}`);
});
