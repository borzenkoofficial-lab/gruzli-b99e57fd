import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, Calendar, CalendarDays, Menu, MapPin, Check, ChevronRight, Camera } from "lucide-react";
import { mockTodayOrders, mockWeekOrders, mockDoneOrders, type OrderItem } from "@/data/mockData";

const tabs = [
  { id: "today", label: "Сегодня", icon: Calendar },
  { id: "week", label: "На неделю", icon: CalendarDays },
  { id: "done", label: "Завершённые", icon: CheckCircle2 },
];

const checklistItems = [
  "Перчатки и спецодежда",
  "Стропы / ремни",
  "Упаковочные материалы",
  "Заряжен телефон",
  "Маршрут проверен",
];

const OrdersScreen = () => {
  const [activeTab, setActiveTab] = useState("today");
  const [arrivedOrders, setArrivedOrders] = useState<Set<string>>(new Set());
  const [showChecklist, setShowChecklist] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const orders = activeTab === "today" ? mockTodayOrders : activeTab === "week" ? mockWeekOrders : mockDoneOrders;

  const handleArrived = (orderId: string) => {
    setArrivedOrders(prev => new Set(prev).add(orderId));
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  };

  const toggleCheckItem = (i: number) => {
    setCheckedItems(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Мои заказы</h1>
        <div className="w-11" />
      </div>

      {/* Tabs */}
      <div className="px-5 pb-5 pt-2">
        <div className="flex gap-1.5 neu-inset rounded-2xl p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? "gradient-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div className="px-5 space-y-3">
        <AnimatePresence mode="popLayout">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.05 }}
              className="neu-card rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground flex-1">{order.title}</h3>
                <span className="text-base font-extrabold text-gradient-primary ml-2">{order.price.toLocaleString("ru-RU")} ₽</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Clock size={11} /> {order.date}, {order.time}</span>
                <span className="flex items-center gap-1"><MapPin size={11} /> {order.address}</span>
              </div>

              {/* Countdown timer for urgent */}
              {order.deadlineMinutes && order.progress < 100 && (
                <CountdownTimer minutes={order.deadlineMinutes} />
              )}

              {/* Progress bar */}
              {order.progress > 0 && order.progress < 100 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-primary font-semibold">{order.status}</span>
                    <span className="text-[11px] text-muted-foreground">{order.progress}%</span>
                  </div>
                  <div className="h-2 neu-inset rounded-full overflow-hidden">
                    <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${order.progress}%` }} />
                  </div>
                </div>
              )}

              {order.progress === 0 && (
                <span className="inline-block px-3 py-1 rounded-lg neu-raised-sm text-primary text-[11px] font-semibold mb-3">
                  {order.status}
                </span>
              )}

              {order.progress === 100 && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-online/15 text-online text-[11px] font-semibold">
                    <CheckCircle2 size={11} /> {order.status}
                  </span>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-raised-sm text-xs text-muted-foreground">
                    <Camera size={12} /> Фото-отчёт
                  </button>
                </div>
              )}

              {/* Action buttons for active orders */}
              {activeTab === "today" && order.progress < 100 && (
                <div className="flex gap-2 mt-3">
                  {!arrivedOrders.has(order.id) ? (
                    <button
                      onClick={() => handleArrived(order.id)}
                      className="flex-1 py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
                    >
                      📍 Я на месте
                    </button>
                  ) : (
                    <span className="flex-1 py-3.5 rounded-xl bg-online/15 text-online text-sm font-bold text-center">
                      ✓ Отмечено
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setShowChecklist(showChecklist === order.id ? null : order.id);
                      setCheckedItems(new Set());
                    }}
                    className="w-12 h-12 rounded-xl neu-raised flex items-center justify-center"
                  >
                    <Check size={16} className="text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Checklist */}
              <AnimatePresence>
                {showChecklist === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 neu-inset rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground mb-2">Чек-лист перед выездом</p>
                      {checklistItems.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleCheckItem(idx)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            checkedItems.has(idx) ? "gradient-primary" : "neu-raised-sm"
                          }`}>
                            {checkedItems.has(idx) && <Check size={12} className="text-primary-foreground" />}
                          </div>
                          <span className={`text-xs ${checkedItems.has(idx) ? "text-foreground" : "text-muted-foreground"}`}>
                            {item}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Нет заказов</div>
        )}
      </div>
    </div>
  );
};

const CountdownTimer = ({ minutes }: { minutes: number }) => {
  const [secsLeft, setSecsLeft] = useState(minutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;

  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-destructive/10">
      <Clock size={12} className="text-destructive" />
      <span className="text-xs font-bold text-destructive">
        Осталось {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  );
};

export default OrdersScreen;
