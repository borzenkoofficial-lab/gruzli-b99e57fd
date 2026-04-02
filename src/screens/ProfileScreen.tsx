import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Menu, Bell, CreditCard, Trophy, TrendingUp } from "lucide-react";
import { leaderboard } from "@/data/mockData";

const skills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

const ProfileScreen = () => {
  const [availability, setAvailability] = useState([true, true, true, false, true, true, false]);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [showWallet, setShowWallet] = useState(false);

  const statsData = {
    today: { orders: 2, earned: "9 600 ₽", hours: "6ч" },
    week: { orders: 11, earned: "47 200 ₽", hours: "38ч" },
    month: { orders: 38, earned: "187 500 ₽", hours: "156ч" },
  };
  const stats = statsData[statsPeriod];

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
          <p className="text-white/70 text-xs font-medium mb-1">Заработано сегодня</p>
          <h2 className="text-white text-4xl font-extrabold mb-1">9 600 ₽</h2>
          <p className="text-white/60 text-xs">+2 400 ₽ за последний заказ</p>
          <div className="flex items-center gap-2 mt-3">
            <TrendingUp size={14} className="text-white/80" />
            <span className="text-white/90 text-sm font-semibold">+15% к вчерашнему дню</span>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground" style={{ boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)' }}>
            ИС
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Иван Смирнов</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-sm font-bold text-foreground">4.9</span>
              <span className="text-xs text-muted-foreground ml-1">· 156 отзывов</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={12} className="text-online" />
              <span className="text-xs text-online font-semibold">Верифицирован</span>
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
            <span className="text-lg font-extrabold text-gradient-primary">47 200 ₽</span>
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

      {/* Skills */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Навыки</h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span key={skill} className="px-3 py-2 rounded-xl neu-raised-sm text-xs font-medium text-muted-foreground">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Availability Calendar */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Доступность</h2>
          <button className="px-3 py-1.5 rounded-lg neu-raised-sm text-[11px] font-semibold text-primary active:neu-inset transition-all">
            Отметить
          </button>
        </div>
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

      {/* Leaderboard */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Trophy size={14} className="text-primary" /> Топ грузчиков района
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

      {/* Menu */}
      <div className="px-5 space-y-2">
        {[
          { label: "Настройки", icon: Settings },
          { label: "Выйти", icon: LogOut },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground flex-1 text-left">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfileScreen;
