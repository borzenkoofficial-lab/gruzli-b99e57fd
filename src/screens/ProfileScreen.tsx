import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Bell, CreditCard, Trophy, Copy, CheckCircle2, MessageSquare, Hash, ShieldCheck, Headphones, BadgeCheck, Banknote, Crown, Camera, Plus, X, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboard } from "@/data/mockData";
import { toast } from "sonner";
import BankCard from "@/components/BankCard";
import { aggregateProfileMetrics } from "@/lib/profileMetrics";

interface ProfileScreenProps {
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
  onOpenPremium?: () => void;
  onOpenCabinet?: () => void;
  onOpenCompany?: () => void;
  onOpenChats?: () => void;
  onOpenDispatcherCabinet?: () => void;
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
    <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
      <ShieldCheck size={18} className="text-primary" />
      <span className="text-sm font-medium text-foreground flex-1 text-left">Админ-панель</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
};

const DemoRoleSwitcher = ({ role, onSwitch }: { role: string | null; onSwitch: (role: "worker" | "dispatcher" | "client") => void }) => (
  <div className="mx-5 mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-3">
    <div className="flex items-center justify-between gap-3 mb-2">
      <div><p className="text-xs font-bold text-foreground">Демо-режим</p><p className="text-[11px] text-muted-foreground">Переключайте роль без регистрации</p></div>
      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/15 text-foreground">3 роли</span>
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      {([["worker","Грузчик"],["dispatcher","Диспетчер"],["client","Заказчик"]] as const).map(([id,label]) => (
        <button key={id} onClick={() => onSwitch(id)} className={`rounded-xl py-2 text-[11px] font-semibold transition-colors ${role === id ? "bg-foreground text-background" : "bg-card border border-border text-foreground"}`}>{label}</button>
      ))}
    </div>
  </div>
);

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
        <div className="mx-auto w-16 h-16 rounded-full bg-[#fff5c7] border border-[#f2c400]/25 flex items-center justify-center">
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
  const initials = (profile?.full_name || user?.user_metadata?.full_name || "").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || !user) return;
    if (user.id.startsWith("demo-")) {
      toast.info("Загрузка фото доступна в личном аккаунте");
      input.value = "";
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error("Выберите изображение размером до 5 МБ");
      input.value = "";
      return;
    }

    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    // Storage RLS requires the first path segment to be the authenticated user ID.
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    try {
      const { error: uploadErr } = await supabase.storage.from("kartoteka-photos").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("kartoteka-photos").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id)
        .select("user_id")
        .single();
      if (profileError || !updatedProfile) {
        await supabase.storage.from("kartoteka-photos").remove([path]);
        throw profileError || new Error("Профиль не найден");
      }

      toast.success("Фото обновлено");
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (error) {
      console.error("[Gruzli Profile] avatar upload failed:", error);
      toast.error("Не удалось сохранить фото. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
      input.value = "";
    }
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

const ProfileScreen = ({ onOpenSettings, onOpenNotifications, onOpenSupport, onOpenPremium, onOpenCabinet, onOpenCompany, onOpenChats, onOpenDispatcherCabinet }: ProfileScreenProps) => {
  const { user, profile, role, signOut } = useAuth();
  const [availability, setAvailability] = useState<boolean[]>(Array(7).fill(false));
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
  const [todayStats, setTodayStats] = useState({ orders: 0, earned: 0, hours: 0 });
  const [weeklyStats, setWeeklyStats] = useState({ orders: 0, earned: 0, hours: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ orders: 0, earned: 0, hours: 0 });
  const [dispatcherTotalIncome, setDispatcherTotalIncome] = useState(0);
  const [dispatcherCompletedJobs, setDispatcherCompletedJobs] = useState(0);
  const [clientOrdersCount, setClientOrdersCount] = useState<number | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<{ type: "income" | "expense"; amount: number; description: string; date: string }[]>([]);

  const isDispatcher = role === "dispatcher";
  const isAdmin = role === "admin";
  const isDemo = user?.id?.startsWith("demo-") === true;
  const switchDemoRole = (nextRole: "worker" | "dispatcher" | "client") => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", nextRole);
    window.dispatchEvent(new Event("gruzli-demo-change"));
    window.dispatchEvent(new Event("navigate-to-feed"));
    toast.success(`Демо: ${nextRole === "worker" ? "Грузчик" : nextRole === "dispatcher" ? "Диспетчер" : "Заказчик"}`);
  };
  const displayName = profile?.full_name?.trim()
    || String(user?.user_metadata?.full_name || "").trim()
    || (isDispatcher ? "Диспетчер" : role === "client" ? "Заказчик" : role === "worker" ? "Грузчик" : "Пользователь");
  const birthDateLabel = profile?.birth_date
    ? new Date(`${profile.birth_date}T00:00:00`).toLocaleDateString("ru-RU")
    : null;
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const shortId = profile?.display_id || user?.id?.slice(0, 8).toUpperCase() || "—";
  const lastSeenMs = profile?.last_seen_at ? Date.parse(profile.last_seen_at) : Number.NaN;
  const lastSeenAge = Date.now() - lastSeenMs;
  const workerPresenceLabel =
    Number.isFinite(lastSeenMs) && lastSeenAge >= 0 && lastSeenAge <= 2 * 60 * 1000
      ? "В СЕТИ"
      : profile?.last_seen_at
        ? "НЕ В СЕТИ"
        : "СТАТУС НЕ УКАЗАН";

  // Load availability from DB
  useEffect(() => {
    const saved = profile?.availability;
    setAvailability(Array.isArray(saved) && saved.length === 7 ? [...saved] : Array(7).fill(false));
  }, [profile]);

  // Load skills
  useEffect(() => {
    setUserSkills(profile?.skills?.length ? profile.skills : []);
  }, [profile]);

  // Save availability to DB
  const saveAvailability = async (next: boolean[]) => {
    const previous = availability;
    setAvailability(next);
    if (!user || isDemo) return;

    const { data: updatedProfile, error } = await supabase.from("profiles").update({ availability: next } as any).eq("user_id", user.id).select("user_id").single();
    if (error || !updatedProfile) {
      console.error("[Gruzli Profile] availability save failed:", error);
      setAvailability(previous);
      toast.error("Не удалось сохранить расписание доступности");
      return;
    }
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  // Save only real profile skills; never silently pretend that demo defaults were saved.
  const saveSkills = async (skills: string[]) => {
    const previous = userSkills;
    setUserSkills(skills);
    if (!user || isDemo) return;

    const { data: updatedProfile, error } = await supabase.from("profiles").update({ skills }).eq("user_id", user.id).select("user_id").single();
    if (error || !updatedProfile) {
      console.error("[Gruzli Profile] skills save failed:", error);
      setUserSkills(previous);
      toast.error("Не удалось сохранить навыки");
      return;
    }
    window.dispatchEvent(new CustomEvent("profile-updated"));
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

  // Load metrics from completed work, using the completion timestamp rather than
  // the time the worker first responded to an order.
  useEffect(() => {
    if (!user || !role) return;
    let cancelled = false;

    const fetchStats = async () => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const queryStart = weekStart < monthStart ? weekStart : monthStart;

      if (isDemo) {
        if (!cancelled) {
          setTodayStats({ orders: 0, earned: 0, hours: 0 });
          setWeeklyStats({ orders: 0, earned: 0, hours: 0 });
          setMonthlyStats({ orders: 0, earned: 0, hours: 0 });
          setDispatcherTotalIncome(0);
          setDispatcherCompletedJobs(0);
        }
        return;
      }

      if (role === "dispatcher") {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, dispatcher_income, updated_at")
          .eq("dispatcher_id", user.id)
          .eq("status", "completed")
          .order("updated_at", { ascending: false });

        if (cancelled) return;
        if (error) {
          console.error("[Gruzli Profile] dispatcher statistics failed:", error);
          setTodayStats({ orders: 0, earned: 0, hours: 0 });
          setWeeklyStats({ orders: 0, earned: 0, hours: 0 });
          setMonthlyStats({ orders: 0, earned: 0, hours: 0 });
          toast.error("Не удалось загрузить статистику диспетчера");
          return;
        }

        const rows = (data || []).map((job) => ({ ...job, completedAt: job.updated_at }));
        setTodayStats(aggregateProfileMetrics(rows, todayStart.getTime(), now.getTime(), "dispatcher_income"));
        setWeeklyStats(aggregateProfileMetrics(rows, weekStart.getTime(), now.getTime(), "dispatcher_income"));
        setMonthlyStats(aggregateProfileMetrics(rows, monthStart.getTime(), now.getTime(), "dispatcher_income"));
        setDispatcherTotalIncome(rows.reduce((sum, row) => sum + Number(row.dispatcher_income || 0), 0));
        setDispatcherCompletedJobs(rows.length);
        return;
      }

      if (role !== "worker") return;

      const { data, error } = await supabase
        .from("job_responses")
        .select("id, job_id, work_finished_at, hours_worked, earned")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .gte("work_finished_at", queryStart.toISOString())
        .lte("work_finished_at", now.toISOString());

      if (cancelled) return;
      if (error) {
        console.error("[Gruzli Profile] worker statistics failed:", error);
        setTodayStats({ orders: 0, earned: 0, hours: 0 });
        setWeeklyStats({ orders: 0, earned: 0, hours: 0 });
        setMonthlyStats({ orders: 0, earned: 0, hours: 0 });
        toast.error("Не удалось загрузить статистику работы");
        return;
      }

      const rows = (data || []).map((row) => ({ ...row, completedAt: row.work_finished_at }));
      setTodayStats(aggregateProfileMetrics(rows, todayStart.getTime(), now.getTime()));
      setWeeklyStats(aggregateProfileMetrics(rows, weekStart.getTime(), now.getTime()));
      setMonthlyStats(aggregateProfileMetrics(rows, monthStart.getTime(), now.getTime()));
    };

    void fetchStats();
    return () => { cancelled = true; };
  }, [user?.id, role, isDemo]);

  // Client order count comes from the client's actual job rows, not the worker-oriented profile counter.
  useEffect(() => {
    if (!user || role !== "client" || isDemo) {
      setClientOrdersCount(null);
      return;
    }

    let cancelled = false;
    const fetchClientOrderCount = async () => {
      const { count, error } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user.id);

      if (cancelled) return;
      if (error) {
        console.error("[Gruzli Profile] client order count failed:", error);
        setClientOrdersCount(null);
        return;
      }
      setClientOrdersCount(count ?? 0);
    };

    void fetchClientOrderCount();
    const channel = supabase
      .channel(`client-profile-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `client_id=eq.${user.id}` }, () => {
        void fetchClientOrderCount();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, role, isDemo]);

  // Fetch transaction history from completed jobs
  useEffect(() => {
    if (!user) return;
    const fetchTransactions = async () => {
      if (isDemo || role !== "worker") {
        setTransactions([]);
        return;
      }

      const { data, error } = await supabase
        .from("job_responses")
        .select("id, created_at, work_finished_at, earned, hours_worked, job_id, jobs(title)")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .order("work_finished_at", { ascending: false, nullsFirst: false })
        .limit(20);

      if (error) {
        console.error("[Gruzli Profile] work history failed:", error);
        toast.error("Не удалось загрузить историю работы");
        return;
      }

      if (data) {
        const txs = data.map((r: any) => ({
          type: "income" as const,
          amount: Number(r.earned || 0),
          description: r.jobs?.title || "Выполненный заказ",
          date: new Date(r.work_finished_at || r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
        }));
        setTransactions(txs);
      }
    };
    fetchTransactions();
  }, [user?.id, role, isDemo]);

  // Fetch dispatcher reviews and clear them when the signed-in role/account changes.
  useEffect(() => {
    if (!isDispatcher || !user) {
      setReviews([]);
      setAvgRating(0);
      return;
    }

    let cancelled = false;
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("dispatcher_reviews")
        .select("*")
        .eq("dispatcher_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[Gruzli Profile] dispatcher reviews failed:", error);
        setReviews([]);
        setAvgRating(0);
        toast.error("Не удалось загрузить отзывы");
        return;
      }

      const rows = data || [];
      if (rows.length === 0) {
        setReviews([]);
        setAvgRating(0);
        return;
      }

      const reviewerIds = [...new Set(rows.map((r: any) => r.reviewer_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles_public" as any)
        .select("user_id, full_name")
        .in("user_id", reviewerIds);

      if (cancelled) return;
      if (profilesError) console.error("[Gruzli Profile] review author profiles failed:", profilesError);

      const nameMap: Record<string, string> = {};
      (profiles as any[] || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
      const withNames = rows.map((r: any) => ({ ...r, reviewer_name: nameMap[r.reviewer_id] || "Исполнитель" }));
      setReviews(withNames);
      setAvgRating(Math.round(rows.reduce((sum: number, review: any) => sum + review.rating, 0) / rows.length * 10) / 10);
    };

    void fetchReviews();
    return () => { cancelled = true; };
  }, [isDispatcher, user?.id]);

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
            <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Gruzli</p><h1 className="text-[29px] font-extrabold text-foreground tracking-[-.045em] leading-none">Профиль</h1></div>
            <button onClick={onOpenNotifications} className="w-11 h-11 rounded-[16px] bg-white/72 border border-white/90 flex items-center justify-center shadow-sm backdrop-blur-xl">
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
            <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
              <Settings size={18} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
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
    const totalProfit = dispatcherTotalIncome;
    const weekProfit = weeklyStats.earned || 0;
    const ratingValue = reviews.length > 0
      ? avgRating
      : profile?.rating == null ? null : Number(profile.rating);
    const ratingLabel = ratingValue == null ? "—" : ratingValue.toFixed(1);

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
                  onOpenSupport?.(`💰 Заявка на пополнение баланса\n\nСумма: ${amt} ₽\nID пользователя: ${user?.id?.slice(0, 8).toUpperCase()}\nИмя: ${displayName}\n\nПрошу пополнить баланс.`);
                }} className="flex-1 py-3 rounded-2xl bg-foreground text-sm font-bold text-primary-foreground active:scale-95 transition-all">Отправить заявку</button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="pb-6 native-surface">
          {isDemo && (
            <div className="px-5 pt-3">
              <DemoRoleSwitcher role={role} onSwitch={switchDemoRole} />
            </div>
          )}
          {/* Header */}
          <div className="px-5 safe-top pb-3 flex items-center justify-between">
            <div className="gruzli-page-enter gruzli-profile-title"><span>GRUZLI / 04</span><h1>Профиль</h1></div>
            <div className="flex items-center gap-2">
              <button onClick={onOpenNotifications} aria-label="Уведомления" className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center native-press active:scale-95 transition-transform">
                <Bell size={18} className="text-muted-foreground" />
              </button>
              <button onClick={onOpenSettings} aria-label="Настройки" className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center native-press active:scale-95 transition-transform">
                <Settings size={18} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Dispatcher identity mockup */}
          <div className="mx-5 mb-4">
            <div className="relative overflow-hidden rounded-[28px] bg-[#181818] text-white p-5 min-h-[210px]">
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/10" />
              <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-[#f2c400]/25" />
              <div className="absolute left-0 bottom-0 h-1 w-full bg-[#f2c400]" />
              <div className="relative flex items-start gap-4">
                <AvatarWithUpload profile={profile} user={user} editable />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] uppercase tracking-[.18em] text-white/45">DISPATCHER / ID</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <h2 className="text-xl font-extrabold truncate">{displayName}</h2>
                    {profile?.verified && <BadgeCheck size={17} className="shrink-0 text-[#f2c400]" />}
                    {birthDateLabel && <p className="mt-1 text-[11px] text-white/55">Дата рождения: {birthDateLabel}</p>}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f2c400]" />
                    <span className="text-[10px] font-bold">ДИСПЕТЧЕР</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs font-bold"><Star size={12} className="fill-[#f2c400] text-[#f2c400]"/>{ratingLabel}</span>
                    <span className="text-[10px] text-white/45">{reviews.length} отзывов</span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between border-t border-white/10 pt-3">
                <div><span className="block text-[8px] uppercase tracking-[.16em] text-white/40">DISPATCHER NUMBER</span><strong className="text-sm tracking-wider">{shortId}</strong></div>
                <div className="text-right"><span className="block text-[8px] uppercase tracking-[.16em] text-white/40">ПРИБЫЛЬ / НЕД</span><strong className="text-lg">{weekProfit.toLocaleString("ru-RU")} ₽</strong></div>
              </div>
            </div>
          </div>

          <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
            {[
              ["Рейтинг", ratingLabel, "из 5"],
              ["Заказы", String(dispatcherCompletedJobs), "завершено"],
              ["Доход", totalProfit.toLocaleString("ru-RU") + " ₽", "всего"],
            ].map(([label,value,caption]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-3">
                <span className="block text-[8px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</span>
                <strong className="mt-1 block text-base font-extrabold truncate">{value}</strong>
                <span className="text-[9px] text-muted-foreground">{caption}</span>
              </div>
            ))}
          </div>

          {/* PRIMARY CTA: Кабинет диспетчера */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-5 mb-3"
          >
            <button
              onClick={onOpenDispatcherCabinet}
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
              holderName={displayName.toUpperCase()}
              cardLast4={(profile?.display_id || "0000").slice(-4)}
              onTopUp={() => { setTopUpAmount(""); setShowTopUp(true); }}
            />
          </motion.div>

          {/* Quick metrics */}
          <div className="mx-5 mb-3 grid grid-cols-2 gap-2.5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-2xl p-4 native-surface">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">За неделю</span>
              </div>
              <p className="text-xl font-extrabold text-foreground">{weekProfit.toLocaleString("ru-RU")} ₽</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{weeklyStats.orders} заказ.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card border border-border rounded-2xl p-4 native-surface">
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
              <div className="bg-card border border-border rounded-2xl p-4 native-surface">
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
            <div className="bg-card border border-border rounded-2xl p-4 native-surface">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={15} className="text-primary fill-primary" />
                  <span className="text-sm font-bold text-foreground">Рейтинг</span>
                </div>
                <span className="text-2xl font-extrabold text-foreground">{ratingLabel}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${reviews.length > 0 ? (reviews.filter((r) => r.rating >= s).length / reviews.length) * 100 : 0}%` }}
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

  // ─── CLIENT PROFILE ───
  if (role === "client") {
    const clientOrders = clientOrdersCount === null ? "—" : clientOrdersCount;
    return (
      <div className="gruzli-profile-screen pb-8">
        {isDemo && <div className="px-5 pt-3"><DemoRoleSwitcher role={role} onSwitch={switchDemoRole} /></div>}
        <div className="px-5 safe-top pt-2 pb-4 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">GRUZLI / CLIENT</span>
            <h1 className="mt-1 text-[28px] leading-none font-extrabold tracking-[-.045em]">Аккаунт</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center"><Bell size={18} className="text-muted-foreground"/></button>
            <button onClick={onOpenSettings} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center"><Settings size={18} className="text-muted-foreground"/></button>
          </div>
        </div>

        <div className="px-5 mb-4">
          <div className="relative overflow-hidden rounded-[28px] bg-[#181818] text-white p-5 min-h-[190px]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10" />
            <div className="absolute right-5 bottom-5 h-20 w-20 rounded-full border border-[#f2c400]/30" />
            <div className="relative flex items-start gap-4">
              <AvatarWithUpload profile={profile} user={user} editable />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] uppercase tracking-[.18em] text-white/45">CLIENT ID</span>
                <h2 className="mt-1 text-xl font-extrabold truncate">{displayName}</h2>
                {birthDateLabel && <p className="mt-1 text-[11px] text-white/55">Дата рождения: {birthDateLabel}</p>}
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold">
                  <Building2 size={11} className="text-[#f2c400]"/> ЗАКАЗЧИК
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between border-t border-white/10 pt-3">
              <div><span className="block text-[8px] uppercase tracking-[.16em] text-white/40">ACCOUNT</span><strong className="text-sm tracking-wider">{shortId}</strong></div>
              <div className="text-right"><span className="block text-[8px] uppercase tracking-[.16em] text-white/40">ЗАКАЗОВ</span><strong className="text-lg">{clientOrders}</strong></div>
            </div>
          </div>
        </div>

        <div className="px-5 space-y-3">
          <div className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">01 / ORDERS</span><h2 className="text-base font-extrabold mt-1">Мои заказы</h2></div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{clientOrders}</span>
            </div>
            <button onClick={onOpenCabinet} className="w-full flex items-center gap-3 rounded-2xl bg-[#f2c400] px-4 py-3.5 text-left text-black">
              <Plus size={18}/><span className="flex-1 text-sm font-extrabold">Создать новый заказ</span><ChevronRight size={16}/>
            </button>
          </div>

          <div className="rounded-[24px] border border-border bg-card overflow-hidden">
            {[
              {icon: MessageSquare,label:"Чаты с диспетчерами",action:onOpenChats},
              {icon: ShieldCheck,label:"Безопасность аккаунта",action:onOpenSettings},
              {icon: Headphones,label:"Поддержка Gruzli",action:()=>onOpenSupport?.()},
            ].map(({icon:Icon,label,action})=>(
              <button key={label} onClick={action} className="w-full flex items-center gap-3 px-4 py-4 border-b last:border-0 border-border/60 text-left active:bg-muted/50">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted"><Icon size={17}/></span>
                <span className="flex-1 text-sm font-semibold">{label}</span><ChevronRight size={16} className="text-muted-foreground"/>
              </button>
            ))}
          </div>
          <button onClick={signOut} className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-destructive">Выйти из аккаунта</button>
        </div>
      </div>
    );
  }

  // ─── WORKER PROFILE ───
  const activeDays = availability.filter(Boolean).length;
  const selectedStats = statsPeriod === "today" ? todayStats : statsPeriod === "week" ? weeklyStats : monthlyStats;
  const profileCompletion = Math.min(100, Math.round(
    ([profile?.full_name, profile?.avatar_url, userSkills.length > 0, profile?.phone, profile?.birth_date].filter(Boolean).length / 5) * 100
  ));

  return (
    <div className="gruzli-profile-screen">
      {isDemo && (
        <div className="px-5 pt-3">
          <DemoRoleSwitcher role={role} onSwitch={switchDemoRole} />
        </div>
      )}
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Профиль</h1>
        <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Worker identity mockup — physical-style Gruzli ID */}
      <div className="px-5 mb-5">
        <motion.div
          className="gruzli-worker-id-mockup gruzli-worker-id-hero"
          initial={{ opacity: 0, y: 14, rotateX: 7 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="gruzli-worker-id-glow" />
          <div className="gruzli-worker-id-top">
            <div className="gruzli-worker-id-brand">
              <span>GRUZLI</span>
              <i />
            </div>
            <span>WORKER ID / 2026</span>
          </div>

          <div className="gruzli-worker-id-body">
            <div className="gruzli-worker-id-photo-wrap">
              <AvatarWithUpload profile={profile} user={user} editable />
              <span className="gruzli-worker-id-chip">01</span>
            </div>
            <div className="gruzli-worker-id-info">
              <span className="gruzli-worker-id-label">ИСПОЛНИТЕЛЬ</span>
              <strong>{displayName}</strong>
              {birthDateLabel && <small>Дата рождения: {birthDateLabel}</small>}
              <span className="gruzli-worker-id-role">ГРУЗЧИК · {profile?.is_premium ? "PREMIUM" : "STANDARD"}</span>
              <div className="gruzli-worker-id-meta">
                <span><b>{profile?.rating == null ? "—" : Number(profile.rating).toFixed(2)}</b> рейтинг</span>
                <span><b>{profile?.completed_orders || 0}</b> заказов</span>
              </div>
            </div>
          </div>

          <div className="gruzli-worker-id-bottom">
            <div className="gruzli-worker-id-number">
              <span>WORKER NUMBER</span>
              <strong>{shortId}</strong>
            </div>
            <div className="gruzli-worker-id-bars" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div className="gruzli-worker-id-status">
              <span />
              {workerPresenceLabel}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-5 pb-5">
        <div className="gruzli-worker-dashboard">
          <div className="gruzli-worker-dashboard-head">
            <div><span className="gruzli-worker-dashboard-index">01 / WORK PROFILE</span><h2>Рабочий профиль</h2></div>
            <span className="gruzli-worker-dashboard-live"><i /> LIVE</span>
          </div>
          <div className="gruzli-worker-dashboard-grid">
            <div><span>РЕЙТИНГ</span><strong>{profile?.rating == null ? "—" : Number(profile.rating).toFixed(2)}</strong><small>из 5.0</small></div>
            <div><span>ЗАКАЗОВ</span><strong>{profile?.completed_orders || 0}</strong><small>завершено</small></div>
            <div><span>ДОСТУПНО</span><strong>{activeDays}/7</strong><small>дней</small></div>
            <div><span>ПРОФИЛЬ</span><strong>{profileCompletion}%</strong><small>заполнено</small></div>
          </div>
          <div className="gruzli-worker-dashboard-calendar">
            <div className="gruzli-worker-calendar-head"><span>ДОСТУПНОСТЬ</span><span>{activeDays} активных дней</span></div>
            <div className="gruzli-worker-calendar-days">
              {["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"].map((day, i) => (
                <button key={day} onClick={() => { const next = [...availability]; next[i] = !next[i]; saveAvailability(next); }} className={availability[i] ? "is-active" : ""}>
                  <span>{day}</span><i />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="gruzli-earnings-mockup">
          <div className="gruzli-earnings-head">
            <div><span>02 / PERFORMANCE</span><h2>Доход и загрузка</h2></div>
            <div className="gruzli-earnings-tabs">
              {(["today","week","month"] as const).map((period) => (
                <button key={period} onClick={() => setStatsPeriod(period)} className={statsPeriod === period ? "is-active" : ""}>{period === "today" ? "ДЕНЬ" : period === "week" ? "НЕД" : "МЕС"}</button>
              ))}
            </div>
          </div>
          <div className="gruzli-earnings-main">
            <div>
              <span>ЗАРАБОТАНО</span>
              <strong>{selectedStats.earned.toLocaleString("ru-RU")} ₽</strong>
            </div>
            <div className="gruzli-earnings-ring">
              <strong>{selectedStats.orders}</strong><span>заказов</span>
            </div>
          </div>
          <div className="gruzli-earnings-meta">
            <span><b>{selectedStats.hours}</b> ч. работы</span>
            <span><b>{activeDays}</b> дней доступен</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="gruzli-profile-section-head">
          <div><span className="gruzli-profile-section-index">03</span><h2 className="text-sm font-bold text-foreground">История работы</h2></div>
          <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">{transactions.length} записей</span>
        </div>
        {transactions.length > 0 ? (
          <div className="gruzli-work-history">
            {transactions.slice(0, 5).map((tx, index) => (
              <div key={tx.date + tx.description + index} className="gruzli-work-history-row">
                <span className="gruzli-work-history-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="gruzli-work-history-main"><strong>{tx.description}</strong><span>{tx.date}</span></div>
                <b>+{tx.amount.toLocaleString("ru-RU")} ₽</b>
              </div>
            ))}
          </div>
        ) : <div className="gruzli-work-history-empty">Завершённые заказы появятся здесь после первой выполненной смены.</div>}
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

      {/* 05 / WALLET — Worker */}
      <div className="px-5 pb-5">
        <div className="gruzli-wallet-section-head"><span>05 / WALLET</span><i /><b>ЛИЧНЫЙ БАЛАНС</b></div>
        <BankCard
          balance={profile?.balance || 0}
          holderName={displayName.toUpperCase()}
          cardLast4={(profile?.display_id || "0000").slice(-4)}
          onTopUp={() => { setTopUpAmount(""); setShowTopUp(true); }}
          onSecondary={() => setShowTransactions(!showTransactions)}
          secondaryLabel="Заработок"
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
              <h3 className="text-sm font-bold text-foreground">История заработка</h3>
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
        <div className="gruzli-profile-section-head">
          <div>
            <span className="gruzli-profile-section-index">02</span>
            <h2 className="text-sm font-bold text-foreground">Навыки</h2>
          </div>
          <button onClick={() => setEditingSkills(!editingSkills)} className="text-xs text-primary font-semibold">
            {editingSkills ? "Готово" : "Редактировать"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {userSkills.length > 0 ? userSkills.map((skill: string) => (
            <span key={skill} className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {skill}
              {editingSkills && (
                <button onClick={() => removeSkill(skill)} className="text-destructive" aria-label={`Удалить навык ${skill}`}><X size={12} /></button>
              )}
            </span>
          )) : (
            <p className="w-full text-xs text-muted-foreground">
              {editingSkills ? "Добавьте навыки, которыми владеете." : "Навыки пока не указаны."}
            </p>
          )}
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

      {/* Menu */}
      <div className="px-5 space-y-2">
        <button onClick={() => onOpenSupport?.()} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
          <Headphones size={18} className="text-primary" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Тех. поддержка</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
          <Settings size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Настройки</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border native-list-item tap-scale transition-colors">
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-medium text-destructive flex-1 text-left">Выйти</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
