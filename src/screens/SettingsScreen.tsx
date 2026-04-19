import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Phone, Bell, Shield, Palette, LogOut, Camera, Check, Loader2, Volume2, Vibrate, Layers, Mail, Ban, Trash2, Info, Globe, Database, Share2, Star, Smartphone, HardDrive, Crown, BadgeCheck, Send, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { toast } from "sonner";
import { z } from "zod";
import { LegalModal } from "@/components/LegalDocuments";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Минимум 2 символа").max(100, "Максимум 100 символов"),
  phone: z.string().trim().max(20, "Максимум 20 символов").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Минимум 6 символов").max(128, "Максимум 128 символов"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

interface SettingsScreenProps {
  onBack: () => void;
  onOpenPremium?: () => void;
}

type Section = "main" | "profile" | "notifications" | "security" | "appearance" | "blocked" | "about" | "language" | "storage" | "verification";

const SettingsScreen = ({ onBack, onOpenPremium }: SettingsScreenProps) => {
  const { user, profile, signOut, role } = useAuth();
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);
  const { settings: notifSettings, update: updateNotif } = useNotificationSettings();
  const [section, setSection] = useState<Section>("main");

  // Profile edit state
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Theme state
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") || "dark");

  // Language state
  const [language, setLanguage] = useState(() => localStorage.getItem("app_language") || "ru");

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; full_name: string }[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<"privacy" | "terms" | "personal_data">("privacy");

  // Verification state
  const [vFullName, setVFullName] = useState(profile?.full_name || "");
  const [vAge, setVAge] = useState("");
  const [vPhone, setVPhone] = useState(profile?.phone || "");
  const [vOrgType, setVOrgType] = useState<"ip" | "self" | "ooo">("self");
  const [vOrgName, setVOrgName] = useState("");
  const [vSending, setVSending] = useState(false);
  const [supportUserId, setSupportUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).single()
      .then(({ data }) => { if (data) setSupportUserId(data.user_id); });
  }, []);
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("kartoteka-photos").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Ошибка загрузки"); setAvatarUploading(false); return; }
    const { data: urlData } = supabase.storage.from("kartoteka-photos").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    toast.success("Фото обновлено");
    setAvatarUploading(false);
    window.location.reload();
  };

  const handleSaveProfile = async () => {
    const result = profileSchema.safeParse({ full_name: fullName, phone });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setProfileErrors(errs);
      return;
    }
    setProfileErrors({});
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: result.data.full_name, phone: result.data.phone || "" }).eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error("Не удалось сохранить");
    else toast.success("Профиль обновлён");
  };

  const handleChangePassword = async () => {
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setPasswordErrors(errs);
      return;
    }
    setPasswordErrors({});
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: result.data.password });
    setChangingPassword(false);
    if (error) toast.error("Ошибка: " + error.message);
    else { toast.success("Пароль изменён"); setPassword(""); setConfirmPassword(""); }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Вы уверены что хотите удалить аккаунт? Это действие необратимо.")) return;
    await signOut();
    toast.info("Обратитесь в поддержку для удаления аккаунта");
  };

  const toggleTheme = (newTheme: string) => {
    setTheme(newTheme);
    const el = document.documentElement;
    // Remove all theme classes
    el.classList.remove("light", "theme-midnight", "theme-emerald", "theme-crimson", "theme-amber");
    // Apply the right class
    if (newTheme === "light") el.classList.add("light");
    else if (newTheme !== "dark") el.classList.add(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem("app_language", lang);
    toast.success(lang === "ru" ? "Язык: Русский" : "Language: English");
  };

  const fetchBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    const { data: blocks } = await supabase.from("blocked_users").select("id, blocked_id").eq("blocker_id", user.id);
    if (blocks && blocks.length > 0) {
      const ids = blocks.map((b) => b.blocked_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
      setBlockedUsers(blocks.map((b) => ({ id: b.id, blocked_id: b.blocked_id, full_name: nameMap[b.blocked_id] || "Пользователь" })));
    } else {
      setBlockedUsers([]);
    }
    setLoadingBlocked(false);
  };

  const unblockUser = async (blockId: string) => {
    await supabase.from("blocked_users").delete().eq("id", blockId);
    toast.success("Пользователь разблокирован");
    fetchBlockedUsers();
  };

  const clearCache = () => {
    const theme = localStorage.getItem("theme");
    localStorage.clear();
    if (theme) localStorage.setItem("theme", theme);
    toast.success("Кеш очищен");
    setTimeout(() => window.location.reload(), 500);
  };

  const handleShareApp = async () => {
    const shareData = {
      title: "Gruzli",
      text: "Gruzli — платформа для грузчиков и диспетчеров. Быстрый поиск работы!",
      url: "https://gruzli.lovable.app",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Ссылка скопирована!");
      }
    } catch {
      // user cancelled share
    }
  };

  const handleRateApp = () => {
    toast.success("Спасибо за вашу оценку! ⭐");
  };

  const getStorageEstimate = () => {
    const keys = Object.keys(localStorage);
    let totalBytes = 0;
    keys.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) totalBytes += key.length + val.length;
    });
    return {
      items: keys.length,
      sizeKB: (totalBytes / 1024).toFixed(1),
    };
  };

  const InputField = ({ label, value, onChange, error, placeholder, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string;
  }) => (
    <div className="mb-4">
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );

  const MenuItem = ({ icon: Icon, label, desc, onClick, destructive, badge }: {
    icon: any; label: string; desc: string; onClick: () => void; destructive?: boolean; badge?: string;
  }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 py-3 px-1 active:opacity-70 transition-opacity">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${destructive ? "bg-destructive/10" : "bg-surface-1"}`}>
        <Icon size={17} className={destructive ? "text-destructive" : "text-muted-foreground"} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-[14px] font-medium ${destructive ? "text-destructive" : "text-foreground"}`}>{label}</p>
      </div>
      {badge && <span className="text-[11px] text-primary font-semibold">{badge}</span>}
      <ArrowLeft size={14} className="text-muted-foreground/40 rotate-180 shrink-0" />
    </button>
  );

  const Header = ({ title, onBack: goBack }: { title: string; onBack: () => void }) => (
    <div className="flex items-center gap-3 px-5 safe-top pb-5">
      <button onClick={goBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
        <ArrowLeft size={18} className="text-foreground" />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );

  const Toggle = ({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) => (
    <button onClick={onToggle} disabled={disabled} className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${enabled ? "bg-primary" : "bg-muted"} ${disabled ? "opacity-50" : ""}`}>
      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );

  const ScrollWrapper = ({ children, title, goBack }: { children: React.ReactNode; title: string; goBack: () => void }) => (
    <div className="flex flex-col h-full">
      <Header title={title} onBack={goBack} />
      <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
        {children}
      </div>
    </div>
  );

  // Profile section
  if (section === "profile") {
    const initials = (fullName || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <ScrollWrapper title="Редактировать профиль" goBack={() => setSection("main")}>
        <div className="px-5">
          <div className="flex justify-center mb-6">
            <div className="relative cursor-pointer" onClick={() => avatarRef.current?.click()}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center text-2xl font-bold text-primary-foreground">{initials}</div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-foreground flex items-center justify-center">
                {avatarUploading ? <Loader2 size={14} className="text-primary-foreground animate-spin" /> : <Camera size={14} className="text-primary-foreground" />}
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          <InputField label="Имя" value={fullName} onChange={setFullName} error={profileErrors.full_name} placeholder="Ваше имя" />
          <InputField label="Телефон" value={phone} onChange={setPhone} error={profileErrors.phone} placeholder="+7 (999) 123-45-67" type="tel" />

          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
            <div className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-muted-foreground">{user?.email || "—"}</div>
          </div>

          <button onClick={handleSaveProfile} disabled={saving} className="w-full py-3.5 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </ScrollWrapper>
    );
  }

  // Notifications section
  if (section === "notifications") {
    const handleEnablePush = async () => {
      setPushLoading(true);
      try {
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        if (permission === "granted") {
          // Progressier handles subscription automatically
          if (window.progressier && user?.email) {
            window.progressier.add({ email: user.email, id: user.id });
          }
          toast.success("Push-уведомления включены");
        } else if (permission === "denied") {
          toast.error("Уведомления заблокированы в настройках браузера");
        }
      } catch (err) {
        console.error("Push setup failed:", err);
        toast.error("Не удалось включить уведомления");
      } finally {
        setPushLoading(false);
      }
    };

    const handleDisablePush = async () => {
      setPushLoading(true);
      try {
        if (window.progressier) {
          await window.progressier.unsubscribe();
        }
        toast.success("Push-уведомления отключены");
        setPushPermission("default");
      } catch (err) {
        console.error("Unsubscribe failed:", err);
      } finally {
        setPushLoading(false);
      }
    };

    const currentPermission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";

    return (
      <ScrollWrapper title="Уведомления" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Push-уведомления</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {currentPermission === "granted" ? "✅ Включены" : currentPermission === "denied" ? "❌ Заблокированы" : "Не включены"}
                </p>
              </div>
              {currentPermission === "default" && (
                <button onClick={handleEnablePush} disabled={pushLoading} className="px-4 py-2 rounded-xl bg-foreground text-primary-foreground text-xs font-bold disabled:opacity-50">
                  {pushLoading ? <Loader2 size={14} className="animate-spin" /> : "Включить"}
                </button>
              )}
              {currentPermission === "granted" && (
                <button onClick={handleDisablePush} disabled={pushLoading} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold disabled:opacity-50">
                  {pushLoading ? <Loader2 size={14} className="animate-spin" /> : "Отключить"}
                </button>
              )}
            </div>
          </div>

          {currentPermission === "denied" && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Push-уведомления заблокированы в настройках браузера. Разрешите их в настройках сайта.</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">В приложении</p>
            {([
              { key: "sound" as const, label: "Звук", desc: "Звуковой сигнал", icon: Volume2 },
              { key: "vibration" as const, label: "Вибрация", desc: "Вибрация при уведомлениях", icon: Vibrate },
              { key: "overlay" as const, label: "Оверлей заказов", desc: "Полноэкранное уведомление", icon: Layers },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <item.icon size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Toggle enabled={notifSettings[item.key]} onToggle={() => updateNotif(item.key, !notifSettings[item.key])} />
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Категории push</p>
            {([
              { key: "pushJobs" as const, label: "Новые заказы", desc: "Уведомления о новых заявках" },
              { key: "pushMessages" as const, label: "Сообщения", desc: "Уведомления о новых сообщениях" },
              { key: "pushResponses" as const, label: "Отклики", desc: "Когда кто-то откликнулся" },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Toggle enabled={notifSettings[item.key]} onToggle={() => updateNotif(item.key, !notifSettings[item.key])} />
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📧 Email-уведомления</p>
            <div className="mb-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">Почта для уведомлений</label>
              <input type="email" value={notifSettings.notificationEmail} onChange={(e) => updateNotif("notificationEmail", e.target.value)} placeholder={user?.email || "email@example.com"} className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <p className="text-[10px] text-muted-foreground mt-1">{notifSettings.notificationEmail ? `Уведомления на ${notifSettings.notificationEmail}` : `По умолчанию: ${user?.email || "ваш email"}`}</p>
            </div>
            {([
              { key: "emailJobs" as const, label: "Новые заказы", desc: "Email при новом заказе" },
              { key: "emailMessages" as const, label: "Сообщения", desc: "Email при новых сообщениях" },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Toggle enabled={notifSettings[item.key]} onToggle={() => updateNotif(item.key, !notifSettings[item.key])} />
              </div>
            ))}
          </div>

          <TelegramLinkCard />
        </div>
      </ScrollWrapper>
    );
  }

  // Security section
  if (section === "security") {
    return (
      <ScrollWrapper title="Безопасность" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Изменить пароль</h3>
            <InputField label="Новый пароль" value={password} onChange={setPassword} error={passwordErrors.password} placeholder="Минимум 6 символов" type="password" />
            <InputField label="Повторите пароль" value={confirmPassword} onChange={setConfirmPassword} error={passwordErrors.confirmPassword} placeholder="Ещё раз" type="password" />
            <button onClick={handleChangePassword} disabled={changingPassword || !password} className="w-full py-3 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale disabled:opacity-50 flex items-center justify-center gap-2">
              {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {changingPassword ? "Сохранение..." : "Изменить пароль"}
            </button>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-2">Сессия</h3>
            <p className="text-xs text-muted-foreground mb-3">Email: {user?.email}<br />Последний вход: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("ru-RU") : "—"}</p>
            <button onClick={signOut} className="w-full py-3 rounded-2xl border border-destructive/30 text-destructive text-sm font-bold tap-scale">Выйти из аккаунта</button>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-destructive mb-2">Опасная зона</h3>
            <p className="text-xs text-muted-foreground mb-3">Удаление аккаунта необратимо.</p>
            <button onClick={handleDeleteAccount} className="w-full py-3 rounded-2xl bg-destructive/10 text-destructive text-sm font-bold tap-scale">Удалить аккаунт</button>
          </div>
        </div>
      </ScrollWrapper>
    );
  }

  // Appearance section
  if (section === "appearance") {
    const themes = [
      { id: "dark", label: "Тёмная", colors: ["#121212", "#1a1a1a", "#ffffff"] },
      { id: "light", label: "Светлая", colors: ["#f7f7f7", "#ffffff", "#171717"] },
      { id: "theme-midnight", label: "Midnight", colors: ["#0d1526", "#1a2744", "#3b82f6"] },
      { id: "theme-emerald", label: "Emerald", colors: ["#0a1a14", "#112e22", "#0d9668"] },
      { id: "theme-crimson", label: "Crimson", colors: ["#1a0f0f", "#2a1717", "#d6336c"] },
      { id: "theme-amber", label: "Amber", colors: ["#171008", "#241a0e", "#f59e0b"] },
    ];

    return (
      <ScrollWrapper title="Оформление" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Тема</p>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  className={`relative rounded-2xl overflow-hidden transition-all ${
                    theme === t.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  {/* Mini preview */}
                  <div className="aspect-[3/4] flex flex-col" style={{ background: t.colors[0] }}>
                    {/* Fake top bar */}
                    <div className="h-3 mx-2 mt-2 rounded-full" style={{ background: t.colors[1] }} />
                    {/* Fake cards */}
                    <div className="flex-1 px-2 py-1.5 space-y-1.5">
                      <div className="h-5 rounded-lg" style={{ background: t.colors[1] }} />
                      <div className="h-5 rounded-lg" style={{ background: t.colors[1] }} />
                      <div className="h-3 w-2/3 rounded-md" style={{ background: t.colors[2], opacity: 0.3 }} />
                    </div>
                    {/* Fake accent dot */}
                    <div className="flex justify-center pb-2">
                      <div className="w-4 h-1.5 rounded-full" style={{ background: t.colors[2] }} />
                    </div>
                  </div>
                  {/* Label */}
                  <div className="py-2 text-center" style={{ background: t.colors[0] }}>
                    <span className="text-[11px] font-semibold" style={{ color: t.colors[2] }}>{t.label}</span>
                  </div>
                  {/* Check */}
                  {theme === t.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollWrapper>
    );
  }

  // Language section
  if (section === "language") {
    return (
      <ScrollWrapper title="Язык" goBack={() => setSection("main")}>
        <div className="px-5 space-y-3">
          {[{ id: "ru", label: "Русский", emoji: "🇷🇺" }, { id: "en", label: "English", emoji: "🇬🇧" }].map((lang) => (
            <button key={lang.id} onClick={() => changeLanguage(lang.id)} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${language === lang.id ? "bg-card border border-border border border-primary/30" : "bg-card"}`}>
              <span className="text-2xl">{lang.emoji}</span>
              <span className={`text-sm font-semibold flex-1 text-left ${language === lang.id ? "text-primary" : "text-foreground"}`}>{lang.label}</span>
              {language === lang.id && <Check size={18} className="text-primary" />}
            </button>
          ))}
          <p className="text-[11px] text-muted-foreground text-center mt-4">Полная локализация скоро будет доступна</p>
        </div>
      </ScrollWrapper>
    );
  }

  // Blocked users section
  if (section === "blocked") {
    if (blockedUsers.length === 0 && !loadingBlocked) fetchBlockedUsers();
    return (
      <ScrollWrapper title="Заблокированные" goBack={() => setSection("main")}>
        <div className="px-5">
          {loadingBlocked ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : blockedUsers.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Ban size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Список пуст</p>
              <p className="text-xs text-muted-foreground">Вы никого не заблокировали</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((bu) => (
                <div key={bu.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {bu.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-foreground flex-1">{bu.full_name}</span>
                  <button onClick={() => unblockUser(bu.id)} className="px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-bold tap-scale">
                    Разблокировать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollWrapper>
    );
  }

  // Storage section (new feature)
  if (section === "storage") {
    const storageInfo = getStorageEstimate();
    return (
      <ScrollWrapper title="Данные и хранилище" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                <HardDrive size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{storageInfo.sizeKB} КБ</p>
                <p className="text-xs text-muted-foreground">Локальные данные ({storageInfo.items} записей)</p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(parseFloat(storageInfo.sizeKB) / 50 * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Лимит ~5 МБ (localStorage)</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Действия</p>
            <button onClick={clearCache} className="w-full flex items-center gap-3 p-3 rounded-xl active:bg-muted/50 transition-colors">
              <Trash2 size={16} className="text-destructive" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Очистить кеш</p>
                <p className="text-[11px] text-muted-foreground">Сбросить все локальные данные</p>
              </div>
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Что хранится</p>
            <div className="space-y-2">
              {[
                { label: "Настройки темы", desc: "Выбранная тема оформления" },
                { label: "Уведомления", desc: "Настройки push и email" },
                { label: "Язык", desc: "Язык интерфейса" },
                { label: "Кеш данных", desc: "Временные данные приложения" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollWrapper>
    );
  }

  // Verification section
  if (section === "verification") {

    const handleSendVerification = async () => {
      if (!vFullName.trim() || !vAge || !vPhone.trim()) {
        toast.error("Заполните все обязательные поля");
        return;
      }
      setVSending(true);

      const orgTypeLabels = { ip: "ИП", self: "Самозанятый", ooo: "ООО" };
      const message = `📋 Заявка на верификацию\n\n👤 ФИО: ${vFullName.trim()}\n🎂 Возраст: ${vAge}\n📱 Телефон: ${vPhone.trim()}\n🏢 Тип: ${orgTypeLabels[vOrgType]}${vOrgName.trim() ? `\n🏛 Организация: ${vOrgName.trim()}` : ""}\n\nID: ${profile?.display_id || user?.id?.slice(0, 8).toUpperCase()}\nРоль: ${role === "dispatcher" ? "Диспетчер" : "Грузчик"}`;

      // Find or create conversation with support
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);

      let conversationId: string | null = null;
      if (myConvs) {
        for (const mc of myConvs) {
          const { data: other } = await supabase
            .from("conversation_participants")
            .select("id")
            .eq("conversation_id", mc.conversation_id)
            .eq("user_id", supportUserId!)
            .single();
          if (other) { conversationId = mc.conversation_id; break; }
        }
      }

      if (!conversationId) {
        conversationId = crypto.randomUUID();
        await supabase.from("conversations").insert({ id: conversationId, title: "Gruzli Official" });
        await supabase.from("conversation_participants").insert([
          { conversation_id: conversationId, user_id: user!.id },
          { conversation_id: conversationId, user_id: supportUserId! },
        ]);
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        text: message,
      });

      toast.success("Заявка на верификацию отправлена!");
      setVSending(false);
      setSection("main");
    };

    return (
      <ScrollWrapper title="Верификация" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <BadgeCheck size={28} className="text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Пройти верификацию</h3>
            <p className="text-[11px] text-muted-foreground mt-1">Заполните анкету — она будет отправлена в тех. поддержку для проверки</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ФИО *</label>
              <input value={vFullName} onChange={(e) => setVFullName(e.target.value)} placeholder="Иванов Иван Иванович" className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Возраст *</label>
              <input type="number" value={vAge} onChange={(e) => setVAge(e.target.value)} placeholder="25" className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Номер телефона *</label>
              <input type="tel" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Тип деятельности *</label>
              <div className="grid grid-cols-3 gap-2">
                {([{ id: "ip" as const, label: "ИП" }, { id: "self" as const, label: "Самозанятый" }, { id: "ooo" as const, label: "ООО" }]).map((t) => (
                  <button key={t.id} type="button" onClick={() => setVOrgType(t.id)} className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${vOrgType === t.id ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {(vOrgType === "ip" || vOrgType === "ooo") && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Название организации</label>
                <input value={vOrgName} onChange={(e) => setVOrgName(e.target.value)} placeholder='ООО "Грузовик"' className="w-full bg-surface-1 border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              </div>
            )}
          </div>

          <button onClick={handleSendVerification} disabled={vSending} className="w-full py-3.5 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale disabled:opacity-50 flex items-center justify-center gap-2">
            {vSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {vSending ? "Отправка..." : "Отправить заявку"}
          </button>
        </div>
      </ScrollWrapper>
    );
  }

  // About section
  if (section === "about") {
    const openDoc = (doc: "privacy" | "terms" | "personal_data") => {
      setLegalDoc(doc);
      setLegalOpen(true);
    };

    return (
      <ScrollWrapper title="О приложении" goBack={() => setSection("main")}>
        <div className="px-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-extrabold text-primary-foreground">G</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">Gruzli</h2>
            <p className="text-xs text-muted-foreground mt-1">Версия 1.0.0 beta</p>
            <div className="mx-auto mt-2 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-[11px] text-yellow-500 font-semibold">⚠️ Бета-версия — возможны ошибки в работе</p>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Платформа для грузчиков и диспетчеров. Быстрый поиск работы и исполнителей.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ссылки</p>
            <a href="https://gruzli.lovable.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2">
              <Globe size={16} className="text-primary" />
              <span className="text-sm text-foreground">Веб-сайт</span>
            </a>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Юридические документы</p>
            <button onClick={() => openDoc("privacy")} className="flex items-center gap-3 py-2.5 w-full text-left">
              <Shield size={16} className="text-primary" />
              <span className="text-sm text-foreground">Политика конфиденциальности</span>
            </button>
            <div className="h-px bg-border" />
            <button onClick={() => openDoc("terms")} className="flex items-center gap-3 py-2.5 w-full text-left">
              <FileText size={16} className="text-primary" />
              <span className="text-sm text-foreground">Пользовательское соглашение</span>
            </button>
            <div className="h-px bg-border" />
            <button onClick={() => openDoc("personal_data")} className="flex items-center gap-3 py-2.5 w-full text-left">
              <Info size={16} className="text-primary" />
              <span className="text-sm text-foreground">Обработка персональных данных</span>
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">© 2025 Gruzli. Все права защищены.</p>
        </div>
        <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} initialDoc={legalDoc} />
      </ScrollWrapper>
    );
  }

  // Main settings menu
  return (
    <div className="flex flex-col h-full">
      <Header title="Настройки" onBack={onBack} />
      <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
        {/* Account section */}
        <div className="mx-5 bg-card border border-border rounded-2xl px-4 py-1 mb-3">
          <MenuItem icon={User} label="Профиль" desc="" onClick={() => setSection("profile")} />
          <div className="h-px bg-border ml-[52px]" />
          {role === "worker" && onOpenPremium && (
            <>
              <MenuItem icon={Crown} label="Premium" desc="" onClick={onOpenPremium} badge={profile?.is_premium ? "Активен" : ""} />
              <div className="h-px bg-border ml-[52px]" />
            </>
          )}
          <MenuItem icon={BadgeCheck} label="Верификация" desc="" onClick={() => setSection("verification")} badge={profile?.verified ? "✓" : ""} />
        </div>

        {/* General section */}
        <div className="mx-5 bg-card border border-border rounded-2xl px-4 py-1 mb-3">
          <MenuItem icon={Bell} label="Уведомления" desc="" onClick={() => setSection("notifications")} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Shield} label="Безопасность" desc="" onClick={() => setSection("security")} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Palette} label="Оформление" desc="" onClick={() => setSection("appearance")} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Globe} label="Язык" desc="" onClick={() => setSection("language")} badge={language === "ru" ? "RU" : "EN"} />
        </div>

        {/* Data section */}
        <div className="mx-5 bg-card border border-border rounded-2xl px-4 py-1 mb-3">
          <MenuItem icon={HardDrive} label="Данные и хранилище" desc="" onClick={() => setSection("storage")} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Ban} label="Заблокированные" desc="" onClick={() => setSection("blocked")} />
        </div>

        {/* About & share section */}
        <div className="mx-5 bg-card border border-border rounded-2xl px-4 py-1 mb-3">
          <MenuItem icon={Share2} label="Поделиться" desc="" onClick={handleShareApp} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Star} label="Оценить приложение" desc="" onClick={handleRateApp} />
          <div className="h-px bg-border ml-[52px]" />
          <MenuItem icon={Info} label="О приложении" desc="" onClick={() => setSection("about")} />
        </div>

        {/* Logout */}
        <div className="mx-5 bg-card border border-border rounded-2xl px-4 py-1 mb-3">
          <MenuItem icon={LogOut} label="Выйти" desc="" onClick={signOut} destructive />
        </div>

        <div className="text-center mt-4 mb-4 space-y-1">
          <p className="text-[11px] text-muted-foreground">Gruzli v1.0.0 beta</p>
          <p className="text-[10px] text-yellow-500/70">⚠️ Бета-версия — возможны ошибки</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
