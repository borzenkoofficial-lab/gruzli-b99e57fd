import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Bell, CreditCard, Trophy, Copy, CheckCircle2, MessageSquare, Hash, ShieldCheck, Headphones, BadgeCheck, Banknote, Crown, Camera, Plus, X, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboard } from "@/data/mockData";
import { toast } from "sonner";
import BankCard from "@/components/BankCard";

const defaultSkills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

interface ProfileScreenProps {
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
  onOpenPremium?: () => void;
  onOpenCabinet?: () => void;
  onOpenCompany?: () => void;
}

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  text: string;
  created_at: string;
  reviewer_name?: string;
}

const AdminButton = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
      <ShieldCheck size={18} className="text-primary" />
      <span className="text-sm font-medium text-foreground flex-1 text-left">Админ-панель</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
};

const VerifiedPopup = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="relative bg-card border border-border rounded-3xl p-6 max-w-sm w-full text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <BadgeCheck size={32} className="text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Аккаунт верифицирован</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Этот аккаунт прошёл все методы верификации и подтверждён администрацией платформы Gruzli.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          {["Личность подтверждена", "Документы проверены", "Контактные данные подтверждены"].map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-foreground">
              <CheckCircle2 size={14} className="text-green-500 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-2xl bg-card border border-border text-sm font-semibold text-primary active:bg-surface-1 border border-border transition-all">
          Понятно
        </button>
      </motion.div>
    </div>
  );
};

// Avatar component with upload
const AvatarWithUpload = ({ profile, user, editable = false }: { profile: any; user: any; editable?: boolean }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initials = (profile?.full_name || "").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("kartoteka-photos").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Ошибка загрузки"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("kartoteka-photos").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    toast.success("Фото обновлено");
    setUploading(false);
    // Refresh profile without full page reload
    window.dispatchEvent(new CustomEvent("profile-avatar-updated"));
  };

  return (
    <div className="relative" onClick={() => editable && fileRef.current?.click()}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" style={{ width: 64, height: 64 }} />
      ) : (
        <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center text-xl font-bold text-primary-foreground">
          {initials}
        </div>
      )}
      {editable && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-foreground flex items-center justify-center cursor-pointer">
          {uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={12} className="text-primary-foreground" />}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
};

const ProfileScreen = ({ onOpenSettings, onOpenNotifications, onOpenSupport, onOpenPremium, onOpenCabinet, onOpenCompany }: ProfileScreenProps) => {
  const { user, profile, role, signOut } = useAuth();
  const [availability, setAvailability] = useState<boolean[]>([true, true, true, false, true, true, false]);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [showWallet, setShowWallet] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [idCopied, setIdCopied] = useState(false);
  const [showVerified, setShowVerified] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [editingSkills, setEditingSkills] = useState(false);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [weeklyStats, setWeeklyStats] = useState({ orders: 0, earned: 0, hours: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ orders: 0, earned: 0, hours: 0 });
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<{ type: "income" | "expense"; amount: number; description: string; date: string }[]>([]);

  const isDispatcher = role === "dispatcher";
  const isAdmin = role === "admin";

  const initials = (profile?.full_name || "").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const shortId = profile?.display_id || user?.id?.slice(0, 8).toUpperCase() || "—";

  // Load availability from DB
  useEffect(() => {
    if (profile?.availability) {
      setAvailability(profile.availability);
    }
  }, [profile]);

  // Load skills
  useEffect(() => {
    setUserSkills(profile?.skills?.length ? profile.skills : []);
  }, [profile]);

  // Save availability to DB
  const saveAvailability = async (next: boolean[]) => {
    setAvailability(next);
    if (!user) return;
    await supabase.from("profiles").update({ availability: next } as any).eq("user_id", user.id);
  };

  // Save skills to DB
  const saveSkills = async (skills: string[]) => {
    setUserSkills(skills);
    if (!user) return;
    await supabase.from("profiles").update({ skills }).eq("user_id", user.id);
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || userSkills.includes(s)) return;
    const next = [...userSkills, s];
    saveSkills(next);
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    saveSkills(userSkills.filter((s) => s !== skill));
  };

  // Fetch real stats with actual hours and earnings
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: weekData } = await supabase
        .from("job_responses")
        .select("id, job_id, created_at, hours_worked, earned")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .gte("created_at", weekStart.toISOString());

      const { data: monthData } = await supabase
        .from("job_responses")
        .select("id, job_id, created_at, hours_worked, earned")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .gte("created_at", monthStart.toISOString());

      if (weekData) {
        const earned = weekData.reduce((s, r: any) => s + (r.earned || 0), 0);
        const hours = weekData.reduce((s, r: any) => s + (r.hours_worked ? Number(r.hours_worked) : 0), 0);
        setWeeklyStats({ orders: weekData.length, earned, hours: Math.round(hours * 10) / 10 });
      }
      if (monthData) {
        const earned = monthData.reduce((s, r: any) => s + (r.earned || 0), 0);
        const hours = monthData.reduce((s, r: any) => s + (r.hours_worked ? Number(r.hours_worked) : 0), 0);
        setMonthlyStats({ orders: monthData.length, earned, hours: Math.round(hours * 10) / 10 });
      }
    };
    fetchStats();
  }, [user]);

  // Fetch transaction history from completed jobs
  useEffect(() => {
    if (!user) return;
    const fetchTransactions = async () => {
      const { data } = await supabase
        .from("job_responses")
        .select("id, created_at, earned, hours_worked, job_id, jobs(title)")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (data) {
        const txs = data.map((r: any) => ({
          type: "income" as const,
          amount: r.earned || 0,
          description: r.jobs?.title || "Выполненный заказ",
          date: new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
        }));
        setTransactions(txs);
      }
    };
    fetchTransactions();
  }, [user]);

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
        const { data: profiles } = await supabase.from("profiles_public" as any).select("user_id, full_name").in("user_id", reviewerIds);
        const nameMap: Record<string, string> = {};
        (profiles as any[])?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
        const withNames = data.map((r: any) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "Исполнитель" }));
        setReviews(withNames);
        setAvgRating(Math.round(data.reduce((s: number, r: any) => s + r.rating, 0) / data.length * 10) / 10);
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

  // ─── ADMIN PROFILE ───
  if (isAdmin) {
    return (
      <>
        <VerifiedPopup open={showVerified} onClose={() => setShowVerified(false)} />
        <div>
          <div className="px-5 safe-top pb-2 flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Профиль</h1>
            <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center">
              <Bell size={18} className="text-muted-foreground" />
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-18 h-18 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground" style={{ width: 72, height: 72 }}>G</div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-foreground">Gruzli Official</h2>
                  <BadgeCheck size={18} className="text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Официальный аккаунт</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-primary font-semibold">Администрация</span>
                  <button onClick={() => setShowVerified(true)} className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold cursor-pointer hover:bg-primary/20 transition-colors">✓ Верифицирован</button>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4">
            <p className="text-sm text-foreground leading-relaxed">Официальный аккаунт платформы Gruzli. Публикуем обновления, новости и отвечаем на вопросы пользователей.</p>
          </div>
          <div className="px-5 space-y-2">
            <AdminButton />
            <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
              <Settings size={18} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
              <LogOut size={18} className="text-destructive" />
              <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── DISPATCHER PROFILE ───
  if (isDispatcher) {
    const totalProfit = (profile as any)?.total_earned || 0;
    const weekProfit = weeklyStats.earned || 0;
    const ratingValue = avgRating || Number(profile?.rating) || 5.0;

    return (
      <>
        <VerifiedPopup open={showVerified} onClose={() => setShowVerified(false)} />
        {showTopUp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowTopUp(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative bg-card border border-border rounded-3xl p-6 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-3">
                  <Banknote size={26} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Пополнение баланса</h3>
                <p className="text-xs text-muted-foreground mt-1">Заявка будет отправлена администратору</p>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-1 border border-border rounded-2xl">
                  <input type="number" inputMode="numeric" placeholder="Сумма в ₽" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="w-full bg-transparent px-4 py-3.5 text-center text-xl font-bold text-foreground placeholder:text-muted-foreground/50 outline-none" autoFocus />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 2000, 5000].map((amount) => (
                    <button key={amount} onClick={() => setTopUpAmount(String(amount))} className="py-2 rounded-xl bg-surface-1 border border-border text-xs font-semibold text-foreground active:scale-95 transition-all">{amount}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowTopUp(false)} className="flex-1 py-3 rounded-2xl bg-surface-1 border border-border text-sm font-semibold text-muted-foreground active:scale-95 transition-all">Отмена</button>
                <button onClick={() => {
                  const amt = parseInt(topUpAmount);
                  if (!amt || amt <= 0) { toast.error("Введите корректную сумму"); return; }
                  setShowTopUp(false);
                  onOpenSupport?.(`💰 Заявка на пополнение баланса\n\nСумма: ${amt} ₽\nID пользователя: ${user?.id?.slice(0, 8).toUpperCase()}\nИмя: ${profile?.full_name || "—"}\n\nПрошу пополнить баланс.`);
                }} className="flex-1 py-3 rounded-2xl bg-foreground text-sm font-bold text-primary-foreground active:scale-95 transition-all">Пополнить</button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="pb-6">
          {/* Header */}
          <div className="px-5 safe-top pb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Профиль</h1>
            <div className="flex items-center gap-2">
              <button onClick={onOpenNotifications} aria-label="Уведомления" className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center active:scale-95 transition-transform">
                <Bell size={18} className="text-muted-foreground" />
              </button>
              <button onClick={onOpenSettings} aria-label="Настройки" className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center active:scale-95 transition-transform">
                <Settings size={18} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Hero: identity card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-5 mb-3 rounded-3xl bg-card border border-border overflow-hidden"
          >
            <div className="relative p-5">
              {/* Decorative grid */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative flex items-start gap-4">
                <AvatarWithUpload profile={profile} user={user} editable />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-lg font-bold text-foreground truncate">{profile?.full_name || "Диспетчер"}</h2>
                    {profile?.verified && (
                      <button onClick={() => setShowVerified(true)} aria-label="Аккаунт верифицирован">
                        <BadgeCheck size={18} className="text-primary" />
                      </button>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Shield size={11} className="text-primary" />
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Диспетчер</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <Star size={13} className="text-primary fill-primary" />
                      <span className="text-sm font-bold text-foreground">{ratingValue.toFixed(1)}</span>
                      <span className="text-[11px] text-muted-foreground ml-0.5">· {reviews.length}</span>
                    </div>
                    <button onClick={copyId} className="flex items-center gap-1 active:scale-95 transition-transform">
                      {idCopied ? <CheckCircle2 size={12} className="text-primary" /> : <Hash size={12} className="text-muted-foreground" />}
                      <span className="text-[11px] font-semibold text-muted-foreground tracking-wider">{shortId}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* PRIMARY CTA: Кабинет диспетчера */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-5 mb-3"
          >
            <button
              onClick={onOpenCabinet}
              className="w-full relative overflow-hidden rounded-3xl p-5 text-left active:scale-[0.98] transition-transform bg-card border border-border"
            >
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-border flex items-center justify-center flex-shrink-0">
                  <Briefcase size={24} className="text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Рабочее место</p>
                  <h3 className="text-lg font-extrabold text-foreground mt-0.5">Кабинет диспетчера</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Заявки · команда · аналитика</p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* "We are a company" CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.07 }}
            className="mx-5 mb-3"
          >
            <button
              disabled
              className="w-full relative overflow-hidden rounded-3xl p-5 text-left opacity-70 cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, hsl(220 70% 50%), hsl(260 55% 40%))",
                boxShadow: "0 8px 24px hsl(230 60% 45% / 0.35)",
              }}
            >
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
              {/* Diagonal yellow-black ribbon */}
              <div
                className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                style={{ overflow: "hidden" }}
              >
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    top: "50%",
                    left: "50%",
                    width: "140%",
                    height: "36px",
                    transform: "translate(-50%, -50%) rotate(-35deg)",
                    background: "repeating-linear-gradient(45deg, #facc15, #facc15 10px, #171717 10px, #171717 20px)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  }}
                >
                  <span
                    className="text-xs font-black uppercase tracking-[0.15em]"
                    style={{
                      color: "#facc15",
                      textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    В РАЗРАБОТЕ!
                  </span>
                </div>
              </div>
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Building2 size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Бизнес</p>
                  <h3 className="text-lg font-extrabold text-white mt-0.5 flex items-center gap-2">
                    Мы — компания
                    {(profile as any)?.is_company && (
                      <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-bold">Активно</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-white/80 mt-0.5">Налоги · выплаты · −50% на заявки</p>
                </div>
                <ChevronRight size={20} className="text-white/90 flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* Тарифы CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.09 }}
            className="mx-5 mb-3"
          >
            <button
              onClick={onOpenPremium}
              className="w-full relative overflow-hidden rounded-3xl p-5 text-left active:scale-[0.98] transition-transform bg-card border border-border"
            >
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Crown size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Подписка</p>
                  <h3 className="text-lg font-extrabold text-foreground mt-0.5 flex items-center gap-2">
                    Тарифы
                    {profile?.is_premium && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/15 text-[10px] font-bold text-primary">Активно</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Pro · аналитика · AI · от 299 ₽/мес</p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
              </div>
            </button>
          </motion.div>


          {/* Bank Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 200, delay: 0.1 }}
            className="mx-5 mb-3"
          >
            <BankCard
              balance={profile?.balance || 0}
              holderName={profile?.full_name || "DISPATCHER"}
              cardLast4={(profile?.display_id || "0000").slice(-4)}
              onTopUp={() => { setTopUpAmount(""); setShowTopUp(true); }}
            />
          </motion.div>

          {/* Quick metrics */}
          <div className="mx-5 mb-3 grid grid-cols-2 gap-2.5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">За неделю</span>
              </div>
              <p className="text-xl font-extrabold text-foreground">{weekProfit.toLocaleString("ru-RU")} ₽</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{weeklyStats.orders} заказ.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Всего</span>
              </div>
              <p className="text-xl font-extrabold text-foreground">{totalProfit.toLocaleString("ru-RU")} ₽</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">за всё время</p>
            </motion.div>
          </div>

          {/* Verification CTA */}
          {!profile?.verified && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-5 mb-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground">Верификация</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Поднимите доверие исполнителей</p>
                  </div>
                  <button onClick={() => toast.info("Функция верификации скоро будет доступна")} className="px-3.5 py-2 rounded-xl bg-foreground text-primary-foreground text-xs font-bold active:scale-95 transition-transform flex-shrink-0">Пройти</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Rating breakdown */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mx-5 mb-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={15} className="text-primary fill-primary" />
                  <span className="text-sm font-bold text-foreground">Рейтинг</span>
                </div>
                <span className="text-2xl font-extrabold text-foreground">{ratingValue.toFixed(1)}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${reviews.length > 0 ? (reviews.filter((r) => r.rating >= s).length / reviews.length) * 100 : (s <= Math.round(ratingValue) ? 100 : 0)}%` }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2.5">{reviews.length > 0 ? `На основе ${reviews.length} отзывов` : "Пока нет отзывов от исполнителей"}</p>
            </div>
          </motion.div>

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="mx-5 mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" />
                  Отзывы исполнителей
                </h2>
                <span className="text-[11px] text-muted-foreground">{reviews.length}</span>
              </div>
              <div className="space-y-2">
                {reviews.slice(0, 3).map((review) => (
                  <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground">{review.reviewer_name}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (<Star key={i} size={10} className={i < review.rating ? "text-primary fill-primary" : "text-muted"} />))}
                      </div>
                    </div>
                    {review.text && <p className="text-xs text-muted-foreground leading-relaxed">{review.text}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">{new Date(review.created_at).toLocaleDateString("ru-RU")}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Secondary actions */}
          <div className="px-5 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">Аккаунт</p>
            <button onClick={() => onOpenSupport?.()} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Headphones size={16} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground flex-1 text-left">Тех. поддержка</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Settings size={16} className="text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground flex-1 text-left">Настройки и тема</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border active:scale-[0.98] transition-transform">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <LogOut size={16} className="text-destructive" />
              </div>
              <span className="text-sm font-semibold text-destructive flex-1 text-left">Выйти</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── WORKER PROFILE ───
  const statsData = {
    today: { orders: profile?.completed_orders || 0, earned: `${((profile as any)?.total_earned || 0).toLocaleString("ru-RU")} ₽`, hours: `${monthlyStats.hours}ч` },
    week: { orders: weeklyStats.orders, earned: `${weeklyStats.earned.toLocaleString("ru-RU")} ₽`, hours: `${weeklyStats.hours}ч` },
    month: { orders: monthlyStats.orders, earned: `${monthlyStats.earned.toLocaleString("ru-RU")} ₽`, hours: `${monthlyStats.hours}ч` },
  };
  const stats = statsData[statsPeriod];

  return (
    <div className="gruzli-profile-screen app-scroll">
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Профиль</h1>
        <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Premium profile hero */}
      <div className="px-5 mt-2 mb-4">
        <div className="relative overflow-hidden rounded-[26px] border border-white/90 bg-white/72 p-5 shadow-[0_22px_55px_rgba(31,35,43,.09),inset_0_1px_0_rgba(255,255,255,.98)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-yellow-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-24 h-44 w-44 rounded-full bg-white/80 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="relative shrink-0">
              {profile?.is_premium && (
                <div className="absolute -inset-[4px] rounded-full bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-500 opacity-80" />
              )}
              <div className="relative rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(31,35,43,.12)]">
                <AvatarWithUpload profile={profile} user={user} editable />
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <h2 className="min-w-0 truncate text-[20px] font-extrabold tracking-[-0.035em] text-foreground">{profile?.full_name || "Пользователь"}</h2>
                {profile?.is_premium && <Crown size={16} className="shrink-0 fill-yellow-500 text-yellow-500" />}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-extrabold text-foreground">{profile?.rating || "5.00"}</span>
                <span className="text-xs text-muted-foreground">· {profile?.completed_orders || 0} заказов</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-background">Грузчик</span>
                {profile?.is_premium && <span className="rounded-full bg-yellow-300/35 px-2.5 py-1 text-[10px] font-bold text-yellow-800">Premium</span>}
              </div>
            </div>
          </div>
          <div className="relative mt-5 border-t border-border/60 pt-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Заработано за всё время</p>
                <div className="mt-1 text-[30px] font-extrabold leading-none tracking-[-.05em] text-foreground">{((profile as any)?.total_earned || 0).toLocaleString("ru-RU")} ₽</div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">За неделю</p>
                <p className="mt-0.5 text-sm font-extrabold text-foreground">{weeklyStats.earned.toLocaleString("ru-RU")} ₽</p>
                <p className="text-[10px] text-muted-foreground">{weeklyStats.orders} заказов</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium card */}
      {!profile?.is_premium ? (
        <div className="mx-5 mb-4">
          <button onClick={onOpenPremium} className="w-full rounded-2xl overflow-hidden" style={{
            background: "linear-gradient(135deg, hsl(43 96% 56%), hsl(38 92% 50%), hsl(25 95% 53%))",
            boxShadow: "0 4px 20px hsl(38 92% 50% / 0.3)",
          }}>
            <div className="px-5 py-4 flex items-center gap-3">
              <Crown size={24} className="text-white" />
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-bold">Подключить Premium</p>
                <p className="text-white/70 text-[11px]">Безлимитные заказы и приоритет</p>
              </div>
              <ChevronRight size={18} className="text-white/60" />
            </div>
          </button>
        </div>
      ) : (
        <div className="mx-5 mb-4 bg-card border border-yellow-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <Crown size={18} className="text-yellow-500" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Premium активен ✓</p>
              <p className="text-[11px] text-muted-foreground">
                До {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString("ru-RU") : "∞"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-5 pb-3">
        <div className="flex gap-1.5 bg-surface-1 border border-border rounded-2xl p-1.5">
          {(["today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setStatsPeriod(p)} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${statsPeriod === p ? "bg-foreground text-primary-foreground" : "text-muted-foreground"}`}>
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
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-3 text-center">
              <stat.icon size={18} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Worker Top-Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowTopUp(false)}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative bg-card border border-border rounded-3xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3">
                <Banknote size={28} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Пополнение баланса</h3>
              <p className="text-xs text-muted-foreground mt-1">Введите сумму, заявка уйдёт администратору</p>
            </div>
            <div className="space-y-3">
              <div className="bg-surface-1 border border-border rounded-2xl p-1">
                <input type="number" inputMode="numeric" placeholder="Введите сумму в ₽" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="w-full bg-transparent px-4 py-3 text-center text-lg font-bold text-foreground placeholder:text-muted-foreground/50 outline-none" autoFocus />
              </div>
              <div className="flex gap-2">
                {[500, 1000, 2000, 5000].map((amount) => (
                  <button key={amount} onClick={() => setTopUpAmount(String(amount))} className="flex-1 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 transition-all">{amount} ₽</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowTopUp(false)} className="flex-1 py-2.5 rounded-2xl bg-card border border-border text-sm font-semibold text-muted-foreground active:bg-surface-1 transition-all">Отмена</button>
              <button onClick={() => {
                const amt = parseInt(topUpAmount);
                if (!amt || amt <= 0) { toast.error("Введите корректную сумму"); return; }
                setShowTopUp(false);
                onOpenSupport?.(`💰 Заявка на пополнение баланса\n\nСумма: ${amt.toLocaleString("ru-RU")} ₽\nID пользователя: ${profile?.display_id || user?.id?.slice(0, 8).toUpperCase()}\nИмя: ${profile?.full_name || "—"}\n\nПрошу пополнить баланс.`);
              }} className="flex-1 py-2.5 rounded-2xl bg-foreground text-sm font-bold text-primary-foreground tap-scale">Отправить</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bank Card — Worker */}
      <div className="px-5 pb-5">
        <BankCard
          balance={profile?.balance || 0}
          holderName={profile?.full_name || "WORKER"}
          cardLast4={(profile?.display_id || "0000").slice(-4)}
          onTopUp={() => { setTopUpAmount(""); setShowTopUp(true); }}
          onSecondary={() => setShowTransactions(!showTransactions)}
          secondaryLabel="История"
          secondaryIcon={<span>📋</span>}
        />

        {/* Transaction History */}
        {showTransactions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-bold text-foreground">История транзакций</h3>
            </div>
            {transactions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Транзакций пока нет</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {transactions.map((tx, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      tx.type === "income" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                    }`}>
                      {tx.type === "income" ? "+" : "−"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{tx.description}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                    </div>
                    <span className={`text-sm font-bold ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                      {tx.type === "income" ? "+" : "−"}{tx.amount} ₽
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Skills — editable */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Навыки</h2>
          <button onClick={() => setEditingSkills(!editingSkills)} className="text-xs text-primary font-semibold">
            {editingSkills ? "Готово" : "Редактировать"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(userSkills.length ? userSkills : defaultSkills).map((skill: string) => (
            <span key={skill} className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {skill}
              {editingSkills && userSkills.includes(skill) && (
                <button onClick={() => removeSkill(skill)} className="text-destructive"><X size={12} /></button>
              )}
            </span>
          ))}
          {editingSkills && (
            <div className="flex items-center gap-1">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                placeholder="Навык..."
                className="w-24 px-3 py-2 rounded-xl bg-surface-1 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button onClick={addSkill} className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center">
                <Plus size={14} className="text-primary-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Availability — persisted */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Доступность</h2>
        <div className="grid grid-cols-7 gap-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
            <button key={day} onClick={() => { const next = [...availability]; next[i] = !next[i]; saveAvailability(next); }} className={`py-2.5 rounded-xl text-center text-xs font-semibold transition-all ${availability[i] ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Trophy size={14} className="text-primary" /> Топ грузчиков</h2>
        <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
          {leaderboard.map((l, i) => (
            <div key={l.name} className="flex items-center gap-3">
              <span className={`w-6 text-center text-xs font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
              </span>
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground">{l.avatar}</div>
              <span className="text-xs font-semibold text-foreground flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.score} заказов</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-2">
        <button onClick={() => onOpenSupport?.()} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
          <Headphones size={18} className="text-primary" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Тех. поддержка</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
          <Settings size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border tap-scale transition-colors">
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
