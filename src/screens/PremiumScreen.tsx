import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Zap, Shield, Star, Infinity, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PremiumScreenProps {
  onBack: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
}

const benefits = [
  { icon: Infinity, title: "Безлимитные заказы", desc: "Нет ограничения в 3 заказа в неделю" },
  { icon: Crown, title: "Значок Premium", desc: "Золотой значок в профиле и чатах" },
  { icon: Zap, title: "Приоритет для диспетчеров", desc: "Ваш отклик выделяется среди других" },
  { icon: Sparkles, title: "Золотой аккаунт", desc: "Аватар светится золотым цветом" },
  { icon: Shield, title: "Повышенное доверие", desc: "Диспетчеры видят ваш Premium статус" },
  { icon: Star, title: "Эксклюзивные заказы", desc: "Доступ к заказам только для Premium" },
];

const plans = [
  { id: "month", label: "1 месяц", price: 299, per: "мес", popular: false },
  { id: "quarter", label: "3 месяца", price: 699, per: "3 мес", popular: true, save: "22%" },
  { id: "year", label: "12 месяцев", price: 1990, per: "год", popular: false, save: "45%" },
];

const PremiumScreen = ({ onBack, onOpenSupport }: PremiumScreenProps) => {
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("quarter");
  const [purchasing, setPurchasing] = useState(false);
  const isPremium = profile?.is_premium;

  const handlePurchase = async () => {
    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan || !user || !profile) return;

    const balance = profile.balance || 0;
    if (balance < plan.price) {
      toast.error(`Недостаточно средств. Нужно ${plan.price} ₽, на балансе ${balance} ₽`);
      return;
    }

    setPurchasing(true);
    // Deduct from wallet
    const { error: balanceError } = await supabase
      .from("profiles")
      .update({ balance: balance - plan.price })
      .eq("user_id", user.id);

    if (balanceError) {
      toast.error("Ошибка списания");
      setPurchasing(false);
      return;
    }

    // Calculate premium_until
    const now = new Date();
    const daysMap: Record<string, number> = { month: 30, quarter: 90, year: 365 };
    const premiumUntil = new Date(now.getTime() + (daysMap[plan.id] || 30) * 86400000).toISOString();

    const { error: premiumError } = await supabase
      .from("profiles")
      .update({ is_premium: true, premium_until: premiumUntil })
      .eq("user_id", user.id);

    if (premiumError) {
      toast.error("Ошибка активации Premium");
      setPurchasing(false);
      return;
    }

    toast.success(`Premium активирован на ${plan.label}! 🎉`);
    setPurchasing(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Gruzli Premium</h1>
      </div>

      {/* Hero */}
      <div className="mx-5 mb-6 rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, hsl(43 96% 56%), hsl(38 92% 50%), hsl(25 95% 53%))",
        boxShadow: "0 8px 32px hsl(38 92% 50% / 0.4)",
      }}>
        <div className="px-6 py-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4"
          >
            <Crown size={40} className="text-white" />
          </motion.div>
          <h2 className="text-white text-2xl font-extrabold mb-1">Gruzli Premium</h2>
          <p className="text-white/80 text-sm">Безлимитные возможности для лучших исполнителей</p>
        </div>
      </div>

      {isPremium && (
        <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-yellow-500" />
            <div>
              <p className="text-sm font-bold text-foreground">У вас активен Premium!</p>
              <p className="text-xs text-muted-foreground">
                Действует до {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString("ru-RU") : "∞"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="px-5 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-3">Преимущества Premium</h3>
        <div className="space-y-2.5">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <b.icon size={18} className="text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{b.title}</p>
                <p className="text-[11px] text-muted-foreground">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Free vs Premium comparison */}
      <div className="mx-5 mb-6 bg-card border border-border rounded-2xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Сравнение</h3>
        <div className="space-y-2">
          {[
            { feature: "Заказов в неделю", free: "3", premium: "∞" },
            { feature: "Значок Premium", free: "—", premium: "✓" },
            { feature: "Приоритет в откликах", free: "—", premium: "✓" },
            { feature: "Золотой аккаунт", free: "—", premium: "✓" },
          ].map((row) => (
            <div key={row.feature} className="flex items-center text-xs">
              <span className="flex-1 text-muted-foreground">{row.feature}</span>
              <span className="w-16 text-center text-muted-foreground">{row.free}</span>
              <span className="w-16 text-center font-bold text-yellow-500">{row.premium}</span>
            </div>
          ))}
          <div className="flex items-center text-[10px] text-muted-foreground pt-1 border-t border-border">
            <span className="flex-1" />
            <span className="w-16 text-center">Бесплатно</span>
            <span className="w-16 text-center text-yellow-500 font-bold">Premium</span>
          </div>
        </div>
      </div>

      {/* Plans */}
      {!isPremium && (
        <div className="px-5 mb-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Выберите план</h3>
          <div className="space-y-2.5">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 transition-all ${
                  selectedPlan === plan.id ? "border-2 border-yellow-500" : "border-2 border-transparent"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === plan.id ? "border-yellow-500 bg-yellow-500" : "border-muted-foreground"
                }`}>
                  {selectedPlan === plan.id && <Check size={12} className="text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{plan.label}</span>
                    {plan.popular && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-[10px] font-bold text-yellow-500">Популярный</span>
                    )}
                    {plan.save && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-[10px] font-bold text-green-600">-{plan.save}</span>
                    )}
                  </div>
                </div>
                <span className="text-lg font-extrabold text-foreground">{plan.price} ₽</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Balance info */}
      {!isPremium && (
        <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Баланс кошелька</span>
            <span className="text-lg font-extrabold text-foreground">{profile?.balance || 0} ₽</span>
          </div>
        </div>
      )}

      {/* Purchase button */}
      {!isPremium && (
        <div className="px-5">
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className="w-full py-4 rounded-2xl text-white font-bold text-base tap-scale disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(43 96% 56%), hsl(25 95% 53%))",
              boxShadow: "0 8px 24px hsl(38 92% 50% / 0.4)",
            }}
          >
            <Crown size={16} className="inline mr-2" />
            {purchasing ? "Оформление..." : `Купить за ${plans.find(p => p.id === selectedPlan)?.price || 0} ₽`}
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Средства спишутся с баланса кошелька
          </p>
        </div>
      )}
    </div>
  );
};

export default PremiumScreen;
