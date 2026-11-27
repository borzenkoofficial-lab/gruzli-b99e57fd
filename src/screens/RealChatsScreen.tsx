import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
  onBlock,
}: {
  conv: ConversationItem;
  index: number;
  onOpen: () => void;
  onBlock: () => void;
}) => {
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const [swiped, setSwiped] = useState(false);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -48) {
      animate(x, -64, { duration: 0.2 });
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
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -64, right: 0 }}
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
