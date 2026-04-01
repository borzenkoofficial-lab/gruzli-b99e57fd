import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Menu, Edit3 } from "lucide-react";
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
    <div className="pb-28">
      {/* Header - exact match to reference */}
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Search size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Чаты</h1>
        <p className="text-sm text-muted-foreground mt-1">({mockChats.length} диалогов)</p>
      </div>

      {/* New Message Button - gradient like reference */}
      <div className="px-5 pb-5 flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm">
          <Edit3 size={16} />
          Новое сообщение
        </button>
        <button className="w-12 h-12 rounded-2xl neu-raised flex items-center justify-center">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Chat List */}
      <div className="px-5 space-y-1.5">
        {filtered.map((chat, i) => (
          <motion.div
            key={chat.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onOpenChat(chat)}
            className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-all duration-200 ${
              chat.unread > 0 ? "neu-flat" : "hover:bg-surface-3/30"
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full neu-raised flex items-center justify-center text-sm font-semibold text-muted-foreground">
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
              <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0">
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
