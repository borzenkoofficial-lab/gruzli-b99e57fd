import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Zap, Shield, Star, Infinity, Sparkles, Briefcase, BarChart3, Brain, Users, FileText, Headphones, Rocket, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PremiumScreenProps {
  onBack: () => void;
  onOpenSupport?: (prefillMessage?: string) => void;
}

type Tier = {
  id: string;
  name: string;
  tagline: string;
  price: number; // monthly
  accent: string; // gradient
  badge?: string;
  popular?: boolean;
  features: { icon: any; title: string; desc: string }[];
};

const workerTiers: Tier[] = [
  {
    id: "worker_start",
    name: "Старт",
    tagline: "Базовый аккаунт",
    price: 0,
    accent: "linear-gradient(135deg, hsl(220 15% 35%), hsl(220 15% 25%))",
    features: [
      { icon: Briefcase, title: "До 3 заказов в неделю", desc: "Базовый лимит откликов" },
      { icon: Star, title: "Стандартный профиль", desc: "Обычная карточка в поиске" },
      { icon: Headphones, title: "Поддержка", desc: "Ответ в течение 24 часов" },
    ],
  },
  {
    id: "worker_premium",
    name: "Premium",
    tagline: "Для активных грузчиков",
    price: 299,
    accent: "linear-gradient(135deg, hsl(43 96% 56%), hsl(25 95% 53%))",
    badge: "Популярный",
    popular: true,
    features: [
      { icon: Infinity, title: "Безлимитные заказы", desc: "Никаких ограничений в неделю" },
      { icon: Crown, title: "Значок Premium", desc: "Золотой значок в профиле и чатах" },
      { icon: Zap, title: "Приоритет откликов", desc: "Ваш отклик выше в списке" },
      { icon: Sparkles, title: "Золотой аватар", desc: "Аватар светится золотым" },
      { icon: Star, title: "Эксклюзивные заказы", desc: "Доступ к Premium-заявкам" },
    ],
  },
  {
    id: "worker_vip",
    name: "VIP",
    tagline: "Максимум возможностей",
    price: 599,
    accent: "linear-gradient(135deg, hsl(280 70% 55%), hsl(230 65% 55%))",
    badge: "Максимум",
    features: [
      { icon: Crown, title: "Всё из Premium", desc: "Все возможности Premium включены" },
      { icon: Rocket, title: "Топ выдачи", desc: "Первым в результатах поиска" },
      { icon: Shield, title: "Верификация бесплатно", desc: "Бейдж «Проверено» без оплаты" },
      { icon: Headphones, title: "Личный менеджер", desc: "Поддержка 24/7 в чате" },
      { icon: Award, title: "Бонусы и кэшбэк", desc: "5% возврата с каждого заказа" },
    ],
  },
];

const dispatcherTiers: Tier[] = [
  {
    id: "disp_start",
    name: "Старт",
    tagline: "Бесплатный аккаунт",
    price: 0,
    accent: "linear-gradient(135deg, hsl(220 15% 35%), hsl(220 15% 25%))",
    features: [
      { icon: Briefcase, title: "До 5 заявок в месяц", desc: "Базовый лимит публикаций" },
      { icon: Users, title: "Поиск грузчиков", desc: "Доступ к каталогу исполнителей" },
      { icon: Headphones, title: "Стандартная поддержка", desc: "Ответ в течение 24 часов" },
    ],
  },
  {
    id: "disp_pro",
    name: "Pro",
    tagline: "Полный кабинет диспетчера",
    price: 299,
    accent: "linear-gradient(135deg, hsl(230 65% 55%), hsl(260 60% 45%))",
    badge: "Популярный",
    popular: true,
    features: [
      { icon: Briefcase, title: "Кабинет диспетчера", desc: "Все инструменты управления заявками" },
      { icon: Infinity, title: "Безлимитные заявки", desc: "Публикуйте сколько нужно" },
      { icon: BarChart3, title: "Аналитика и отчёты", desc: "Прибыль, конверсия, нагрузка" },
      { icon: Brain, title: "Нейросеть-помощник", desc: "AI улучшает описания и подбирает грузчиков" },
      { icon: FileText, title: "Договоры и документы", desc: "Генерация PDF и подписи" },
      { icon: Zap, title: "SOS-замена", desc: "Мгновенный поиск замены исполнителю" },
      { icon: Users, title: "Топ-грузчики", desc: "Свой список проверенных" },
      { icon: Crown, title: "Значок Pro", desc: "Выделение в каталоге диспетчеров" },
    ],
  },
  {
    id: "disp_business",
    name: "Бизнес",
    tagline: "Для команд и компаний",
    price: 999,
    accent: "linear-gradient(135deg, hsl(280 70% 55%), hsl(230 65% 55%))",
    badge: "Команда",
    features: [
      { icon: Crown, title: "Всё из Pro", desc: "Все возможности тарифа Pro" },
      { icon: Users, title: "До 10 сотрудников", desc: "Общий кабинет для команды" },
      { icon: BarChart3, title: "Расширенная аналитика", desc: "Когорты, экспорт в Excel" },
      { icon: Brain, title: "AI без лимитов", desc: "Безлимит запросов к нейросети" },
      { icon: Shield, title: "Приоритетная верификация", desc: "Бейдж «Компания» бесплатно" },
      { icon: Headphones, title: "Личный менеджер", desc: "Поддержка 24/7" },
    ],
  },
];

const periods = [
  { id: "month", label: "1 мес", multiplier: 1, save: 0 },
  { id: "quarter", label: "3 мес", multiplier: 2.5, save: 17 },
  { id: "year", label: "12 мес", multiplier: 8, save: 33 },
];

const PremiumScreen = ({ onBack, onOpenSupport }: PremiumScreenProps) => {
  const { user, profile, role } = useAuth();
  const isDispatcher = role === "dispatcher";
  const tiers = isDispatcher ? dispatcherTiers : workerTiers;
  const defaultTierId = isDispatcher ? "disp_pro" : "worker_premium";

  const [selectedTierId, setSelectedTierId] = useState(defaultTierId);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [purchasing, setPurchasing] = useState(false);

  const selectedTier = useMemo(() => tiers.find((t) => t.id === selectedTierId)!, [tiers, selectedTierId]);
  const period = periods.find((p) => p.id === selectedPeriod)!;
  const totalPrice = Math.round(selectedTier.price * period.multiplier);
  const isPremium = profile?.is_premium;

  const handlePurchase = async () => {
    if (!user || !profile) return;
    if (selectedTier.price === 0) {
      toast.info("Это базовый бесплатный тариф — он уже активен");
      return;
    }

    const balance = profile.balance || 0;
    if (balance < totalPrice) {
      toast.error(`Недостаточно средств. Нужно ${totalPrice} ₽, на балансе ${balance} ₽`);
      return;
    }

    setPurchasing(true);
    const { error } = await supabase.rpc("purchase_premium", {
      _tier_id: selectedTier.id,
      _period_id: selectedPeriod,
    });

    if (error) {
      toast.error(error.message.includes("insufficient_balance") ? `Недостаточно средств. Нужно ${totalPrice} ₽, на балансе ${balance} ₽` : "Не удалось активировать тариф");
      setPurchasing(false);
      return;
    }

    toast.success(`Тариф «${selectedTier.name}» активирован! 🎉`);
    setPurchasing(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="gruzli-premium-screen fixed inset-0 bg-background flex flex-col" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Тарифы</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
        {/* Hero */}
        <div className="mx-5 mb-5 rounded-3xl overflow-hidden" style={{ background: selectedTier.accent, boxShadow: "0 8px 32px hsl(230 60% 30% / 0.4)" }}>
          <div className="px-6 py-7 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="mx-auto w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3"
            >
              {isDispatcher ? <Briefcase size={32} className="text-white" /> : <Crown size={32} className="text-white" />}
            </motion.div>
            <h2 className="text-white text-2xl font-extrabold mb-1">
              {isDispatcher ? "Gruzli для диспетчеров" : "Gruzli Premium"}
            </h2>
            <p className="text-white/80 text-sm">
              {isDispatcher ? "Кабинет, аналитика, AI и больше функций" : "Выберите тариф под свой ритм работы"}
            </p>
          </div>
        </div>

        {isPremium && (
          <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Crown size={20} className="text-yellow-500" />
              <div>
                <p className="text-sm font-bold text-foreground">Активный тариф</p>
                <p className="text-xs text-muted-foreground">
                  До {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString("ru-RU") : "∞"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tier selector */}
        <div className="px-5 mb-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Выберите тариф</h3>
          <div className="space-y-2.5">
            {tiers.map((tier) => {
              const isSel = tier.id === selectedTierId;
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`w-full text-left rounded-2xl p-4 transition-all border-2 ${
                    isSel ? "border-primary bg-card" : "border-transparent bg-card"
                  }`}
                  style={isSel ? { boxShadow: "0 4px 16px hsl(230 60% 45% / 0.2)" } : {}}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                      isSel ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isSel && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-extrabold text-foreground">{tier.name}</span>
                        {tier.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-[10px] font-bold text-primary uppercase tracking-wider">
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tier.tagline}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {tier.price === 0 ? (
                        <span className="text-base font-extrabold text-foreground">Бесплатно</span>
                      ) : (
                        <>
                          <span className="text-lg font-extrabold text-foreground">{tier.price}</span>
                          <span className="text-xs text-muted-foreground"> ₽/мес</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Features of selected tier */}
        <div className="px-5 mb-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Что входит в «{selectedTier.name}»</h3>
          <div className="space-y-2">
            {selectedTier.features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <f.icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Period selector (for paid tiers) */}
        {selectedTier.price > 0 && (
          <div className="px-5 mb-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Период оплаты</h3>
            <div className="grid grid-cols-3 gap-2">
              {periods.map((p) => {
                const isSel = p.id === selectedPeriod;
                const price = Math.round(selectedTier.price * p.multiplier);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    className={`rounded-2xl p-3 border-2 transition-all text-center ${
                      isSel ? "border-primary bg-card" : "border-transparent bg-card"
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">{p.label}</p>
                    <p className="text-sm font-extrabold text-foreground mt-1">{price} ₽</p>
                    {p.save > 0 && (
                      <p className="text-[10px] font-bold text-green-500 mt-0.5">−{p.save}%</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Balance */}
        {selectedTier.price > 0 && (
          <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Баланс кошелька</span>
            <span className="text-lg font-extrabold text-foreground">{profile?.balance || 0} ₽</span>
          </div>
        )}

        {/* Purchase */}
        <div className="px-5">
          <button
            onClick={handlePurchase}
            disabled={purchasing || selectedTier.price === 0}
            className="w-full py-4 rounded-2xl text-white font-bold text-base tap-scale disabled:opacity-50"
            style={{
              background: selectedTier.accent,
              boxShadow: "0 8px 24px hsl(230 60% 30% / 0.4)",
            }}
          >
            {selectedTier.price === 0
              ? "Бесплатный тариф активен"
              : purchasing
              ? "Оформление..."
              : `Подключить за ${totalPrice} ₽`}
          </button>
          {selectedTier.price > 0 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Средства спишутся с баланса кошелька
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumScreen;
