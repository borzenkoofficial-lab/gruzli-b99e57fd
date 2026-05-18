import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AnnouncementCfg {
  enabled: boolean;
  badge: string;
  title: string;
  body: string;
  image_url: string;
  cta: string;
  link_url: string;
  version: number;
}

const DEFAULT_CFG: AnnouncementCfg = {
  enabled: false,
  badge: "",
  title: "",
  body: "",
  image_url: "",
  cta: "Окей, понятно",
  link_url: "",
  version: 1,
};

const storageKey = (v: number) => `gruzli_announcement_seen_v${v}`;

export const AnnouncementModal = () => {
  const [cfg, setCfg] = useState<AnnouncementCfg | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", "announcement_modal")
        .maybeSingle();
      if (!active) return;
      const v = (data?.value as Partial<AnnouncementCfg>) || {};
      const merged: AnnouncementCfg = { ...DEFAULT_CFG, ...v };
      setCfg(merged);
      const seen = localStorage.getItem(storageKey(merged.version || 1)) === "1";
      if (merged.enabled && (merged.title || merged.body) && !seen) {
        // tiny delay so it feels intentional after app mounts
        setTimeout(() => active && setOpen(true), 600);
      }
    };
    load();

    const ch = supabase
      .channel("announcement-modal-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "id=eq.announcement_modal" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const dismiss = () => {
    if (cfg) localStorage.setItem(storageKey(cfg.version || 1), "1");
    setOpen(false);
  };

  if (!cfg) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-80"
              style={{
                background:
                  "radial-gradient(120% 60% at 50% 0%, hsl(var(--primary) / 0.18), transparent 60%)",
              }}
            />

            <button
              onClick={dismiss}
              aria-label="Закрыть"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:opacity-70"
            >
              <X size={16} />
            </button>

            {cfg.image_url ? (
              <div className="relative w-full aspect-[16/9] overflow-hidden border-b border-border">
                <img
                  src={cfg.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 50%, hsl(var(--card)) 100%)",
                  }}
                />
              </div>
            ) : (
              <div className="relative pt-8 flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Sparkles size={28} className="text-primary" />
                </div>
              </div>
            )}

            <div className="relative px-6 pt-5 pb-6 text-center">
              {cfg.badge && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary mb-2">
                  {cfg.badge}
                </span>
              )}
              <h2 className="text-xl font-bold text-foreground leading-tight">
                {cfg.title || "Обновление"}
              </h2>
              {cfg.body && (
                <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {cfg.body}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                {cfg.link_url && (
                  <a
                    href={cfg.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismiss}
                    className="inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:opacity-80 transition-opacity"
                  >
                    {cfg.cta || "Подробнее"}
                    <ArrowUpRight size={16} />
                  </a>
                )}
                <button
                  onClick={dismiss}
                  className={`h-11 rounded-2xl font-semibold text-[14px] active:opacity-80 transition-opacity ${
                    cfg.link_url
                      ? "bg-muted/60 text-foreground hover:bg-muted"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {cfg.link_url ? "Закрыть" : cfg.cta || "Окей, понятно"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnnouncementModal;
