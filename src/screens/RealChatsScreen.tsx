import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import { Search, Megaphone, Trash2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Avatar color from name hash (Telegram-style)
const avatarColors = [
  "hsl(210 70% 55%)", "hsl(340 65% 55%)", "hsl(160 60% 45%)",
  "hsl(30 80% 55%)", "hsl(270 60% 55%)", "hsl(190 70% 45%)",
  "hsl(0 65% 55%)", "hsl(120 50% 45%)",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

// Swipeable chat row
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

  const close = () => {
    animate(x, 0, { duration: 0.2 });
    setSwiped(false);
  };

  const initials = conv.otherName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = getAvatarColor(conv.otherName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 500, damping: 30 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Action buttons behind */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-stretch gap-0 z-0"
        style={{ opacity: actionsOpacity }}
      >
        <button onClick={() => { close(); onBlock(); }} className="flex items-center justify-center w-14 bg-muted text-foreground">
          <Ban size={18} />
        </button>
        <button onClick={() => { close(); onDelete(); }} className="flex items-center justify-center w-14 bg-destructive text-destructive-foreground rounded-r-2xl">
          <Trash2 size={18} />
        </button>
      </motion.div>

      {/* Foreground card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={() => !swiped && onOpen()}
        className="relative z-10 flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer active:bg-muted/30 transition-colors duration-150 bg-background"
      >
        {/* Avatar with color */}
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: avatarBg }}
          >
            {initials}
          </div>
          {/* Online dot */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-online border-2 border-background" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground truncate">{conv.otherName}</span>
            <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{conv.lastTime}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[13px] text-muted-foreground truncate">{conv.lastMessage}</p>
            {conv.unreadCount > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
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
  unreadCount: number;
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
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participations || participations.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);
    const { data: convs } = await supabase.from("conversations").select("*").in("id", convIds);

    if (convs) {
      const items = await Promise.all(
        convs.map(async (conv) => {
          const [msgsRes, participantsRes] = await Promise.all([
            supabase.from("messages").select("text, created_at").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("conversation_participants").select("user_id").eq("conversation_id", conv.id).neq("user_id", user.id),
          ]);

          let otherName = conv.title || "Чат";
          if (participantsRes.data && participantsRes.data.length > 0 && !conv.title) {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", participantsRes.data[0].user_id).single();
            if (profile) otherName = profile.full_name;
          }

          const lastMsg = msgsRes.data?.[0];
          return {
            id: conv.id,
            title: conv.title,
            is_group: conv.is_group,
            lastMessage: lastMsg?.text || "Нет сообщений",
            lastTime: lastMsg?.created_at
              ? new Date(lastMsg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
              : "",
            lastTimestamp: lastMsg?.created_at || conv.created_at,
            otherName,
            unreadCount: 0, // TODO: implement unread tracking
          };
        })
      );
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
            if (idx === -1) {
              fetchConversations();
              return prev;
            }
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              lastMessage: msg.text || "Медиа",
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
      <div className="px-5 safe-top pb-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Чаты</h1>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-muted/40 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/30 transition-colors"
          />
        </div>
      </div>

      {/* Channel button */}
      <div className="px-4 pb-3">
        <button
          onClick={onOpenChannel}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-muted/30 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <Megaphone size={20} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-semibold text-foreground">Gruzli Official</span>
            <p className="text-[13px] text-muted-foreground mt-0.5 truncate">Новости и обновления</p>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {conversations.length === 0 ? "Нет чатов. Они появятся, когда вы откликнетесь на заявку или примете отклик." : "Ничего не найдено"}
        </div>
      ) : (
        <div className="px-4 space-y-0.5">
          {filtered.map((conv, i) => (
            <SwipeableChatItem
              key={conv.id}
              conv={conv}
              index={i}
              onOpen={() => onOpenChat(conv.id, conv.otherName)}
              onDelete={async () => {
                if (!user) return;
                await supabase.from("conversation_participants").delete().eq("conversation_id", conv.id).eq("user_id", user.id);
                setConversations((prev) => prev.filter((c) => c.id !== conv.id));
                toast.success("Диалог удалён");
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
