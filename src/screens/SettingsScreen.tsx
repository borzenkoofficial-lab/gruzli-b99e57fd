import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Phone, Bell, Shield, Palette, LogOut, Camera, Check, Loader2, Volume2, Vibrate, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { toast } from "sonner";
import { z } from "zod";

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
}

type Section = "main" | "profile" | "notifications" | "security" | "appearance";

const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { user, profile, signOut } = useAuth();
  const { permissionState, isSubscribed, loading: pushLoading, requestPermission, unsubscribe } = usePushNotifications();
  const { settings: notifSettings, update: updateNotif } = useNotificationSettings();
  const [section, setSection] = useState<Section>("main");

  // Profile edit state
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return localStorage.getItem("theme") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

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
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: result.data.full_name, phone: result.data.phone || "" })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) {
      toast.error("Не удалось сохранить");
    } else {
      toast.success("Профиль обновлён");
    }
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
    if (error) {
      toast.error("Ошибка: " + error.message);
    } else {
      toast.success("Пароль изменён");
      setPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Вы уверены что хотите удалить аккаунт? Это действие необратимо.")) return;
    await signOut();
    toast.info("Обратитесь в поддержку для удаления аккаунта");
  };

  const toggleTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    if (newTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", newTheme);
  };

  const InputField = ({ label, value, onChange, error, placeholder, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string;
  }) => (
    <div className="mb-4">
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full neu-inset rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );

  const MenuItem = ({ icon: Icon, label, desc, onClick, destructive }: {
    icon: any; label: string; desc: string; onClick: () => void; destructive?: boolean;
  }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 rounded-2xl neu-flat active:neu-inset transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${destructive ? "bg-destructive/10" : "neu-raised"}`}>
        <Icon size={18} className={destructive ? "text-destructive" : "text-primary"} />
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-semibold ${destructive ? "text-destructive" : "text-foreground"}`}>{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  );

  const Header = ({ title, onBack: goBack }: { title: string; onBack: () => void }) => (
    <div className="flex items-center gap-3 px-5 pt-14 pb-5">
      <button onClick={goBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
        <ArrowLeft size={18} className="text-foreground" />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );

  // Profile section
  if (section === "profile") {
    return (
      <div className="min-h-screen bg-background pb-12">
        <Header title="Редактировать профиль" onBack={() => setSection("main")} />
        <div className="px-5">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {(fullName || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          <InputField label="Имя" value={fullName} onChange={setFullName} error={profileErrors.full_name} placeholder="Ваше имя" />
          <InputField label="Телефон" value={phone} onChange={setPhone} error={profileErrors.phone} placeholder="+7 (999) 123-45-67" type="tel" />

          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
            <div className="w-full neu-inset rounded-2xl py-3 px-4 text-sm text-muted-foreground">
              {user?.email || "—"}
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    );
  }

  // Notifications section
  if (section === "notifications") {
    const Toggle = ({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) => (
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${enabled ? "bg-primary" : "bg-muted"} ${disabled ? "opacity-50" : ""}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    );

    return (
      <div className="min-h-screen bg-background pb-12">
        <Header title="Уведомления" onBack={() => setSection("main")} />
        <div className="px-5 space-y-4">
          {/* Push notifications */}
          <div className="neu-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Push-уведомления</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {permissionState === "unsupported"
                    ? "❌ Не поддерживается браузером"
                    : permissionState === "granted"
                      ? isSubscribed ? "✅ Включены и активны" : "⏳ Подключение..."
                      : permissionState === "denied" ? "❌ Заблокированы в браузере" : "Не включены"}
                </p>
              </div>
              {permissionState === "default" && (
                <button onClick={requestPermission} disabled={pushLoading} className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                  {pushLoading ? <Loader2 size={14} className="animate-spin" /> : "Включить"}
                </button>
              )}
              {permissionState === "granted" && isSubscribed && (
                <button onClick={unsubscribe} disabled={pushLoading} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold disabled:opacity-50">
                  {pushLoading ? <Loader2 size={14} className="animate-spin" /> : "Отключить"}
                </button>
              )}
            </div>
          </div>

          {permissionState === "denied" && (
            <div className="neu-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">
                Push-уведомления заблокированы в настройках браузера. Откройте настройки сайта и разрешите уведомления.
              </p>
            </div>
          )}

          {/* In-app notification settings */}
          <div className="neu-card rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">В приложении</p>
            {([
              { key: "sound" as const, label: "Звук", desc: "Звуковой сигнал при новых событиях", icon: Volume2 },
              { key: "vibration" as const, label: "Вибрация", desc: "Вибрация при уведомлениях", icon: Vibrate },
              { key: "overlay" as const, label: "Оверлей заказов", desc: "Полноэкранное уведомление о новом заказе", icon: Layers },
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

          {/* Push categories */}
          <div className="neu-card rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Категории push</p>
            {([
              { key: "pushJobs" as const, label: "Новые заказы", desc: "Уведомления о новых заявках" },
              { key: "pushMessages" as const, label: "Сообщения", desc: "Уведомления о новых сообщениях" },
              { key: "pushResponses" as const, label: "Отклики", desc: "Когда кто-то откликнулся на заявку" },
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
        </div>
      </div>
    );
  }

  // Security section
  if (section === "security") {
    return (
      <div className="min-h-screen bg-background pb-12">
        <Header title="Безопасность" onBack={() => setSection("main")} />
        <div className="px-5 space-y-4">
          <div className="neu-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Изменить пароль</h3>
            <InputField label="Новый пароль" value={password} onChange={setPassword} error={passwordErrors.password} placeholder="Минимум 6 символов" type="password" />
            <InputField label="Повторите пароль" value={confirmPassword} onChange={setConfirmPassword} error={passwordErrors.confirmPassword} placeholder="Ещё раз" type="password" />
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !password}
              className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {changingPassword ? "Сохранение..." : "Изменить пароль"}
            </button>
          </div>

          <div className="neu-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-2">Сессия</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Email: {user?.email}<br />
              Последний вход: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("ru-RU") : "—"}
            </p>
            <button
              onClick={signOut}
              className="w-full py-3 rounded-2xl border border-destructive/30 text-destructive text-sm font-bold active:scale-95 transition-transform"
            >
              Выйти из аккаунта
            </button>
          </div>

          <div className="neu-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-destructive mb-2">Опасная зона</h3>
            <p className="text-xs text-muted-foreground mb-3">Удаление аккаунта необратимо. Все данные будут потеряны.</p>
            <button
              onClick={handleDeleteAccount}
              className="w-full py-3 rounded-2xl bg-destructive/10 text-destructive text-sm font-bold active:scale-95 transition-transform"
            >
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Appearance section
  if (section === "appearance") {
    return (
      <div className="min-h-screen bg-background pb-12">
        <Header title="Оформление" onBack={() => setSection("main")} />
        <div className="px-5 space-y-4">
          <div className="neu-card rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Тема</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "dark" as const, label: "Тёмная", emoji: "🌙" },
                { id: "light" as const, label: "Светлая", emoji: "☀️" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  className={`py-4 rounded-2xl text-center transition-all ${
                    theme === t.id ? "gradient-primary text-primary-foreground" : "neu-flat text-muted-foreground"
                  }`}
                >
                  <span className="text-2xl block mb-1">{t.emoji}</span>
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main settings menu
  return (
    <div className="min-h-screen bg-background pb-12">
      <Header title="Настройки" onBack={onBack} />
      <div className="px-5 space-y-2">
        <MenuItem icon={User} label="Профиль" desc="Имя, телефон, фото" onClick={() => setSection("profile")} />
        <MenuItem icon={Bell} label="Уведомления" desc="Push, звуки, типы уведомлений" onClick={() => setSection("notifications")} />
        <MenuItem icon={Shield} label="Безопасность" desc="Пароль, сессия, удаление" onClick={() => setSection("security")} />
        <MenuItem icon={Palette} label="Оформление" desc="Тема приложения" onClick={() => setSection("appearance")} />
        <div className="pt-4">
          <MenuItem icon={LogOut} label="Выйти" desc="Выход из аккаунта" onClick={signOut} destructive />
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-[11px] text-muted-foreground">Gruzli v1.0.0</p>
      </div>
    </div>
  );
};

export default SettingsScreen;
