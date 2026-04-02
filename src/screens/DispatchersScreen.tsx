import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, MessageCircle, Menu, Zap, Users, Send } from "lucide-react";
import { mockDispatchers, type Dispatcher } from "@/data/mockData";

interface DispatchersScreenProps {
  onChatWithDispatcher: (d: Dispatcher) => void;
}

const DispatchersScreen = ({ onChatWithDispatcher }: DispatchersScreenProps) => {
  const [search, setSearch] = useState("");
  const [showQuickMsg, setShowQuickMsg] = useState(false);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);

  const filtered = mockDispatchers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const onlineDispatchers = mockDispatchers.filter(d => d.online);

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Search size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Диспетчеры</h1>
        <p className="text-sm text-muted-foreground mt-1">Проверенные координаторы заказов</p>
      </div>

      {/* Quick actions */}
      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={() => setShowQuickMsg(!showQuickMsg)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          <Zap size={16} /> Быстрый диспетчер
        </button>
        <button
          onClick={() => setShowTeamBuilder(!showTeamBuilder)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl neu-raised text-foreground font-semibold text-sm active:neu-inset transition-all"
        >
          <Users size={16} /> Собрать бригаду
        </button>
      </div>

      {/* Quick message to all online dispatchers */}
      <AnimatePresence>
        {showQuickMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-4 overflow-hidden"
          >
            <div className="neu-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Сообщение будет отправлено {onlineDispatchers.length} диспетчерам онлайн
              </p>
              <div className="flex gap-2">
                <div className="flex-1 neu-inset rounded-xl px-3 py-2.5">
                  <input placeholder="Ищу заказ на сегодня..." className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                </div>
                <button className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
                  <Send size={16} className="text-primary-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team builder */}
      <AnimatePresence>
        {showTeamBuilder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-4 overflow-hidden"
          >
            <div className="neu-card rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-2">⚡ Собрать бригаду за 30 секунд</p>
              <p className="text-xs text-muted-foreground mb-3">
                Пригласить свободных грузчиков рядом
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[2, 3, 4].map(n => (
                  <button key={n} className="py-2.5 rounded-xl neu-raised-sm text-sm font-semibold text-foreground text-center active:neu-inset transition-all">
                    {n} чел.
                  </button>
                ))}
              </div>
              <button className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform">
                🚀 Найти бригаду
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="px-5 pb-5">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск диспетчера..."
            className="w-full neu-inset rounded-2xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      <div className="px-5 space-y-3">
        {filtered.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="neu-card rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full neu-raised flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {d.avatar}
                </div>
                {d.online && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-online border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{d.name}</h3>
                  {d.online && <span className="text-[10px] text-online font-semibold">Онлайн</span>}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={12} className="text-primary fill-primary" />
                  <span className="text-xs font-semibold text-foreground">{d.rating}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">{d.activeOrders} заказов</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{d.bio}</p>
              </div>
            </div>
            <button
              onClick={() => onChatWithDispatcher(d)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
            >
              <MessageCircle size={14} /> Написать
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DispatchersScreen;
