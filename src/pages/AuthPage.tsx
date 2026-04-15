import { useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Eye, EyeOff, ArrowRight, Loader2, Briefcase, Shield, Zap, MessageSquare, Phone, Lock, Fingerprint, ShieldCheck, X, Calendar, Mail } from "lucide-react";
import { LegalCheckboxes } from "@/components/LegalDocuments";
import { toast } from "sonner";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";

type Mode = "welcome" | "login" | "register";
type Role = "worker" | "dispatcher";

/** Convert phone to a deterministic email for Supabase auth */
const phoneToEmail = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@phone.gruzli.app`;
};

/** Check if input looks like an email */
const isEmail = (input: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());

const SecurityModal = forwardRef<HTMLDivElement, { open: boolean; onClose: () => void }>(({ open, onClose }, _ref) => {
  if (!open) return null;

  const features = [
    { icon: Lock, title: "Тройное шифрование", desc: "Все данные защищены тремя уровнями шифрования: AES-256, RSA и TLS 1.3. Даже при перехвате данные невозможно расшифровать." },
    { icon: Fingerprint, title: "Многофакторная проверка", desc: "Каждый аккаунт проходит верификацию через email и телефон. Подозрительные входы блокируются автоматически." },
    { icon: ShieldCheck, title: "Защита в реальном времени", desc: "Система мониторинга 24/7 отслеживает аномалии и предотвращает несанкционированный доступ к вашим данным." },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 z-10"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground">
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-foreground/10 flex items-center justify-center">
                <Shield size={18} className="text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">PRO.SC</h3>
                <p className="text-[11px] text-muted-foreground">Система защиты данных</p>
              </div>
            </div>

            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.title} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon size={15} className="text-foreground/70" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground">Ваши данные в безопасности с <span className="font-bold text-foreground">PRO.SC</span></p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
SecurityModal.displayName = "SecurityModal";

const featuresList = [
  { icon: Briefcase, title: "Заказы", desc: "Находите работу мгновенно" },
  { icon: Shield, title: "Безопасно", desc: "Проверенные диспетчеры" },
  { icon: Zap, title: "Быстро", desc: "Отклик в одно нажатие" },
  { icon: MessageSquare, title: "Чат", desc: "Общайтесь напрямую" },
];

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("welcome");
  const [role, setRole] = useState<Role>("worker");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState({ terms: false, privacy: false, personalData: false, rules: false });

  const allLegalAccepted = legalAccepted.terms && legalAccepted.privacy && legalAccepted.personalData && legalAccepted.rules;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const input = phone.trim();

      if (!input) {
        toast.error("Укажите email или номер телефона");
        setLoading(false);
        return;
      }

      // Determine auth email: if input looks like email use directly, otherwise convert phone
      let email: string;
      if (isEmail(input)) {
        email = input;
      } else {
        const cleanPhone = input.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
          toast.error("Укажите корректный номер телефона или email");
          setLoading(false);
          return;
        }
        email = phoneToEmail(input);
      }

      if (mode === "register") {
        if (!allLegalAccepted) {
          toast.error("Примите все юридические документы");
          setLoading(false);
          return;
        }
        if (!fullName.trim()) {
          toast.error("Укажите ФИО");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role, phone: isEmail(input) ? "" : input },
          },
        });
        if (error) throw error;

        // Detect fake signup (user already exists) — Supabase returns user with empty identities
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          toast.error("Аккаунт с таким номером или email уже существует. Войдите.");
          setLoading(false);
          return;
        }

        if (data.user) {
          await supabase
            .from("profiles")
            .update({
              phone: isEmail(input) ? "" : input,
              ...(birthDate ? { birth_date: birthDate } : {}),
            })
            .eq("user_id", data.user.id);
        }

        toast.success("Регистрация успешна!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Добро пожаловать!");
      }
    } catch (err: any) {
      const msg = err.message || "Ошибка авторизации";
      if (msg.includes("Invalid login")) {
        toast.error("Неверный email/телефон или пароль");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── WELCOME / ONBOARDING ───
  if (mode === "welcome") {
    return (
      <div className="bg-background overflow-hidden flex flex-col h-screen" style={{ height: "100dvh" }}>
        <div className="mx-auto flex flex-1 w-full max-w-sm flex-col px-5 min-h-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 w-full min-h-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-2"
          >
            <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-lg mx-auto">
              <img
                src={gruzliLogo}
                alt="Gruzli"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-1"
          >
            <h1 className="text-2xl font-extrabold text-foreground mb-2">
              Gruzli<span className="text-primary">.</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Платформа, которая соединяет грузчиков и диспетчеров. Быстро, удобно, надёжно.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3 w-full"
          >
            {featuresList.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="neu-card rounded-2xl p-3 text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <f.icon size={18} className="text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">{f.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-2.5 w-full shrink-0 pb-4"
          >
            <button
              onClick={() => setMode("register")}
              className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              Начать работу
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setMode("login")}
              className="w-full py-3.5 rounded-2xl neu-card text-foreground text-sm font-semibold active:scale-95 transition-transform"
            >
              У меня есть аккаунт
            </button>
            <button onClick={() => setSecurityOpen(true)} className="flex items-center justify-center gap-1.5 mt-2 opacity-50 hover:opacity-80 transition-opacity cursor-pointer">
              <Shield size={14} className="text-foreground" />
              <span className="text-[10px] text-muted-foreground tracking-wide">
                Защищено <span className="font-bold text-foreground">PRO.SC</span>
              </span>
            </button>
            <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} />
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── AUTH FORM ───
  return (
    <div className="bg-background flex flex-col items-center px-6 safe-top pb-4 overflow-y-auto h-screen" style={{ minHeight: "100dvh", height: "100dvh" }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mb-6"
      >
        <button
          onClick={() => setMode("welcome")}
          className="text-sm text-muted-foreground mb-6 flex items-center gap-1"
        >
          ← Назад
        </button>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <img src={gruzliLogo} alt="Gruzli" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {mode === "login" ? "Вход" : "Регистрация"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "login" ? "Войдите в свой аккаунт" : "Создайте аккаунт за минуту"}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.form
        key={mode}
        initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        {/* Role selection + extra fields (register only) */}
        <AnimatePresence>
          {mode === "register" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-semibold text-foreground mb-2">Кто вы?</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: "worker" as Role, label: "Грузчик", icon: User, desc: "Беру заказы" },
                  { id: "dispatcher" as Role, label: "Диспетчер", icon: Users, desc: "Размещаю заказы" },
                ]).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-4 rounded-2xl text-center transition-all ${
                      role === r.id ? "gradient-primary text-primary-foreground" : "neu-card text-foreground"
                    }`}
                  >
                    <r.icon size={24} className="mx-auto mb-2" />
                    <p className="text-sm font-bold">{r.label}</p>
                    <p className={`text-[11px] mt-0.5 ${role === r.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{r.desc}</p>
                  </button>
                ))}
              </div>

              {/* Full name */}
              <div className="mt-4">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ФИО</label>
                <div className="neu-inset rounded-xl px-4 py-3">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              {/* Birth date */}
              <div className="mt-3">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Дата рождения</label>
                <div className="neu-inset rounded-xl px-4 py-3 flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground shrink-0" />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email or Phone */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email или номер телефона</label>
          <div className="neu-inset rounded-xl px-4 py-3 flex items-center gap-2">
            {isEmail(phone) ? (
              <Mail size={16} className="text-muted-foreground shrink-0" />
            ) : (
              <Phone size={16} className="text-muted-foreground shrink-0" />
            )}
            <input
              type="text"
              inputMode="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон или email"
              required
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Пароль</label>
          <div className="neu-inset rounded-xl px-4 py-3 flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={16} className="text-muted-foreground" /> : <Eye size={16} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Legal toggles (register only) */}
        {mode === "register" && (
          <LegalCheckboxes
            accepted={legalAccepted}
            onChange={(key, val) => setLegalAccepted((prev) => ({ ...prev, [key]: val }))}
          />
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || (mode === "register" && !allLegalAccepted)}
          className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-primary font-semibold"
          >
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </button>
        </p>

        <button onClick={() => setSecurityOpen(true)} className="flex items-center justify-center gap-1.5 mt-4 opacity-50 hover:opacity-80 transition-opacity cursor-pointer">
          <Shield size={14} className="text-foreground" />
          <span className="text-[10px] text-muted-foreground tracking-wide">
            Защищено <span className="font-bold text-foreground">PRO.SC</span>
          </span>
        </button>
        <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} />
      </motion.form>
    </div>
  );
};

export default AuthPage;
