import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Search, Megaphone, Trash2, Ban, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatLastSeen } from "@/hooks/usePresence";

const avatarColors = [
  "#191a1d",
  "#2a2b2f",
  "#34353a",
  "#424348",
  "#505157",
  "#5c5d63",
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
      className="relative overflow-hidden native-list-item"
    >
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-stretch gap-0 z-0"
        style={{ opacity: actionsOpacity }}
      >
        <button onClick={() => { close(); onBlock(); }} className="native-press flex items-center justify-center w-16 bg-muted/80 text-foreground">
          <Ban size={18} />
        </button>
        <button onClick={() => { close(); onDelete(); }} className="native-press flex items-center justify-center w-16 bg-destructive text-destructive-foreground">
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
        className="relative z-10 flex items-center gap-3 px-3.5 py-3.5 cursor-pointer active:bg-muted/50 transition-colors bg-background border-b border-border/70"
      >
        <div className="relative shrink-0">
          {conv.isCommunity ? (
            <div
              className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-lg font-extrabold"
              style={{ background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))", color: "#1a1a1a" }}
            >
              G
            </div>
          ) : conv.otherAvatarUrl ? (
            <img src={conv.otherAvatarUrl} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
          ) : (
            <div
              className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: avatarBg }}
            >
              {initials}
            </div>
          )}
          {!conv.isCommunity && conv.otherLastSeen && formatLastSeen(conv.otherLastSeen).isOnline && (
            <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-[2.5px] border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0 border-b border-border/20 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-foreground truncate">{conv.otherName}</span>
            <span className={`text-[12px] shrink-0 ml-2 ${conv.unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{conv.lastTime}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[14px] text-muted-foreground truncate pr-2">{conv.lastMessage}</p>
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
  isCommunity?: boolean;
}

interface RealChatsScreenProps {
  onOpenChat: (conversationId: string, title: string) => void;
  onOpenChannel: () => void;
  onOpenCommunity?: () => void;
}

const RealChatsScreen = ({ onOpenChat, onOpenChannel, onOpenCommunity }: RealChatsScreenProps) => {
  const { user } = useAuth();
  const isDemo = user?.id?.startsWith("demo-") === true;
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) { setConversations([]); setLoading(false); return; }

    if (isDemo) {
      const now = new Date();
      setConversations([
        { id: "demo-chat-dispatcher", title: "Анна Петрова", is_group: false, lastMessage: "Сергей, завтра в 10:00 начинаем.", lastTime: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), lastTimestamp: now.toISOString(), otherName: "Анна Петрова", otherAvatarUrl: null, unreadCount: 2, otherLastSeen: now.toISOString() },
        { id: "demo-chat-worker", title: "Алексей Морозов", is_group: false, lastMessage: "Грузчики подтверждены, всё в силе.", lastTime: "14:32", lastTimestamp: new Date(now.getTime() - 4 * 60000).toISOString(), otherName: "Алексей Морозов", otherAvatarUrl: null, unreadCount: 1, otherLastSeen: now.toISOString() },
        { id: "demo-chat-gruzli", title: "Gruzli Official", is_group: true, lastMessage: "Добро пожаловать в Gruzli.", lastTime: "Вчера", lastTimestamp: new Date(now.getTime() - 86400000).toISOString(), otherName: "Gruzli Official", otherAvatarUrl: null, unreadCount: 0, otherLastSeen: null, isCommunity: true },
      ]);
      setCommunityId("demo-community");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/conversations", { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Не удалось загрузить диалоги");
      setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
    } catch (error) {
      console.error("[chat] Conversation list request failed:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки диалогов");
    } finally {
      setLoading(false);
    }
  }, [user, isDemo]); 

  useEffect(() => {
    fetchConversations();
    if (isDemo) return;
    const interval = window.setInterval(fetchConversations, 10000);
    return () => window.clearInterval(interval);
  }, [fetchConversations, isDemo]);

  const filtered = conversations.filter((c) =>
    c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="gruzli-chats-screen">
      {/* Header */}
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Gruzli</p><h1 className="text-[29px] font-extrabold text-foreground tracking-[-.045em] leading-none">Чаты</h1></div>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full min-h-[46px] bg-card rounded-[14px] py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-foreground/20 transition-colors"
          />
        </div>
      </div>

      {/* Channel */}
      <div className="px-5 pb-2">
        <button
          onClick={onOpenChannel}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[18px] border border-border bg-card active:bg-muted/50 transition-colors"
        >
          <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-primary-foreground shrink-0"
            style={{ background: "#191a1d" }}
          >
            <Megaphone size={22} />
          </div>
          <div className="flex-1 text-left min-w-0 border-b border-border/20 pb-3">
            <span className="text-[16px] font-semibold text-foreground">Gruzli Official</span>
            <p className="text-[14px] text-muted-foreground mt-0.5 truncate">Новости и обновления</p>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mx-5 mt-4 flex flex-col items-center justify-center py-16 text-muted-foreground rounded-[20px] border border-dashed border-border bg-card">
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
              onOpen={() => {
                if (conv.isCommunity && onOpenCommunity) onOpenCommunity();
                else onOpenChat(conv.id, conv.otherName);
              }}
              onDelete={async () => {
                if (!user) return;
                if (!window.confirm("Диалог будет удалён у всех участников. Продолжить?")) return;
                try {
                  const response = await fetch(`/api/conversations/${conv.id}`, { method: "DELETE", credentials: "same-origin" });
                  if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload?.error?.message || "Ошибка удаления");
                  }
                  setConversations((prev) => prev.filter((item) => item.id !== conv.id));
                  toast.success("Диалог полностью удалён");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Ошибка удаления");
                }
              }}
              onBlock={async () => {
                if (!user) return;
                try {
                  const response = await fetch(`/api/conversations/${conv.id}/block`, { method: "POST", credentials: "same-origin" });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) throw new Error(payload?.error?.message || "Ошибка блокировки");
                  toast.success(`${conv.otherName} добавлен в чёрный список`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Ошибка блокировки");
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RealChatsScreen;
