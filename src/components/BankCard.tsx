import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Palette, Check } from "lucide-react";

export type BankCardTheme = "gruzli" | "sber" | "tinkoff" | "alfa" | "gold" | "neon";

interface ThemeConfig {
  id: BankCardTheme;
  name: string;
  bank: string;
  background: string;
  text: string;
  textSoft: string;
  textMuted: string;
  chip: string;
  accent: string; // for swatch
  ring: string; // decorative ring color
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
  secondaryBg: string;
  secondaryText: string;
  shadow: string;
  pattern?: "rings" | "waves" | "grid" | "stripes";
}

const THEMES: Record<BankCardTheme, ThemeConfig> = {
  gruzli: {
    id: "gruzli",
    name: "Грузли",
    bank: "Gruzli Bank",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    text: "#ffffff",
    textSoft: "rgba(255,255,255,0.8)",
    textMuted: "rgba(255,255,255,0.45)",
    chip: "linear-gradient(135deg, #fcd34d, #b45309)",
    accent: "#0f3460",
    ring: "rgba(255,255,255,0.1)",
    buttonBg: "rgba(255,255,255,0.12)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.18)",
    secondaryBg: "rgba(255,255,255,0.06)",
    secondaryText: "rgba(255,255,255,0.7)",
    shadow: "0 12px 40px rgba(0,0,0,0.45)",
    pattern: "rings",
  },
  sber: {
    id: "sber",
    name: "Зелёный",
    bank: "СберБанк",
    background: "linear-gradient(135deg, #1a8a4a 0%, #0e7a3c 50%, #0a5a2c 100%)",
    text: "#ffffff",
    textSoft: "rgba(255,255,255,0.85)",
    textMuted: "rgba(255,255,255,0.5)",
    chip: "linear-gradient(135deg, #fde68a, #d97706)",
    accent: "#1a8a4a",
    ring: "rgba(255,255,255,0.12)",
    buttonBg: "rgba(255,255,255,0.15)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.2)",
    secondaryBg: "rgba(255,255,255,0.08)",
    secondaryText: "rgba(255,255,255,0.75)",
    shadow: "0 12px 40px rgba(10,90,44,0.45)",
    pattern: "waves",
  },
  tinkoff: {
    id: "tinkoff",
    name: "Жёлтый",
    bank: "T-Bank",
    background: "linear-gradient(135deg, #1c1c1c 0%, #0a0a0a 100%)",
    text: "#ffd60a",
    textSoft: "rgba(255,214,10,0.85)",
    textMuted: "rgba(255,255,255,0.4)",
    chip: "linear-gradient(135deg, #fde68a, #b45309)",
    accent: "#ffd60a",
    ring: "rgba(255,214,10,0.12)",
    buttonBg: "#ffd60a",
    buttonText: "#0a0a0a",
    buttonBorder: "transparent",
    secondaryBg: "rgba(255,255,255,0.08)",
    secondaryText: "rgba(255,255,255,0.7)",
    shadow: "0 12px 40px rgba(0,0,0,0.6)",
    pattern: "stripes",
  },
  alfa: {
    id: "alfa",
    name: "Красный",
    bank: "Альфа",
    background: "linear-gradient(135deg, #ef0024 0%, #c1001c 50%, #7a0012 100%)",
    text: "#ffffff",
    textSoft: "rgba(255,255,255,0.85)",
    textMuted: "rgba(255,255,255,0.55)",
    chip: "linear-gradient(135deg, #fde68a, #b45309)",
    accent: "#ef0024",
    ring: "rgba(255,255,255,0.14)",
    buttonBg: "rgba(255,255,255,0.18)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.22)",
    secondaryBg: "rgba(0,0,0,0.18)",
    secondaryText: "rgba(255,255,255,0.8)",
    shadow: "0 12px 40px rgba(193,0,28,0.45)",
    pattern: "rings",
  },
  gold: {
    id: "gold",
    name: "Платина",
    bank: "Premium",
    background: "linear-gradient(135deg, #3a2c14 0%, #5b4520 40%, #1c1408 100%)",
    text: "#fde68a",
    textSoft: "rgba(253,230,138,0.85)",
    textMuted: "rgba(253,230,138,0.5)",
    chip: "linear-gradient(135deg, #fef3c7, #92400e)",
    accent: "#d4a849",
    ring: "rgba(212,168,73,0.18)",
    buttonBg: "linear-gradient(135deg, #fde68a, #d4a849)",
    buttonText: "#1c1408",
    buttonBorder: "transparent",
    secondaryBg: "rgba(253,230,138,0.1)",
    secondaryText: "rgba(253,230,138,0.8)",
    shadow: "0 12px 40px rgba(0,0,0,0.5)",
    pattern: "grid",
  },
  neon: {
    id: "neon",
    name: "Неон",
    bank: "Cyber Pay",
    background: "linear-gradient(135deg, #6d28d9 0%, #db2777 60%, #f97316 100%)",
    text: "#ffffff",
    textSoft: "rgba(255,255,255,0.9)",
    textMuted: "rgba(255,255,255,0.6)",
    chip: "linear-gradient(135deg, #fef3c7, #d97706)",
    accent: "#db2777",
    ring: "rgba(255,255,255,0.18)",
    buttonBg: "rgba(255,255,255,0.18)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.25)",
    secondaryBg: "rgba(0,0,0,0.2)",
    secondaryText: "rgba(255,255,255,0.85)",
    shadow: "0 12px 40px rgba(109,40,217,0.5)",
    pattern: "waves",
  },
};

const STORAGE_KEY = "gruzli-bank-card-theme";

export const THEME_LIST: BankCardTheme[] = ["gruzli", "sber", "tinkoff", "alfa", "gold", "neon"];

interface BankCardProps {
  balance: number;
  holderName: string;
  cardLast4: string;
  onTopUp: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  secondaryIcon?: React.ReactNode;
  variant?: "compact" | "full";
}

const Pattern = ({ theme }: { theme: ThemeConfig }) => {
  if (theme.pattern === "waves") {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.12]" preserveAspectRatio="none" viewBox="0 0 400 240">
        <path d="M0,160 Q100,100 200,140 T400,120 L400,240 L0,240 Z" fill={theme.text} opacity="0.4" />
        <path d="M0,180 Q100,130 200,170 T400,150 L400,240 L0,240 Z" fill={theme.text} opacity="0.25" />
      </svg>
    );
  }
  if (theme.pattern === "stripes") {
    return (
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${theme.text} 0 1px, transparent 1px 14px)`,
        }}
      />
    );
  }
  if (theme.pattern === "grid") {
    return (
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(${theme.text} 1px, transparent 1px), linear-gradient(90deg, ${theme.text} 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
        }}
      />
    );
  }
  return (
    <>
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none">
        <div className="w-full h-full rounded-full border-[18px] translate-x-10 -translate-y-10" style={{ borderColor: theme.ring }} />
      </div>
      <div className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none">
        <div className="w-full h-full rounded-full border-[14px] -translate-x-7 translate-y-7" style={{ borderColor: theme.ring }} />
      </div>
    </>
  );
};

const BrandMark = ({ theme }: { theme: ThemeConfig }) => {
  const id = theme.id;
  if (id === "sber") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M19.5 6.5a8 8 0 1 0 1.8 4.7" stroke={theme.text} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M8 11.5l3 3 6-6.5" stroke={theme.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "tinkoff") {
    return <span className="text-2xl font-black" style={{ color: theme.text, fontFamily: "Inter, sans-serif" }}>T</span>;
  }
  if (id === "alfa") {
    return <span className="text-2xl font-black italic" style={{ color: theme.text }}>A</span>;
  }
  if (id === "gold") {
    return <span className="text-lg font-black tracking-tight" style={{ color: theme.text }}>★</span>;
  }
  if (id === "neon") {
    return <span className="text-xl font-black" style={{ color: theme.text }}>◈</span>;
  }
  return <span className="text-base font-black" style={{ color: theme.text }}>G</span>;
};

export const BankCard = ({
  balance,
  holderName,
  cardLast4,
  onTopUp,
  onSecondary,
  secondaryLabel,
  secondaryIcon,
}: BankCardProps) => {
  const [themeId, setThemeId] = useState<BankCardTheme>("gruzli");
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as BankCardTheme | null;
      if (saved && THEMES[saved]) setThemeId(saved);
    } catch {}
  }, []);

  const setTheme = (t: BankCardTheme) => {
    setThemeId(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  const theme = THEMES[themeId];

  return (
    <div className="space-y-2.5">
      <motion.div
        key={themeId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl overflow-hidden relative w-full flex flex-col"
        style={{
          background: theme.background,
          boxShadow: theme.shadow,
          aspectRatio: "1.586 / 1",
        }}
      >
        <Pattern theme={theme} />

        {/* Top row: brand + palette */}
        <div className="relative px-4 pt-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: theme.secondaryBg, border: `1px solid ${theme.ring}` }}>
              <BrandMark theme={theme} />
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: theme.textSoft }}>{theme.bank}</span>
          </div>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: theme.secondaryBg, border: `1px solid ${theme.ring}`, color: theme.textSoft }}
            aria-label="Сменить дизайн карты"
          >
            <Palette size={12} />
          </button>
        </div>

        {/* Middle: chip + balance */}
        <div className="relative px-4 mt-auto">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-6 rounded-[4px] shadow-inner relative overflow-hidden" style={{ background: theme.chip }}>
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-0.5 opacity-30">
                {[...Array(6)].map((_, i) => <div key={i} className="rounded-[1px]" style={{ background: "rgba(120,60,0,0.6)" }} />)}
              </div>
            </div>
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: theme.textMuted }}>Виртуальная</span>
          </div>
          <h2 className="text-[26px] leading-none font-extrabold tracking-tight" style={{ color: theme.text }}>
            {balance.toLocaleString("ru-RU")}
            <span className="text-base font-bold ml-1" style={{ color: theme.textSoft }}>₽</span>
          </h2>
        </div>

        {/* Bottom: holder + number */}
        <div className="relative px-4 pt-2 pb-3.5 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[8px] tracking-[0.2em] uppercase" style={{ color: theme.textMuted }}>Держатель</p>
            <p className="text-[11px] font-bold tracking-wider truncate" style={{ color: theme.textSoft }}>
              {(holderName || "USER").toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8px] tracking-[0.2em] uppercase" style={{ color: theme.textMuted }}>№ карты</p>
            <p className="text-[11px] font-bold tracking-[0.2em]" style={{ color: theme.textSoft }}>•••• {cardLast4}</p>
          </div>
        </div>
      </motion.div>

      {/* Actions outside card */}
      <div className="flex gap-2">
        <button
          onClick={onTopUp}
          className="flex-1 py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-card border border-border text-foreground"
        >
          <Plus size={16} strokeWidth={3} />
          Пополнить
        </button>
        {onSecondary && (
          <button
            onClick={onSecondary}
            className="py-3 px-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all bg-card border border-border text-muted-foreground"
            aria-label={secondaryLabel}
          >
            {secondaryIcon || secondaryLabel}
          </button>
        )}
      </div>

      {/* Theme picker */}
      {showPicker && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-3"
        >
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Дизайн карты</p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_LIST.map((id) => {
              const t = THEMES[id];
              const active = id === themeId;
              return (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className="relative rounded-xl overflow-hidden h-16 active:scale-95 transition-transform"
                  style={{ background: t.background, border: active ? `2px solid hsl(var(--primary))` : `1px solid hsl(var(--border))` }}
                >
                  <span className="absolute bottom-1 left-1.5 text-[10px] font-bold" style={{ color: t.text }}>{t.name}</span>
                  {active && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-primary-foreground" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BankCard;
