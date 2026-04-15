import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import { Search, Megaphone, Trash2, Ban, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatLastSeen } from "@/hooks/usePresence";

const avatarColors = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f43f5e, #fb923c)",
  "linear-gradient(135deg, #22c55e, #16a34a)",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const SwipeableChatItem = ({
  conv,
  index,
  onOpen,
  onDelete,
  onBlock,
}: {
  conv: ConversationItem;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
  onBlock: () => void;
}) => {
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const [swiped, setSwiped] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -80) {
      animate(x, -120, { duration: 0.2 });
      setSwiped(true);
    } else {
      animate(x, 0, { duration: 0.2 });
      setSwiped(false);
    }
  };

  const close = () => { animate(x, 0, { duration: 0.2 }); setSwiped(false); };
  const initials = conv.otherName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = getAvatarColor(conv.otherName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index < 8 ? index * 0.03 : 0, type: "spring", stiffness: 400, damping: 30 }}
      className="relative overflow-hidden"
    >
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-stretch gap-0 z-0"
        style={{ opacity: actionsOpacity }}
      >
        <button onClick={() => { close(); onBlock(); }} className="flex items-center justify-center w-16 bg-muted/80 text-foreground">
          <Ban size={18} />
        </button>
        <button onClick={() => { close(); onDelete(); }} className="flex items-center justify-center w-16 bg-destructive text-destructive-foreground">
          <Trash2 size={18} />
        </button>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={() => !swiped && onOpen()}
        className="relative z-10 flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-muted/20 transition-colors bg-background"
      >
        <div className="relative shrink-0">
          {conv.otherAvatarUrl ? (
            <img src={conv.otherAvatarUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover shadow-lg" />
          ) : (
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg"
              style={{ background: avatarBg }}
            >
              {initials}
            </div>
          )}
          {conv.otherLastSeen && formatLastSeen(conv.otherLastSeen).isOnline && (
            <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-[2.5px] border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0 border-b border-border/20 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-foreground truncate">{conv.otherName}</span>
            <span className={`text-[11px] shrink-0 ml-2 ${conv.unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{conv.lastTime}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[13px] text-muted-foreground truncate pr-2">{conv.lastMessage}</p>
            {conv.unreadCount > 0 && (
              <span className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ConversationItem {
  id: string;
  title: string | null;
  is_group: boolean | null;
  lastMessage: string;
  lastTime: string;
  lastTimestamp: string;
  otherName: string;
  otherAvatarUrl: string | null;
  unreadCount: number;
  otherLastSeen: string | null;
}

interface RealChatsScreenProps {
  onOpenChat: (conversationId: string, title: string) => void;
  onOpenChannel: () => void;
}

const RealChatsScreen = ({ onOpenChat, onOpenChannel }: RealChatsScreenProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!participations || participations.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);
    const readMap: Record<string, string | null> = {};
    participations.forEach((p) => { readMap[p.conversation_id] = (p as any).last_read_at; });

    const { data: convs } = await supabase.from("conversations").select("*").in("id", convIds);

    if (convs) {
      const allConvIds = convs.map(c => c.id);
      const [allParticipantsRes, allLastMsgsRes] = await Promise.all([
        supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", allConvIds).neq("user_id", user.id),
        supabase.from("messages").select("conversation_id, text, created_at, sender_id, message_type").in("conversation_id", allConvIds).order("created_at", { ascending: false }),
      ]);

      const participantsByConv: Record<string, string[]> = {};
      allParticipantsRes.data?.forEach(p => {
        if (!participantsByConv[p.conversation_id]) participantsByConv[p.conversation_id] = [];
        participantsByConv[p.conversation_id].push(p.user_id);
      });

      const lastMsgByConv: Record<string, { text: string | null; created_at: string; sender_id: string; message_type: string | null }> = {};
      allLastMsgsRes.data?.forEach(m => {
        if (!lastMsgByConv[m.conversation_id]) lastMsgByConv[m.conversation_id] = m;
      });

      const unreadByConv: Record<string, number> = {};
      allLastMsgsRes.data?.forEach(m => {
        if (m.sender_id !== user.id) {
          const lastRead = readMap[m.conversation_id];
          if (!lastRead || m.created_at > lastRead) {
            unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
          }
        }
      });

      const allOtherIds = [...new Set(Object.values(participantsByConv).flat())];
      let profileMap: Record<string, { name: string; lastSeen: string | null; avatarUrl: string | null }> = {};
      if (allOtherIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, last_seen_at, avatar_url").in("user_id", allOtherIds);
        profiles?.forEach(p => { profileMap[p.user_id] = { name: p.full_name, lastSeen: (p as any).last_seen_at, avatarUrl: p.avatar_url }; });
      }

      const items = convs.map(conv => {
        const otherIds = participantsByConv[conv.id] || [];
        const otherProfile = otherIds.length > 0 ? profileMap[otherIds[0]] : null;
        const otherName = conv.is_group ? (conv.title || "Группа") : (otherProfile?.name || conv.title || "Чат");
        const lastMsg = lastMsgByConv[conv.id];
        
        let lastMsgText = "Нет сообщений";
        if (lastMsg) {
          if (lastMsg.message_type === "voice") lastMsgText = "🎤 Голосовое сообщение";
          else if (lastMsg.message_type === "sticker") lastMsgText = lastMsg.text || "Стикер";
          else if (lastMsg.message_type === "image") lastMsgText = "📷 Фото";
          else if (lastMsg.message_type === "video") lastMsgText = "📹 Видео";
          else lastMsgText = lastMsg.text || "Медиа";
        }

        return {
          id: conv.id,
          title: conv.title,
          is_group: conv.is_group,
          lastMessage: lastMsgText,
          lastTime: lastMsg?.created_at
            ? new Date(lastMsg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
            : "",
          lastTimestamp: lastMsg?.created_at || conv.created_at,
          otherName,
          otherAvatarUrl: otherProfile?.avatarUrl || null,
          unreadCount: unreadByConv[conv.id] || 0,
          otherLastSeen: otherProfile?.lastSeen || null,
        };
      });
      items.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
      setConversations(items);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("chats-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants" },
        (payload) => {
          const p = payload.new as any;
          if (p.user_id === user?.id) fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === msg.conversation_id);
            if (idx === -1) { fetchConversations(); return prev; }
            const updated = [...prev];
            let msgText = msg.text || "Медиа";
            if (msg.message_type === "voice") msgText = "🎤 Голосовое сообщение";
            else if (msg.message_type === "sticker") msgText = msg.text || "Стикер";
            else if (msg.message_type === "image") msgText = "📷 Фото";
            updated[idx] = {
              ...updated[idx],
              lastMessage: msgText,
              lastTime: new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
              lastTimestamp: msg.created_at,
            };
            updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
            return updated;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  const filtered = conversations.filter((c) =>
    c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-foreground tracking-tight">Чаты</h1>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-muted/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none border-none focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Channel */}
      <div className="px-4 pb-1">
        <button
          onClick={onOpenChannel}
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/20 transition-colors"
        >
          <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-primary-foreground shrink-0 shadow-lg"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            <Megaphone size={22} />
          </div>
          <div className="flex-1 text-left min-w-0 border-b border-border/20 pb-3">
            <span className="text-[15px] font-semibold text-foreground">Gruzli Official</span>
            <p className="text-[13px] text-muted-foreground mt-0.5 truncate">Новости и обновления</p>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageCircle size={40} className="mb-3 opacity-30" />
          <p className="text-sm">
            {conversations.length === 0 ? "Нет чатов" : "Ничего не найдено"}
          </p>
          {conversations.length === 0 && (
            <p className="text-xs mt-1 opacity-60">Они появятся при отклике на заявку</p>
          )}
        </div>
      ) : (
        <div className="divide-y-0">
          {filtered.map((conv, i) => (
            <SwipeableChatItem
              key={conv.id}
              conv={conv}
              index={i}
              onOpen={() => onOpenChat(conv.id, conv.otherName)}
              onDelete={async () => {
                if (!user) return;
                if (!window.confirm("Диалог будет удалён у всех участников. Продолжить?")) return;
                const { data: mediaUrls, error } = await supabase.rpc('delete_conversation_fully', { _conversation_id: conv.id });
                if (error) { toast.error("Ошибка удаления"); return; }
                if (mediaUrls?.length) {
                  const paths = (mediaUrls as string[]).map(u => {
                    try { const url = new URL(u); const parts = url.pathname.split('/object/public/chat-media/'); return parts[1] || parts[0]; } catch { return u; }
                  }).filter(Boolean);
                  if (paths.length) await supabase.storage.from('chat-media').remove(paths);
                }
                setConversations((prev) => prev.filter((c) => c.id !== conv.id));
                toast.success("Диалог полностью удалён");
              }}
              onBlock={async () => {
                if (!user) return;
                const { data: participants } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", conv.id).neq("user_id", user.id).limit(1);
                const otherId = participants?.[0]?.user_id;
                if (!otherId) return;
                const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherId });
                if (error?.code === "23505") { toast.info("Уже в чёрном списке"); }
                else if (error) { toast.error("Ошибка"); }
                else { toast.success(`${conv.otherName} добавлен в чёрный список`); }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RealChatsScreen;
