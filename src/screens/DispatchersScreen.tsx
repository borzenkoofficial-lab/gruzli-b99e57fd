import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Star, MessageCircle, Menu } from "lucide-react";
import { mockDispatchers, type Dispatcher } from "@/data/mockData";

interface DispatchersScreenProps {
  onChatWithDispatcher: (d: Dispatcher) => void;
}

const DispatchersScreen = ({ onChatWithDispatcher }: DispatchersScreenProps) => {
  const [search, setSearch] = useState("");
  const filtered = mockDispatchers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Search - neumorphic inset */}
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
