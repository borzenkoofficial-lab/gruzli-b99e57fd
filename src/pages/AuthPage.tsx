import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Eye, EyeOff, ArrowRight, Loader2, Briefcase, Shield, Zap, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";

type Mode = "welcome" | "login" | "register";
type Role = "worker" | "dispatcher";

const features = [
  { icon: Briefcase, title: "Заказы", desc: "Находите работу мгновенно" },
  { icon: Shield, title: "Безопасно", desc: "Проверенные диспетчеры" },
  { icon: Zap, title: "Быстро", desc: "Отклик в одно нажатие" },
  { icon: MessageSquare, title: "Чат", desc: "Общайтесь напрямую" },
];

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("welcome");
  const [role, setRole] = useState<Role>("worker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        if (!fullName.trim()) {
          toast.error("Укажите имя");
          setLoading(false);
          return;
        }
        if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
          toast.error("Укажите корректный номер телефона");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role, phone: phone.trim() },
          },
        });
        if (error) throw error;

        // Update phone in profile after signup
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ phone: phone.trim() })
            .eq("user_id", data.user.id);
        }

        toast.success("Регистрация успешна!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Добро пожаловать!");
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  // ─── WELCOME / ONBOARDING ───
  if (mode === "welcome") {
    return (
      <div className="h-full bg-background flex flex-col overflow-y-auto">
        {/* Hero section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg mx-auto">
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
            className="text-center mb-10"
          >
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              Gruzli<span className="text-primary">.</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Платформа, которая соединяет грузчиков и диспетчеров. Быстро, удобно, надёжно.
            </p>
          </motion.div>

          {/* Feature grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="neu-card rounded-2xl p-4 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <f.icon size={20} className="text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">{f.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="px-6 pb-10 space-y-3 max-w-sm mx-auto w-full"
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
        </motion.div>
      </div>
    );
  }

  // ─── AUTH FORM ───
  return (
    <div className="h-full bg-background flex flex-col items-center px-6 pt-14 pb-8 overflow-y-auto">
      {/* Back + Logo */}
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
        {/* Role selection (register only) */}
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
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Имя и фамилия</label>
                <div className="neu-inset rounded-xl px-4 py-3">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Смирнов"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              {/* Phone number */}
              <div className="mt-3">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Номер телефона</label>
                <div className="neu-inset rounded-xl px-4 py-3 flex items-center gap-2">
                  <Phone size={16} className="text-muted-foreground shrink-0" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
          <div className="neu-inset rounded-xl px-4 py-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
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
      </motion.form>
    </div>
  );
};

export default AuthPage;
