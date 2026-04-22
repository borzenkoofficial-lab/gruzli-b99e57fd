import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Paperclip, Image, Video, X, Check, CheckCheck, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const COMMUNITY_SETTING_KEY = "dispatcher_community_conversation_id";
const ADMIN_USER_ID = "de95eea5-d75b-4693-af15-020c58422126";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  media_url?: string | null;
  message_type: string | null;
  created_at: string;
  _optimistic?: boolean;
}

interface DispatcherCommunityScreenProps {
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
}

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

const formatDateSeparator = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDate.getTime() === today.getTime()) return "Сегодня";
  if (msgDate.getTime() === yesterday.getTime()) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

const isSameDay = (a: string, b: string) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const isSameGroup = (a: Message, b: Message) =>
  a.sender_id === b.sender_id &&
  Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 120000;

const GroupMessageBubble = memo(({ msg, isOwn, showSender, senderName, isLastInGroup, avatarUrl, onOpenProfile, isAdmin, canModerate, onDelete }: {
  msg: Message;
  isOwn: boolean;
  showSender: boolean;
  senderName: string;
  isLastInGroup: boolean;
  avatarUrl?: string | null;
  onOpenProfile?: (userId: string) => void;
  isAdmin: boolean;
  canModerate: boolean;
  onDelete?: () => void;
}) => {
  const time = new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const initials = senderName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-2" : "mb-0.5"} ${msg._optimistic ? "opacity-60" : ""}`}>
      {/* Avatar for other users */}
      {!isOwn && showSender && isLastInGroup ? (
        <button
          onClick={() => onOpenProfile?.(msg.sender_id)}
          className="w-8 h-8 rounded-full shrink-0 mr-2 mt-auto flex items-center justify-center text-[11px] font-bold text-white overflow-hidden"
          style={{ background: getAvatarColor(senderName) }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
        </button>
      ) : !isOwn ? (
        <div className="w-8 mr-2 shrink-0" />
      ) : null}

      <div className={`max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}>
        {showSender && !isOwn && (
          <button onClick={() => onOpenProfile?.(msg.sender_id)} className="flex items-center gap-1 mb-0.5 ml-1">
            <p className="text-[11px] font-semibold" style={{ color: getAvatarColor(senderName) }}>
              {senderName}
            </p>
            {isAdmin && <Shield size={10} className="text-primary" />}
          </button>
        )}
        <div
          className={`relative px-3 py-2 ${
            isOwn
              ? `bubble-own ${isLastInGroup ? "rounded-2xl rounded-br-sm" : "rounded-2xl"}`
              : `bubble-other ${isLastInGroup ? "rounded-2xl rounded-bl-sm" : "rounded-2xl"}`
          }`}
          onContextMenu={(e) => { if (canModerate || isOwn) { e.preventDefault(); setShowActions(true); } }}
          onClick={() => showActions && setShowActions(false)}
        >
          {msg.message_type === "image" && msg.media_url ? (
            <img src={msg.media_url} alt="" className="max-w-full rounded-xl max-h-60 object-cover cursor-pointer" onClick={() => window.open(msg.media_url!, "_blank")} />
          ) : (
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          )}
          <div className={`flex items-end gap-1.5 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground leading-none">{time}</span>
            {isOwn && (msg._optimistic ? <Check size={12} className="text-muted-foreground" /> : <CheckCheck size={12} className="text-primary" />)}
          </div>

          {/* Delete action */}
          <AnimatePresence>
            {showActions && (canModerate || isOwn) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute -top-10 right-0 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); onDelete?.(); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={12} />
                  Удалить
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
GroupMessageBubble.displayName = "GroupMessageBubble";

const DispatcherCommunityScreen = ({ onBack, onOpenProfile }: DispatcherCommunityScreenProps) => {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const canModerate = isAdmin || user?.id === ADMIN_USER_ID;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, { name: string; avatar_url?: string | null }>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersCount, setMembersCount] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const profilesRef = useRef(senderProfiles);
  profilesRef.current = senderProfiles;

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "instant" });
      }
    });
  }, []);

  const isNearBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => { adjustTextarea(); }, [text, adjustTextarea]);

  // Get or create community conversation, and join as participant via RPC
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: convId, error } = await supabase.rpc("join_dispatcher_community");
      if (error || !convId) {
        toast.error("Не удалось войти в сообщество");
        setLoading(false);
        return;
      }

      setConversationId(convId as string);

      // Get members count
      const { count } = await supabase
        .from("conversation_participants")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId as string);
      setMembersCount(count || 0);
    };
    init();
  }, [user]);

  // Fetch messages when conversation ID is known
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data: msgsData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (msgsData) {
        setMessages(msgsData as Message[]);
        const senderIds = [...new Set(msgsData.map(m => m.sender_id))];
        const unknownIds = senderIds.filter(id => !profilesRef.current[id]);
        if (unknownIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", unknownIds);
          if (profiles) {
            setSenderProfiles(prev => {
              const next = { ...prev };
              profiles.forEach(p => { next[p.user_id] = { name: p.full_name, avatar_url: p.avatar_url }; });
              return next;
            });
          }
        }
      }
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    };

    fetchMessages();

    // Realtime
    const channel = supabase
      .channel(`community:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          const wasNearBottom = isNearBottom();
          setMessages(prev => {
            const filtered = prev.filter(m => !(m._optimistic && m.sender_id === newMsg.sender_id && m.text === newMsg.text));
            if (filtered.some(m => m.id === newMsg.id)) return filtered;
            return [...filtered, newMsg];
          });
          if (!profilesRef.current[newMsg.sender_id]) {
            const { data: profile } = await supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", newMsg.sender_id).single();
            if (profile) setSenderProfiles(prev => ({ ...prev, [profile.user_id]: { name: profile.full_name, avatar_url: profile.avatar_url } }));
          }
          if (wasNearBottom) setTimeout(() => scrollToBottom(), 50);
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    if (isNearBottom()) scrollToBottom();
  }, [messages, scrollToBottom, isNearBottom]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending || !conversationId) return;
    const msgText = text.trim();
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      text: msgText,
      message_type: "text",
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: msgText,
      message_type: "text",
    });
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setText(msgText);
      toast.error("Не удалось отправить");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (msgId.startsWith("optimistic")) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId);
    if (error) toast.error("Не удалось удалить");
    else setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !conversationId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Файл слишком большой (макс 10МБ)"); return; }
    setUploading(true);
    setShowAttach(false);
    const ext = file.name.split(".").pop();
    const path = `${conversationId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("chat-media").upload(path, file);
    if (uploadErr) { toast.error("Ошибка загрузки"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    const isImage = file.type.startsWith("image/");
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: file.name,
      media_url: urlData.publicUrl,
      message_type: isImage ? "image" : "file",
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="app-shell">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="flex items-center gap-3 px-3 safe-top pb-3 border-b border-border/50">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center text-foreground active:bg-muted/50 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Users size={20} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">Сообщество диспетчеров</h2>
          <p className="text-[11px] text-muted-foreground">{membersCount} участников</p>
        </div>
        {canModerate && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10">
            <Shield size={12} className="text-primary" />
            <span className="text-[10px] font-bold text-primary">Модератор</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-hide">
        {/* Community info card */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3">
            <Users size={28} className="text-primary-foreground" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">Сообщество диспетчеров</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Общий чат для всех диспетчеров. Обсуждайте рабочие вопросы, делитесь советами и помогайте друг другу.
          </p>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Shield size={10} className="text-primary" /> Модерация: Gruzli Official
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Напишите первое сообщение!</div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user?.id;
            const isSystem = msg.message_type === "system";
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const showDateSep = !prev || !isSameDay(prev.created_at, msg.created_at);
            const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameGroup(prev, msg) || isSystem;
            const isLastInGroup = !next || next.sender_id !== msg.sender_id || !isSameGroup(msg, next) || next?.message_type === "system";

            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">{formatDateSeparator(msg.created_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-center my-2">
                    <span className="text-[11px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">
                      {senderProfiles[msg.sender_id]?.name || "Пользователь"} {msg.text}
                    </span>
                  </div>
                </div>
              );
            }

            const profile = senderProfiles[msg.sender_id];
            const senderName = profile?.name || "Диспетчер";
            const isMsgAdmin = msg.sender_id === ADMIN_USER_ID;

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full font-medium">{formatDateSeparator(msg.created_at)}</span>
                  </div>
                )}
                <GroupMessageBubble
                  msg={msg}
                  isOwn={isOwn}
                  showSender={isFirstInGroup}
                  senderName={senderName}
                  isLastInGroup={isLastInGroup}
                  avatarUrl={profile?.avatar_url}
                  onOpenProfile={onOpenProfile}
                  isAdmin={isMsgAdmin}
                  canModerate={canModerate}
                  onDelete={() => handleDeleteMessage(msg.id)}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attach popup */}
      <AnimatePresence>
        {showAttach && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-20 left-3 right-3 bg-card rounded-2xl p-4 z-50 border border-border shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Прикрепить</span>
              <button onClick={() => setShowAttach(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center"><Image size={20} className="text-primary" /></div>
                <span className="text-[11px] text-muted-foreground">Фото</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-3 pt-2 pb-3 border-t border-border/30">
        {uploading && <div className="text-center text-xs text-primary mb-2 animate-pulse">Загрузка...</div>}
        <div className="flex items-end gap-2">
          <button onClick={() => setShowAttach(!showAttach)} className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0 mb-0.5">
            <Paperclip size={20} />
          </button>
          <div className="flex-1 flex items-end bg-muted/40 rounded-3xl px-4 py-2 border border-border/40">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-5 max-h-[120px]"
              style={{ height: "20px" }}
            />
          </div>
          <motion.button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            whileTap={{ scale: 0.85 }}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0 mb-0.5"
          >
            <Send size={18} className="text-primary-foreground ml-0.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default DispatcherCommunityScreen;
