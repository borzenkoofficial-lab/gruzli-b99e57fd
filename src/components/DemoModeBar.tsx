import { useAuth } from "@/contexts/AuthContext";
import { resetDemoDatabase } from "@/integrations/supabase/demoClient";

const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";

const ROLES = [
  { value: "client", label: "Заказчик" },
  { value: "dispatcher", label: "Диспетчер" },
  { value: "worker", label: "Грузчик" },
] as const;

export default function DemoModeBar() {
  const { role } = useAuth();

  if (!DEMO_ENABLED || localStorage.getItem("gruzli_demo_worker") !== "1") return null;

  const activeRole = ROLES.some((item) => item.value === role) ? role : "worker";

  const switchRole = (nextRole: (typeof ROLES)[number]["value"]) => {
    localStorage.setItem("gruzli_demo_role", nextRole);
    window.dispatchEvent(new Event("gruzli-demo-change"));
  };

  const reset = () => {
    if (!window.confirm("Сбросить только тестовые данные Gruzli? Это действие нельзя отменить.")) return;
    resetDemoDatabase();
    window.location.reload();
  };

  return (
    <div
      data-testid="demo-mode-bar"
      className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+8px)] z-[80] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 p-2 shadow-xl backdrop-blur-md"
      role="group"
      aria-label="Управление деморежимом"
    >
      <span className="rounded-lg bg-primary px-2 py-1 text-[9px] font-black tracking-wider text-primary-foreground">DEMO</span>
      <label className="sr-only" htmlFor="demo-role-switch">Тестовая роль</label>
      <select
        id="demo-role-switch"
        aria-label="Тестовая роль"
        value={activeRole}
        onChange={(event) => switchRole(event.target.value as (typeof ROLES)[number]["value"])}
        className="min-h-11 max-w-[120px] rounded-lg border border-border bg-background px-2.5 py-2 text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {ROLES.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Сброс
      </button>
    </div>
  );
}
