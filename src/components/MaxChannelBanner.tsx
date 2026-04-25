import { useState, useEffect } from "react";
import { X, Megaphone, ArrowUpRight } from "lucide-react";

const MAX_URL = "https://max.ru/join/tCvjDpAf3Y4ASnU_j3LkYcEIY0rmXdDiFuVQ6LiDDno";
const STORAGE_KEY = "max_channel_banner_dismissed_v1";

export const MaxChannelBanner = () => {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, "1");
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="px-5 mt-3">
      <a
        href={MAX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center gap-3 rounded-2xl p-3 overflow-hidden border border-border bg-card tap-scale group"
      >
        {/* subtle accent glow */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0) 60%)",
          }}
        />

        <div className="relative shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Megaphone size={18} className="text-primary" />
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-bold text-foreground truncate">
              Канал Грузли в MAX
            </p>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              new
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            Новости, советы и горячие заявки — присоединяйтесь
          </p>
        </div>

        <div className="relative shrink-0 flex items-center gap-1">
          <span className="text-[11px] font-semibold text-primary hidden xs:inline">
            Вступить
          </span>
          <ArrowUpRight size={14} className="text-primary" />
        </div>

        <button
          onClick={dismiss}
          aria-label="Скрыть"
          className="relative shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:opacity-70"
        >
          <X size={12} />
        </button>
      </a>
    </div>
  );
};
