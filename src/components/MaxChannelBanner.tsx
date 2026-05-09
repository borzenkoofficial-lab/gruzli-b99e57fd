import { useState, useEffect } from "react";
import { X, Megaphone, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BannerCfg {
  enabled: boolean;
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  link_url: string;
  image_url: string;
  version: number;
}

const DEFAULT_CFG: BannerCfg = {
  enabled: false,
  title: "",
  subtitle: "",
  badge: "",
  cta: "",
  link_url: "",
  image_url: "",
  version: 1,
};

const storageKey = (v: number) => `feed_banner_dismissed_v${v}`;

export const MaxChannelBanner = () => {
  const [cfg, setCfg] = useState<BannerCfg | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", "feed_banner")
        .maybeSingle();
      if (!active) return;
      const v = (data?.value as Partial<BannerCfg>) || {};
      const merged: BannerCfg = { ...DEFAULT_CFG, ...v };
      setCfg(merged);
      setHidden(localStorage.getItem(storageKey(merged.version || 1)) === "1");
    };
    load();

    const ch = supabase
      .channel("feed-banner-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "id=eq.feed_banner" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (!cfg || !cfg.enabled) return null;
  if (!cfg.title && !cfg.subtitle && !cfg.image_url) return null;
  if (hidden) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(storageKey(cfg.version || 1), "1");
    setHidden(true);
  };

  const content = (
    <div className="relative flex items-center gap-3 rounded-2xl p-3 overflow-hidden border border-border bg-card tap-scale group">
      <span
        aria-hidden
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0) 60%)",
        }}
      />

      <div className="relative shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden">
        {cfg.image_url ? (
          <img src={cfg.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Megaphone size={18} className="text-primary" />
        )}
      </div>

      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-foreground truncate">
            {cfg.title || "Объявление"}
          </p>
          {cfg.badge && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
              {cfg.badge}
            </span>
          )}
        </div>
        {cfg.subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{cfg.subtitle}</p>
        )}
      </div>

      {cfg.link_url && (
        <div className="relative shrink-0 flex items-center gap-1">
          {cfg.cta && (
            <span className="text-[11px] font-semibold text-primary hidden xs:inline">
              {cfg.cta}
            </span>
          )}
          <ArrowUpRight size={14} className="text-primary" />
        </div>
      )}

      <button
        onClick={dismiss}
        aria-label="Скрыть"
        className="relative shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:opacity-70"
      >
        <X size={12} />
      </button>
    </div>
  );

  return (
    <div className="px-5 mt-3">
      {cfg.link_url ? (
        <a href={cfg.link_url} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
};
