import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Star, MessageCircle } from "lucide-react";
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
    <div className="pb-24">
      <div className="px-5 pt-12 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Диспетчеры</h1>
        <p className="text-sm text-muted-foreground">Найдите заказы через проверенных диспетчеров</p>
      </div>

      <div className="px-5 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск диспетчера..."
            className="w-full bg-surface-3 rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
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
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-surface-4 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {d.avatar}
                </div>
                {d.online && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-online border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{d.name}</h3>
                  {d.online && <span className="text-[10px] text-online font-medium">Онлайн</span>}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={12} className="text-primary fill-primary" />
                  <span className="text-xs font-medium text-foreground">{d.rating}</span>
                  <span className="text-xs text-muted-foreground ml-2">{d.activeOrders} активных заказов</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{d.bio}</p>
              </div>
            </div>
            <button
              onClick={() => onChatWithDispatcher(d)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-3 text-sm font-medium text-primary active:scale-[0.98] transition-transform"
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
