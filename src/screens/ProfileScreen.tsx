import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Menu, Bell, CreditCard, Trophy, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboard } from "@/data/mockData";

const skills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

interface ProfileScreenProps {
  onOpenSettings?: () => void;
}

const ProfileScreen = ({ onOpenSettings }: ProfileScreenProps) => {
  const { profile, role, signOut } = useAuth();
  const [availability, setAvailability] = useState([true, true, true, false, true, true, false]);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [showWallet, setShowWallet] = useState(false);

  const statsData = {
    today: { orders: profile?.completed_orders || 0, earned: `${profile?.balance || 0} ₽`, hours: "0ч" },
    week: { orders: 0, earned: "0 ₽", hours: "0ч" },
    month: { orders: 0, earned: "0 ₽", hours: "0ч" },
  };
  const stats = statsData[statsPeriod];

  const initials = (profile?.full_name || "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Hero earnings banner */}
      <div className="mx-5 mt-2 mb-4 rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(240 55% 55%), hsl(220 65% 58%), hsl(195 100% 50%))',
        boxShadow: '0 8px 32px hsl(230 60% 58% / 0.4), 6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%)',
      }}>
        <div className="px-5 py-5">
          <p className="text-white/70 text-xs font-medium mb-1">
            {role === "dispatcher" ? "Вы — Диспетчер" : "Заработано"}
          </p>
          <h2 className="text-white text-4xl font-extrabold mb-1">{profile?.balance || 0} ₽</h2>
          <p className="text-white/60 text-xs">Баланс кошелька</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground" style={{ boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)' }}>
            {initials}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{profile?.full_name || "Пользователь"}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-sm font-bold text-foreground">{profile?.rating || "5.00"}</span>
              <span className="text-xs text-muted-foreground ml-1">· {profile?.completed_orders || 0} заказов</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={12} className="text-online" />
              <span className="text-xs text-online font-semibold">
                {role === "dispatcher" ? "Диспетчер" : "Грузчик"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats period toggle */}
      <div className="px-5 pb-3">
        <div className="flex gap-1.5 neu-inset rounded-2xl p-1.5">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setStatsPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                statsPeriod === p ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {p === "today" ? "Сегодня" : p === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Briefcase, label: "Заказов", value: stats.orders.toString() },
            { icon: Wallet, label: "Заработано", value: stats.earned },
            { icon: Calendar, label: "Часов", value: stats.hours },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="neu-card rounded-2xl p-3 text-center"
            >
              <stat.icon size={18} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Wallet */}
      <div className="px-5 pb-5">
        <div className="neu-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              <span className="text-sm font-bold text-foreground">Кошелёк</span>
            </div>
            <span className="text-lg font-extrabold text-gradient-primary">{profile?.balance || 0} ₽</span>
          </div>
          <button
            onClick={() => setShowWallet(!showWallet)}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
          >
            💳 Вывести на карту
          </button>
          {showWallet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-muted-foreground">
              Минимальная сумма вывода: 1 000 ₽. Зачисление в течение 1-3 рабочих дней.
            </motion.div>
          )}
        </div>
      </div>

      {/* Skills (workers only) */}
      {role === "worker" && (
        <div className="px-5 pb-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Навыки</h2>
          <div className="flex flex-wrap gap-2">
            {(profile?.skills?.length ? profile.skills : skills).map((skill: string) => (
              <span key={skill} className="px-3 py-2 rounded-xl neu-raised-sm text-xs font-medium text-muted-foreground">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Availability Calendar (workers only) */}
      {role === "worker" && (
        <div className="px-5 pb-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Доступность</h2>
          <div className="grid grid-cols-7 gap-2">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
              <button
                key={day}
                onClick={() => {
                  const next = [...availability];
                  next[i] = !next[i];
                  setAvailability(next);
                }}
                className={`py-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                  availability[i] ? "gradient-primary text-primary-foreground" : "neu-raised-sm text-muted-foreground"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard (workers only) */}
      {role === "worker" && (
        <div className="px-5 pb-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-primary" /> Топ грузчиков
          </h2>
          <div className="neu-card rounded-2xl p-3 space-y-2">
            {leaderboard.map((l, i) => (
              <div key={l.name} className="flex items-center gap-3">
                <span className={`w-6 text-center text-xs font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </span>
                <div className="w-8 h-8 rounded-full neu-raised-sm flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {l.avatar}
                </div>
                <span className="text-xs font-semibold text-foreground flex-1">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.score} заказов</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="px-5 space-y-2">
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all">
          <Settings size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all"
        >
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
