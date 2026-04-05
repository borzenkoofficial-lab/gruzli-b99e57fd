import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";

type Mode = "login" | "register";
type Role = "worker" | "dispatcher";

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("worker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <img src={gruzliLogo} alt="Gruzli" className="h-20 mx-auto mb-4 rounded-2xl" width={200} height={80} />
        <p className="text-sm text-muted-foreground mt-1">Платформа для грузчиков и диспетчеров</p>
      </motion.div>

      {/* Mode toggle */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex gap-1.5 neu-inset rounded-2xl p-1.5">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === m ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>
      </div>

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
                    <p className={`text-[11px] mt-0.5 ${role === r.id ? "text-white/70" : "text-muted-foreground"}`}>{r.desc}</p>
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
