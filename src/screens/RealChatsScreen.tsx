import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Edit3, Users, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ConversationItem {
  id: string;
  title: string | null;
  is_group: boolean | null;
  lastMessage: string;
  lastTime: string;
  otherName: string;
}

interface RealChatsScreenProps {
  onOpenChat: (conversationId: string, title: string) => void;
}

const RealChatsScreen = ({ onOpenChat }: RealChatsScreenProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;
    
    // Get conversations the user participates in
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participations || participations.length === 0) {
      setLoading(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds);

    if (convs) {
      const items = await Promise.all(
        convs.map(async (conv) => {
          // Get last message
          const { data: msgs } = await supabase
            .from("messages")
            .select("text, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1);

          // Get other participants
          const { data: participants } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id);

          let otherName = conv.title || "Чат";
          if (participants && participants.length > 0 && !conv.title) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", participants[0].user_id)
              .single();
            if (profile) otherName = profile.full_name;
          }

          return {
            id: conv.id,
            title: conv.title,
            is_group: conv.is_group,
            lastMessage: msgs?.[0]?.text || "Нет сообщений",
            lastTime: msgs?.[0]?.created_at
              ? new Date(msgs[0].created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
              : "",
            otherName,
          };
        })
      );
      setConversations(items);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    // Realtime: refresh when new conversation_participants or messages arrive
    const channel = supabase
      .channel('chats-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_participants' },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = conversations.filter((c) =>
    c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-28">
      <div className="px-5 pt-14 pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Чаты</h1>
        <p className="text-sm text-muted-foreground mt-1">({conversations.length} диалогов)</p>
      </div>

      {/* Search */}
      <div className="px-5 pb-5">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full neu-inset rounded-2xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {conversations.length === 0 ? "Нет чатов. Они появятся, когда вы откликнетесь на заявку или примете отклик." : "Ничего не найдено"}
        </div>
      ) : (
        <div className="px-5 space-y-1.5">
          {filtered.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onOpenChat(conv.id, conv.otherName)}
              className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-all duration-200 neu-flat"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold neu-raised text-muted-foreground">
                {conv.otherName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{conv.otherName}</span>
                  <span className="text-[11px] text-muted-foreground">{conv.lastTime}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RealChatsScreen;
