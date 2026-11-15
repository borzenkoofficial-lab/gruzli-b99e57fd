import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";

/**
 * Shown when the production build has no Supabase credentials.
 * Prevents a blank white page and tells the operator exactly what is missing.
 */
export default function ConfigMissingScreen() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={22} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight">Нужна конфигурация</h1>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Приложение запущено без ключей Supabase. Добавьте переменные окружения в Vercel
              (или в .env) и пересоберите проект.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4 font-mono text-[12px] leading-relaxed space-y-1.5">
          <p className="text-muted-foreground">Требуются:</p>
          <p>
            <span className="text-foreground/80">VITE_SUPABASE_URL</span>
          </p>
          <p>
            <span className="text-foreground/80">VITE_SUPABASE_PUBLISHABLE_KEY</span>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background active:scale-[0.98] transition-transform"
          >
            <RefreshCw size={15} />
            Обновить страницу
          </button>
          <a
            href="https://github.com/borzenkoofficial-lab/gruzli-b99e57fd#development"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground active:bg-muted transition-colors"
          >
            Документация
            <ExternalLink size={14} />
          </a>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Локально можно включить демо:{