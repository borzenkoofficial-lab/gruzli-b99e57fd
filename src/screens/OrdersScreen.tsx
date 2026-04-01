import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, Send, Menu, Search } from "lucide-react";

const tabs = [
  { id: "active", label: "В работе", icon: Clock },
  { id: "applied", label: "Откликнулся", icon: Send },
  { id: "done", label: "Завершённые", icon: CheckCircle2 },
];

const mockOrders = {
  active: [
    { id: "1", title: "Переезд 2-комнатной квартиры", price: 12000, date: "15 апр, 09:00", status: "В пути", progress: 40 },
    { id: "2", title: "Подъём мебели на 9 этаж", price: 6000, date: "15 апр, 16:00", status: "Ожидание", progress: 10 },
  ],
  applied: [
    { id: "3", title: "Разгрузка фуры", price: 8500, date: "16 апр, 07:00", status: "Ждёт ответа", progress: 0 },
  ],
  done: [
    { id: "4", title: "Офисный переезд", price: 25000, date: "10 апр", status: "Завершён", progress: 100 },
    { id: "5", title: "Такелаж станка", price: 15000, date: "8 апр", status: "Завершён", progress: 100 },
  ],
};

const OrdersScreen = () => {
  const [activeTab, setActiveTab] = useState("active");
  const orders = mockOrders[activeTab as keyof typeof mockOrders];

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Search size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Мои заказы</h1>
      </div>

      {/* Tabs - neumorphic */}
      <div className="px-5 pb-5">
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
        {orders.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="neu-card rounded-2xl p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground flex-1">{order.title}</h3>
              <span className="text-base font-extrabold text-gradient-primary ml-2">{order.price.toLocaleString("ru-RU")} ₽</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{order.date}</p>
            
            {order.progress > 0 && order.progress < 100 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-primary font-semibold">{order.status}</span>
                  <span className="text-[11px] text-muted-foreground">{order.progress}%</span>
                </div>
                <div className="h-2 neu-inset rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all"
                    style={{ width: `${order.progress}%` }}
                  />
                </div>
              </div>
            )}

            {order.progress === 0 && (
              <span className="inline-block px-3 py-1 rounded-lg neu-raised-sm text-primary text-[11px] font-semibold">
                {order.status}
              </span>
            )}
            {order.progress === 100 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-online/15 text-online text-[11px] font-semibold">
                <CheckCircle2 size={11} /> {order.status}
              </span>
            )}
          </motion.div>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Нет заказов
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersScreen;
