import { useMemo, useState } from "react";
import "./qa.css";

type Role = "worker" | "dispatcher" | "client";
type Viewport = { name: string; width: number; height: number };

const ROLE_LABELS: Record<Role, string> = {
  worker: "Грузчик",
  dispatcher: "Диспетчер",
  client: "Заказчик",
};

const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

export default function QaScannerPanel() {
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1/chat/completions");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:4173");
  const [roles, setRoles] = useState<Role[]>(["worker", "dispatcher", "client"]);
  const [viewports, setViewports] = useState<Viewport[]>(DEFAULT_VIEWPORTS);
  const [maxAiAnalyses, setMaxAiAnalyses] = useState(24);\n  const [maxActionsPerSurface, setMaxActionsPerSurface] = useState(2);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Готов");
  const [report, setReport] = useState<any>(null);

  const aiEnabled = Boolean(apiKey.trim() && model.trim() && endpoint.trim());

  const toggleRole = (role: Role) => {
    setRoles((current) => current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);
  };

  const toggleViewport = (viewport: Viewport) => {
    setViewports((current) => current.some((v) => v.name === viewport.name)
      ? current.filter((v) => v.name !== viewport.name)
      : [...current, viewport]);
  };

  const run = async () => {
    setRunning(true);
    setReport(null);
    setStatus("Проверяю scanner server…");
    try {
      const health = await fetch("http://127.0.0.1:4174/health");
      if (!health.ok) throw new Error("QA Scanner не запущен. Выполни npm run qa:server.");
      setStatus(aiEnabled ? "Сканирую приложение + AI анализ…" : "Сканирую приложение без AI…");
      const response = await fetch("http://127.0.0.1:4174/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          roles,
          viewports,
          maxActionsPerSurface,
          maxAiAnalyses,
          ai: {
            endpoint: endpoint.trim(),
            apiKey: apiKey.trim(),
            model: model.trim(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Scan failed");
      setReport(data);
      setStatus(`Готово: ${data?.findings?.length ?? 0} проблем, ${data?.coverage?.captures ?? 0} состояний.`);
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setRunning(false);
    }
  };

  const download = (kind: "json" | "md") => {
    if (!report) return;
    const filename = `gruzli-qa-${report.runId || "latest"}.${kind}`;
    const content = kind === "json"
      ? JSON.stringify(report, null, 2)
      : [
          "# GRUZLI AI QA REPORT",
          "",
          `Run: ${report.runId}`,
          `Issues: ${report.findings?.length ?? 0}`,
          "",
          ...(report.findings || []).map((f: any) => `## ${f.id} — ${String(f.severity).toUpperCase()} — ${f.title}
- ${f.role}
- ${f.viewport?.name}
- ${f.surface}
- ${f.description}
`),
        ].join("
");
    const blob = new Blob([content], { type: kind === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of report?.findings || []) counts[f.severity] = (counts[f.severity] || 0) + 1;
    return counts;
  }, [report]);

  return (
    <div className="qa-overlay">
      <div className="qa-panel" role="dialog" aria-modal="true" aria-label="Gruzli AI QA Scanner">
        <div className="qa-header">
          <div>
            <div className="qa-kicker">TEMPORARY DEV TOOL</div>
            <h2>Gruzli AI QA Scanner</h2>
            <p>Ключ живёт только в этой вкладке. В production панель не показывается.</p>
          </div>
          <button className="qa-close" onClick={() => window.history.back()} aria-label="Закрыть">×</button>
        </div>

        <div className="qa-section">
          <div className="qa-section-title">ИИ</div>
          <div className="qa-grid">
            <label>API endpoint<input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="OpenAI-compatible /chat/completions" /></label>
            <label>Model<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="vision-capable model" /></label>
          </div>
          <label>API key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Вставь ключ для этого запуска" autoComplete="off" /></label>
        </div>

        <div className="qa-section">
          <div className="qa-section-title">Приложение</div>
          <label>App URL<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label>
          <div className="qa-grid">\n            <label>AI snapshots per run (лимит)<input type="number" min={0} max={100} value={maxAiAnalyses} onChange={(e) => setMaxAiAnalyses(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></label>\n            <label>Действий на раздел<input type="number" min={1} max={5} value={maxActionsPerSurface} onChange={(e) => setMaxActionsPerSurface(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} /></label>\n          </div>
          <div className="qa-chip-row">
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
              <button key={role} className={`qa-chip ${roles.includes(role) ? "is-on" : ""}`} onClick={() => toggleRole(role)}>
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
          <div className="qa-chip-row">
            {DEFAULT_VIEWPORTS.map((viewport) => (
              <button key={viewport.name} className={`qa-chip ${viewports.some((v) => v.name === viewport.name) ? "is-on" : ""}`} onClick={() => toggleViewport(viewport)}>
                {viewport.name} · {viewport.width}×{viewport.height}
              </button>
            ))}
          </div>
        </div>

        <div className="qa-actions">
          <button className="qa-primary" disabled={running || roles.length === 0 || viewports.length === 0} onClick={run}>
            {running ? "СКАНИРУЮ…" : aiEnabled ? "ЗАПУСТИТЬ AI QA" : "ЗАПУСТИТЬ SCAN"}
          </button>
          <button className="qa-secondary" disabled={!report} onClick={() => download("json")}>JSON</button>
          <button className="qa-secondary" disabled={!report} onClick={() => download("md")}>REPORT</button>
        </div>

        <div className="qa-status">{status}</div>

        {report && (
          <div className="qa-report">
            <div className="qa-report-head">
              <strong>{report.findings?.length ?? 0} issues</strong>
              <span>{report.coverage?.captures ?? 0} captures</span>
              <span>{Object.entries(severityCounts).map(([k,v]) => `${k}: ${v}`).join(" · ")}</span>
            </div>
            {(report.findings || []).map((finding: any) => (
              <div className={`qa-finding qa-${finding.severity}`} key={finding.id}>
                <div className="qa-finding-top">
                  <strong>{finding.id}</strong>
                  <span>{String(finding.severity).toUpperCase()}</span>
                </div>
                <div className="qa-finding-title">{finding.title}</div>
                <div className="qa-finding-meta">{finding.role} · {finding.viewport?.name} · {finding.surface}</div>
                <div className="qa-finding-description">{finding.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}