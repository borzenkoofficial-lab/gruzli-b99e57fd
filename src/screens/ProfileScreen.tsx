import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Bell, CreditCard, Trophy, Copy, CheckCircle2, MessageSquare, Hash, ShieldCheck, Headphones, BadgeCheck, Banknote, Crown, Camera, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { leaderboard } from "@/data/mockData";
import { toast } from "sonner";

const defaultSkills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

interface ProfileScreenProps {
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
  onOpenPremium?: () => void;
  onOpenCabinet?: () => void;
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

const ProfileScreen = ({ onOpenSettings, onOpenNotifications, onOpenSupport, onOpenPremium, onOpenCabinet }: ProfileScreenProps) => {
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
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", reviewerIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
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
    return (
      <>
        <VerifiedPopup open={showVerified} onClose={() => setShowVerified(false)} />
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
                <p className="text-xs text-muted-foreground mt-1">Введите сумму пополнения, заявка будет отправлена администратору</p>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-1 border border-border rounded-2xl p-1">
                  <input type="number" inputMode="numeric" placeholder="Введите сумму в ₽" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="w-full bg-transparent px-4 py-3 text-center text-lg font-bold text-foreground placeholder:text-muted-foreground/50 outline-none" autoFocus />
                </div>
                <div className="flex gap-2">
                  {[500, 1000, 2000, 5000].map((amount) => (
                    <button key={amount} onClick={() => setTopUpAmount(String(amount))} className="flex-1 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 border border-border transition-all">{amount} ₽</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowTopUp(false)} className="flex-1 py-2.5 rounded-2xl bg-card border border-border text-sm font-semibold text-muted-foreground active:bg-surface-1 border border-border transition-all">Отмена</button>
                <button onClick={() => {
                  const amt = parseInt(topUpAmount);
                  if (!amt || amt <= 0) { toast.error("Введите корректную сумму"); return; }
                  setShowTopUp(false);
                  onOpenSupport?.(`💰 Заявка на пополнение баланса\n\nСумма: ${amt} ₽\nID пользователя: ${user?.id?.slice(0, 8).toUpperCase()}\nИмя: ${profile?.full_name || "—"}\n\nПрошу пополнить баланс.`);
                }} className="flex-1 py-2.5 rounded-2xl bg-foreground text-sm font-bold text-primary-foreground tap-scale">Пополнить</button>
              </div>
            </motion.div>
          </div>
        )}
        <div>
          <div className="px-5 safe-top pb-2 flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Профиль</h1>
            <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center">
              <Bell size={18} className="text-muted-foreground" />
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="relative" style={{ width: 72, height: 72 }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-foreground flex items-center justify-center text-2xl font-bold text-primary-foreground">{initials}</div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{profile?.full_name || "Диспетчер"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">@{profile?.full_name?.toLowerCase().replace(/\s+/g, "_") || "dispatcher"}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Shield size={12} className="text-primary" />
                  <span className="text-xs text-primary font-semibold">Диспетчер</span>
                  {profile?.verified && (
                    <button onClick={() => setShowVerified(true)} className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-bold cursor-pointer hover:bg-primary/20 transition-colors">✓ Верифицирован</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ID Card */}
          <div className="mx-5 mb-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Индивидуальный ID</span>
                </div>
                <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border tap-scale transition-colors">
                  {idCopied ? <CheckCircle2 size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  <span className="text-sm font-bold text-foreground tracking-wider">{shortId}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="mx-5 mb-4 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(220 65% 58%))' }}>
            <div className="px-5 py-5">
              <p className="text-primary-foreground/70 text-xs font-medium mb-1">Баланс для заявок</p>
              <h2 className="text-primary-foreground text-3xl font-extrabold mb-1">{profile?.balance || 0} ₽</h2>
              <p className="text-primary-foreground/50 text-xs">Для оплаты размещения заявок</p>
            </div>
            <div className="px-5 pb-4">
              <button onClick={() => { setTopUpAmount(""); setShowTopUp(true); }} className="w-full py-3 rounded-xl bg-primary-foreground/20 text-primary-foreground text-sm font-bold tap-scale">💳 Пополнить баланс</button>
            </div>
          </div>

          {/* Verification */}
          {!profile?.verified && (
            <div className="mx-5 mb-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Shield size={22} className="text-primary" /></div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-foreground">Верификация</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Подтвердите личность для повышения доверия исполнителей</p>
                  </div>
                </div>
                <button onClick={() => toast.info("Функция верификации скоро будет доступна")} className="w-full mt-3 py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-bold tap-scale">Пройти верификацию</button>
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="mx-5 mb-4">
            <div className="bg-card border border-border rounded-2xl p-4">
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
                    <div className="h-full rounded-full bg-primary" style={{ width: `${reviews.length > 0 ? (reviews.filter((r) => r.rating >= s).length / reviews.length) * 100 : (s <= Math.round(profile?.rating || 5) ? 100 : 0)}%` }} />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{reviews.length > 0 ? `На основе ${reviews.length} отзывов` : "Пока нет отзывов от исполнителей"}</p>
            </div>
          </div>

          {/* Reviews */}
          <div className="mx-5 mb-4">
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><MessageSquare size={14} className="text-primary" />Отзывы исполнителей</h2>
            {reviews.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground">Отзывов пока нет.</p></div>
            ) : (
              <div className="space-y-2">
                {reviews.slice(0, 5).map((review) => (
                  <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">{review.reviewer_name}</span>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (<Star key={i} size={10} className={i < review.rating ? "text-primary fill-primary" : "text-muted"} />))}
                      </div>
                    </div>
                    {review.text && <p className="text-xs text-muted-foreground">{review.text}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(review.created_at).toLocaleDateString("ru-RU")}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Menu */}
          <div className="px-5 space-y-2">
            <button onClick={onOpenCabinet} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-foreground text-primary-foreground tap-scale transition-colors mb-2">
              <Briefcase size={18} />
              <span className="text-sm font-bold flex-1 text-left">Кабинет диспетчера</span>
              <ChevronRight size={16} className="opacity-60" />
            </button>
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
    <div>
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Профиль</h1>
        <button onClick={onOpenNotifications} className="w-11 h-11 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Hero earnings banner */}
      <div className="mx-5 mt-2 mb-4 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(220 65% 58%), hsl(195 100% 50%))' }}>
        <div className="px-5 py-5">
          <p className="text-primary-foreground/70 text-xs font-medium mb-1">Заработано за всё время</p>
          <h2 className="text-primary-foreground text-4xl font-extrabold mb-1">{((profile as any)?.total_earned || 0).toLocaleString("ru-RU")} ₽</h2>
          <p className="text-primary-foreground/60 text-xs">За неделю: {weeklyStats.earned.toLocaleString("ru-RU")} ₽ · {weeklyStats.orders} заказов</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profile?.is_premium && (
              <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
            )}
            <AvatarWithUpload profile={profile} user={user} editable />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-foreground">{profile?.full_name || "Пользователь"}</h2>
              {profile?.is_premium && <Crown size={16} className="text-yellow-500 fill-yellow-500" />}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-sm font-bold text-foreground">{profile?.rating || "5.00"}</span>
              <span className="text-xs text-muted-foreground ml-1">· {profile?.completed_orders || 0} заказов</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-semibold">Грузчик</span>
              {profile?.is_premium && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-[10px] text-yellow-500 font-bold">Premium</span>
              )}
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

      {/* Wallet */}
      <div className="px-5 pb-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              <span className="text-sm font-bold text-foreground">Кошелёк</span>
            </div>
            <span className="text-lg font-extrabold text-bg-foreground">{profile?.balance || 0} ₽</span>
          </div>
          <button onClick={() => setShowWallet(!showWallet)} className="w-full py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-bold tap-scale">💳 Вывести на карту</button>
          {showWallet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-muted-foreground">
              Минимальная сумма вывода: 1 000 ₽. Зачисление в течение 1-3 рабочих дней.
            </motion.div>
          )}
        </div>
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
