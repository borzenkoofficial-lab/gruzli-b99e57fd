import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { mockChats, type ChatPreview } from "@/data/mockData";

interface ChatsScreenProps {
  onOpenChat: (chat: ChatPreview) => void;
}

const ChatsScreen = ({ onOpenChat }: ChatsScreenProps) => {
  const [search, setSearch] = useState("");
  const filtered = mockChats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Чаты</h1>
          <p className="text-sm text-muted-foreground">{mockChats.length} диалогов</p>
        </div>
        <button className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
          <SlidersHorizontal size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по чатам..."
            className="w-full bg-surface-3 rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="px-5 space-y-1">
        {filtered.map((chat, i) => (
          <motion.div
            key={chat.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onOpenChat(chat)}
            className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:scale-[0.98] transition-all ${
              chat.unread > 0 ? "bg-surface-3" : "hover:bg-surface-3/50"
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-surface-4 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                {chat.avatar}
              </div>
              {chat.online && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-online border-2 border-surface-2" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{chat.name}</span>
                <span className="text-[11px] text-muted-foreground">{chat.time}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
            </div>

            {/* Unread Badge */}
            {chat.unread > 0 && (
              <div className="w-5 h-5 rounded-full gradient-cyan flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0">
                {chat.unread}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ChatsScreen;
