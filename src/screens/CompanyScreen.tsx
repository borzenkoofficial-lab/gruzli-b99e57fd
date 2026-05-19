import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Check,
  Receipt,
  Wallet,
  Megaphone,
  Users,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  Headphones,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompanyScreenProps {
  onBack: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
}

const benefits = [
  { icon: Receipt, title: "Налоговые функции", desc: "Автосчета, акты, НДС-отчётность, выгрузка в 1С" },
  { icon: Wallet, title: "Оплата самозанятым", desc: "Массовые выплаты с автоматическими чеками ФНС" },
  { icon: Megaphone, title: "Дешевле объявления", desc: "Скидка до 50% на размещение заявок и буст" },
  { icon: Users, title: "Команда диспетчеров", desc: "До 20 сотрудников в одном корпоративном кабинете" },
  { icon: FileSpreadsheet, title: "Договоры и документы", desc: "Шаблоны договоров ГПХ, ЭДО, хранение бумаг" },
  { icon: BarChart3, title: "Расширенная аналитика", desc: "Отчёты по объектам, бригадам, маржинальности" },
  { icon: ShieldCheck, title: "Верифицированный бейдж", desc: "Метка «Компания» для повышения доверия" },
  { icon: Headphones, title: "Персональный менеджер", desc: "Поддержка 24/7 и приоритетная линия" },
];

const plans = [
  { id: "starter", label: "Старт", price: 1990, per: "мес", popular: false, hint: "До 3 сотрудников" },
  { id: "business", label: "Бизнес", price: 4990, per: "мес", popular: true, save: "Хит", hint: "До 10 сотрудников + ЭДО" },
  { id: "enterprise", label: "Корпорация", price: 12990, per: "мес", popular: false, hint: "Безлимит + интеграции" },
];

const CompanyScreen = ({ onBack, onOpenSupport }: CompanyScreenProps) => {
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("business");
  const [companyName, setCompanyName] = useState((profile as any)?.company_name || "");
  const [purchasing, setPurchasing] = useState(false);
  const isCompany = (profile as any)?.is_company;
  const companyUntil = (profile as any)?.company_until;

  const handlePurchase = async () => {
    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan || !user || !profile) return;
    if (!companyName.trim()) {
      toast.error("Введите название компании");
      return;
    }

    const balance = profile.balance || 0;
    if (balance < plan.price) {
      toast.error(`Недостаточно средств. Нужно ${plan.price} ₽, на балансе ${balance} ₽`);
      return;
    }

    setPurchasing(true);
    const { error: balanceError } = await supabase
      .from("profiles")
      .update({ balance: balance - plan.price })
      .eq("user_id", user.id);

    if (balanceError) {
      toast.error("Ошибка списания");
      setPurchasing(false);
      return;
    }

    const until = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_company: true,
        company_until: until,
        company_name: companyName.trim(),
        company_plan: plan.id,
      } as any)
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Ошибка активации");
      setPurchasing(false);
      return;
    }

    toast.success(`Тариф «${plan.label}» активирован на 30 дней 🎉`);
    setPurchasing(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Gruzli для компаний</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
        {/* Hero */}
        <div
          className="mx-5 mb-6 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(220 70% 50%), hsl(230 60% 45%), hsl(260 55% 40%))",
            boxShadow: "0 8px 32px hsl(230 60% 45% / 0.4)",
          }}
        >
          <div className="px-6 py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4"
            >
              <Building2 size={40} className="text-white" />
            </motion.div>
            <h2 className="text-white text-2xl font-extrabold mb-1">Мы — компания</h2>
            <p className="text-white/80 text-sm">Профессиональный кабинет с налогами, выплатами и аналитикой</p>
          </div>
        </div>

        {isCompany && (
          <div className="mx-5 mb-4 bg-card rounded-2xl p-4 border border-primary/30">
            <div className="flex items-center gap-3">
              <Building2 size={20} className="text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">Тариф «Компания» активен</p>
                <p className="text-xs text-muted-foreground">
                  Действует до {companyUntil ? new Date(companyUntil).toLocaleDateString("ru-RU") : "∞"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="px-5 mb-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Что входит</h3>
          <div className="space-y-2.5">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <b.icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="mx-5 mb-6 bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Сравнение</h3>
          <div className="space-y-2">
            {[
              { feature: "Размещение заявок", free: "Полная цена", pro: "−50%" },
              { feature: "Налоговые чеки ФНС", free: "—", pro: "✓" },
              { feature: "Массовые выплаты", free: "—", pro: "✓" },
              { feature: "Сотрудников в кабинете", free: "1", pro: "до 20" },
              { feature: "ЭДО и договоры", free: "—", pro: "✓" },
              { feature: "Бейдж «Компания»", free: "—", pro: "✓" },
            ].map((row) => (
              <div key={row.feature} className="flex items-center text-xs">
                <span className="flex-1 text-muted-foreground">{row.feature}</span>
                <span className="w-20 text-center text-muted-foreground">{row.free}</span>
                <span className="w-20 text-center font-bold text-primary">{row.pro}</span>
              </div>
            ))}
            <div className="flex items-center text-[10px] text-muted-foreground pt-1 border-t border-border">
              <span className="flex-1" />
              <span className="w-20 text-center">Обычный</span>
              <span className="w-20 text-center text-primary font-bold">Компания</span>
            </div>
          </div>
        </div>

        {/* Plans */}
        {!isCompany && (
          <>
            <div className="px-5 mb-4">
              <label className="block text-sm font-bold text-foreground mb-2">Название компании</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ООО «Грузли Сервис»"
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="px-5 mb-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Выберите тариф</h3>
              <div className="space-y-2.5">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full bg-card rounded-2xl p-4 flex items-center gap-3 transition-all border-2 ${
                      selectedPlan === plan.id ? "border-primary" : "border-border"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedPlan === plan.id ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}
                    >
                      {selectedPlan === plan.id && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{plan.label}</span>
                        {plan.popular && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                            {plan.save || "Популярный"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{plan.hint}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-base font-extrabold text-foreground">{plan.price.toLocaleString("ru-RU")} ₽</span>
                      <p className="text-[10px] text-muted-foreground">/{plan.per}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Баланс кошелька</span>
                <span className="text-lg font-extrabold text-foreground">{profile?.balance || 0} ₽</span>
              </div>
            </div>

            <div className="px-5 space-y-2">
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full py-4 rounded-2xl text-white font-bold text-base tap-scale disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, hsl(220 70% 50%), hsl(260 55% 40%))",
                  boxShadow: "0 8px 24px hsl(230 60% 45% / 0.4)",
                }}
              >
                <Sparkles size={16} className="inline mr-2" />
                {purchasing ? "Оформление..." : `Подключить за ${plans.find((p) => p.id === selectedPlan)?.price.toLocaleString("ru-RU")} ₽`}
              </button>
              {onOpenSupport && (
                <button
                  onClick={() => onOpenSupport("Здравствуйте! Интересует тариф «Компания» для бизнеса.")}
                  className="w-full py-3 rounded-2xl bg-card border border-border text-sm font-semibold text-foreground active:bg-surface-1"
                >
                  Обсудить с менеджером
                </button>
              )}
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Средства спишутся с баланса кошелька. Автопродление можно отключить в любой момент.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyScreen;
