export type QaRole = "worker" | "dispatcher" | "client";
export type QaViewport = { name: string; width: number; height: number };

export interface QaAiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface QaScanConfig {
  baseUrl: string;
  roles: QaRole[];
  viewports: QaViewport[];
  maxActionsPerSurface: number;
  maxAiAnalyses: number;
  ai: QaAiConfig;
}

export interface QaFinding {
  id?: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "functional" | "runtime" | "visual" | "ux" | "responsive" | "accessibility";
  title: string;
  description: string;
  confidence: number;
  role: QaRole;
  viewport: QaViewport;
  surface: string;
  url: string;
  action?: string;
  evidence?: {
    screenshot?: string;
    console?: string[];
    network?: string[];
  };
}

export interface QaCapture {
  role: QaRole;
  viewport: QaViewport;
  surface: string;
  action: string;
  url: string;
  screenshotBase64: string;
  screenshotFile: string;
  consoleErrors: string[];
  networkErrors: string[];
  domSummary: {
    buttons: string[];
    links: string[];
    headings: string[];
    bodyText: string;
  };
  geometryIssues: string[];
}

export interface QaScanReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  config: Omit<QaScanConfig, "ai"> & { ai: { enabled: boolean; model?: string } };
  coverage: {
    roles: Record<string, number>;
    captures: number;
    deterministicFindings: number;
    aiFindings: number;
  };
  findings: QaFinding[];
  captures: QaCapture[];
}