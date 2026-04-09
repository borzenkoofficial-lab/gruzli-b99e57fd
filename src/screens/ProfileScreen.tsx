import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Bell, CreditCard, Trophy, Copy, CheckCircle2, MessageSquare, Hash, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboard } from "@/data/mockData";
import { toast } from "sonner";

const skills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

interface ProfileScreenProps {
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
}

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  text: string;
  created_at: string;
  reviewer_name?: string;
}

const ProfileScreen = ({ onOpenSettings, onOpenNotifications }: ProfileScreenProps) => {
  const { user, profile, role, signOut } = useAuth();
  const [availability, setAvailability] = useState([true, true, true, false, true, true, false]);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [showWallet, setShowWallet] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [idCopied, setIdCopied] = useState(false);

  const isDispatcher = role === "dispatcher";

  const initials = (profile?.full_name || "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const shortId = user?.id?.slice(0, 8).toUpperCase() || "—";

  // Fetch reviews for dispatcher
  useEffect(() => {
    if (!isDispatcher || !user) return;
    const fetchReviews = async () => {
      const { data } = await supabase
        .from("dispatcher_reviews")
        .select("*")
        .eq("dispatcher_id", user.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        const reviewerIds = [...new Set(data.map((r: any) => r.reviewer_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", reviewerIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
        const withNames = data.map((r: any) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "Исполнитель" }));
        setReviews(withNames);
        const avg = data.reduce((sum: number, r: any) => sum + r.rating, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    };
    fetchReviews();
  }, [isDispatcher, user]);

  const copyId = () => {
    navigator.clipboard.writeText(shortId);
    setIdCopied(true);
    toast.success("ID скопирован");
    setTimeout(() => setIdCopied(false), 2000);
  };

  // ─── DISPATCHER PROFILE ───
  if (isDispatcher) {
    return (
      <div className="pb-28">
        <div className="px-5 pt-14 pb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Профиль</h1>
          <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
            <Bell size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Avatar & Name */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="w-18 h-18 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground" style={{ width: 72, height: 72 }}>
              {initials}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">{profile?.full_name || "Диспетчер"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">@{profile?.full_name?.toLowerCase().replace(/\s+/g, "_") || "dispatcher"}</p>
              <div className="flex items-center gap-1 mt-1">
                <Shield size={12} className="text-primary" />
                <span className="text-xs text-primary font-semibold">Диспетчер</span>
                {profile?.verified && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold">✓ Верифицирован</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ID Card */}
        <div className="mx-5 mb-4">
          <div className="neu-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash size={16} className="text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Индивидуальный ID</span>
              </div>
              <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-raised-sm active:neu-inset transition-all">
                {idCopied ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                <span className="text-sm font-bold text-foreground tracking-wider">{shortId}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Balance for job posting */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(220 65% 58%))',
        }}>
          <div className="px-5 py-5">
            <p className="text-primary-foreground/70 text-xs font-medium mb-1">Баланс для заявок</p>
            <h2 className="text-primary-foreground text-3xl font-extrabold mb-1">{profile?.balance || 0} ₽</h2>
            <p className="text-primary-foreground/50 text-xs">Для оплаты размещения заявок</p>
          </div>
          <div className="px-5 pb-4">
            <button className="w-full py-3 rounded-xl bg-primary-foreground/20 text-primary-foreground text-sm font-bold active:scale-95 transition-transform">
              💳 Пополнить баланс
            </button>
          </div>
        </div>

        {/* Verification */}
        {!profile?.verified && (
          <div className="mx-5 mb-4">
            <div className="neu-card rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield size={22} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">Верификация</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Подтвердите личность для повышения доверия исполнителей</p>
                </div>
              </div>
              <button
                onClick={() => toast.info("Функция верификации скоро будет доступна")}
                className="w-full mt-3 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
              >
                Пройти верификацию
              </button>
            </div>
          </div>
        )}

        {/* Rating */}
        <div className="mx-5 mb-4">
          <div className="neu-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">Рейтинг</span>
              <div className="flex items-center gap-1">
                <Star size={16} className="text-primary fill-primary" />
                <span className="text-lg font-extrabold text-foreground">{avgRating || profile?.rating || "5.0"}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${reviews.length > 0 ? (reviews.filter((r) => r.rating >= s).length / reviews.length) * 100 : (s <= Math.round(profile?.rating || 5) ? 100 : 0)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {reviews.length > 0 ? `На основе ${reviews.length} отзывов` : "Пока нет отзывов от исполнителей"}
            </p>
          </div>
        </div>

        {/* Reviews */}
        <div className="mx-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" />
            Отзывы исполнителей
          </h2>
          {reviews.length === 0 ? (
            <div className="neu-card rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Отзывов пока нет. Исполнители смогут оставить отзыв после выполнения заказа.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.slice(0, 5).map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neu-card rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{review.reviewer_name}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={10} className={i < review.rating ? "text-primary fill-primary" : "text-muted"} />
                      ))}
                    </div>
                  </div>
                  {review.text && <p className="text-xs text-muted-foreground">{review.text}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(review.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="px-5 space-y-2">
          <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all">
            <Settings size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all">
            <LogOut size={18} className="text-destructive" />
            <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // ─── WORKER PROFILE ───
  const statsData = {
    today: { orders: profile?.completed_orders || 0, earned: `${profile?.balance || 0} ₽`, hours: "0ч" },
    week: { orders: 0, earned: "0 ₽", hours: "0ч" },
    month: { orders: 0, earned: "0 ₽", hours: "0ч" },
  };
  const stats = statsData[statsPeriod];

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Профиль</h1>
        <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Hero earnings banner */}
      <div className="mx-5 mt-2 mb-4 rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(220 65% 58%), hsl(195 100% 50%))',
      }}>
        <div className="px-5 py-5">
          <p className="text-primary-foreground/70 text-xs font-medium mb-1">Заработано</p>
          <h2 className="text-primary-foreground text-4xl font-extrabold mb-1">{profile?.balance || 0} ₽</h2>
          <p className="text-primary-foreground/60 text-xs">Баланс кошелька</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{profile?.full_name || "Пользователь"}</h2>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-sm font-bold text-foreground">{profile?.rating || "5.00"}</span>
              <span className="text-xs text-muted-foreground ml-1">· {profile?.completed_orders || 0} заказов</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-semibold">Грузчик</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 pb-3">
        <div className="flex gap-1.5 neu-inset rounded-2xl p-1.5">
          {(["today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setStatsPeriod(p)} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${statsPeriod === p ? "gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {p === "today" ? "Сегодня" : p === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Briefcase, label: "Заказов", value: stats.orders.toString() },
            { icon: Wallet, label: "Заработано", value: stats.earned },
            { icon: Calendar, label: "Часов", value: stats.hours },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="neu-card rounded-2xl p-3 text-center">
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
          <button onClick={() => setShowWallet(!showWallet)} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform">
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
          {(profile?.skills?.length ? profile.skills : skills).map((skill: string) => (
            <span key={skill} className="px-3 py-2 rounded-xl neu-raised-sm text-xs font-medium text-muted-foreground">{skill}</span>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Доступность</h2>
        <div className="grid grid-cols-7 gap-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
            <button key={day} onClick={() => { const next = [...availability]; next[i] = !next[i]; setAvailability(next); }} className={`py-2.5 rounded-xl text-center text-xs font-semibold transition-all ${availability[i] ? "gradient-primary text-primary-foreground" : "neu-raised-sm text-muted-foreground"}`}>
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
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
              <div className="w-8 h-8 rounded-full neu-raised-sm flex items-center justify-center text-[10px] font-semibold text-muted-foreground">{l.avatar}</div>
              <span className="text-xs font-semibold text-foreground flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.score} заказов</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-2">
        {role === "admin" && (
          <AdminButton />
        )}
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all">
          <Settings size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all">
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
