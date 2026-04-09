import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Star, MessageCircle, Menu, Zap, Users, Send, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface DispatchersScreenProps {
  onChatWithDispatcher: (d: { id: string; name: string; avatar: string }) => void;
}

const DispatchersScreen = ({ onChatWithDispatcher }: DispatchersScreenProps) => {
  const [search, setSearch] = useState("");
  const [dispatchers, setDispatchers] = useState<(Tables<"profiles"> & { isOnline: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDispatchers = async () => {
      // Get all users with dispatcher role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "dispatcher");

      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", roles.map((r) => r.user_id));

        if (profiles) {
          setDispatchers(profiles.map((p) => ({ ...p, isOnline: true })));
        }
      }
      setLoading(false);
    };
    fetchDispatchers();
  }, []);

  const filtered = dispatchers.filter((d) =>
    d.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div >
      <div className="px-5 safe-top pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Диспетчеры</h1>
        <p className="text-sm text-muted-foreground mt-1">Координаторы заказов</p>
      </div>

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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {dispatchers.length === 0 ? "Нет зарегистрированных диспетчеров" : "Ничего не найдено"}
        </div>
      ) : (
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
                    {getInitials(d.full_name)}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-online border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">{d.full_name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={12} className="text-primary fill-primary" />
                    <span className="text-xs font-semibold text-foreground">{d.rating || "5.00"}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">{d.completed_orders || 0} заказов</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onChatWithDispatcher({
                  id: d.user_id,
                  name: d.full_name,
                  avatar: getInitials(d.full_name),
                })}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
              >
                <MessageCircle size={14} /> Написать
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DispatchersScreen;
