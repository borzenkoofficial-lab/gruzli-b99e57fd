import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Paperclip, Phone, X, Image, Video, Mic, MicOff, MapPin, Users, Wallet, Check, CheckCheck, MoreVertical, Trash2, Ban, BellOff, Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { playMessageSent } from "@/lib/sounds";
import { formatLastSeen } from "@/hooks/usePresence";
import type { Tables } from "@/integrations/supabase/types";
import EmojiPicker from "@/components/chat/EmojiPicker";
import VoiceRecorder from "@/components/chat/VoiceRecorder";
import VoiceMessagePlayer from "@/components/chat/VoiceMessagePlayer";

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

interface RealChatScreenProps {
  conversationId: string;
  title: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  onMessagesRead?: () => void;
}

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

const avatarGradients = [
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
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

const MessageBubble = memo(({ msg, isOwn, showSender, senderName, isLastInGroup, renderMedia }: {
  msg: Message;
  isOwn: boolean;
  showSender: boolean;
  senderName: string;
  isLastInGroup: boolean;
  renderMedia: (msg: Message) => React.ReactNode;
}) => {
  const time = new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // Sticker message — render large without bubble
  if (msg.message_type === "sticker") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-2" : "mb-0.5"}`}>
        <div className="max-w-[78%]">
          <div className="text-5xl py-1 px-1">{msg.text}</div>
          <div className={`flex items-center gap-1.5 ${isOwn ? "justify-end" : "justify-start"} px-1`}>
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {isOwn && (
              msg._optimistic
                ? <Check size={12} className="text-muted-foreground" />
                : <CheckCheck size={12} className="text-primary" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-2" : "mb-0.5"} ${msg._optimistic ? "opacity-60" : ""}`}>
      <div className={`max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}>
        {showSender && !isOwn && (
          <p className="text-[11px] font-semibold mb-1 ml-3 opacity-80" style={{ color: getAvatarColor(senderName).includes("#6366f1") ? "#818cf8" : "#8b5cf6" }}>
            {senderName}
          </p>
        )}
        <div className={`relative px-3 py-[7px] ${
          isOwn
            ? `bubble-own ${isLastInGroup ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl"}`
            : `bubble-other ${isLastInGroup ? "rounded-2xl rounded-bl-[4px]" : "rounded-2xl"}`
        }`}>
          {renderMedia(msg)}
          <div className={`flex items-end gap-1.5 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground/70 leading-none">{time}</span>
            {isOwn && (
              msg._optimistic
                ? <Check size={12} className="text-muted-foreground" />
                : <CheckCheck size={12} className="text-primary" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

const RealChatScreen = ({ conversationId, title, onBack, onOpenProfile, onMessagesRead }: RealChatScreenProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [linkedJob, setLinkedJob] = useState<Tables<"jobs"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [voiceRoomId, setVoiceRoomId] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const senderNamesRef = useRef(senderNames);
  senderNamesRef.current = senderNames;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const [resolvedTitle, setResolvedTitle] = useState(title);

  useEffect(() => {
    if (!user || !conversationId) return;
    const fetchOther = async () => {
      const { data: parts } = await supabase
        .from("conversation_participants").select("user_id")
        .eq("conversation_id", conversationId).neq("user_id", user.id).limit(1);
      const otherId = parts?.[0]?.user_id;
      if (otherId) {
        setOtherUserId(otherId);
        const { data: profile } = await supabase.from("profiles").select("full_name, last_seen_at").eq("user_id", otherId).single();
        if (profile) {
          setOtherLastSeen((profile as any).last_seen_at);
          if (profile.full_name) setResolvedTitle(profile.full_name);
        }
      }
    };
    fetchOther();

    const channel = supabase
      .channel(`presence-${conversationId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const updated = payload.new as any;
        if (updated.user_id === otherUserId) setOtherLastSeen(updated.last_seen_at);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, conversationId, otherUserId]);

  const presenceInfo = formatLastSeen(otherLastSeen);

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

  const fetchMessages = async () => {
    const [convRes, msgsRes] = await Promise.all([
      supabase.from("conversations").select("job_id").eq("id", conversationId).single(),
      supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    ]);

    if (convRes.data?.job_id) {
      const { data: jobData } = await supabase.from("jobs").select("*").eq("id", convRes.data.job_id).single();
      if (jobData) setLinkedJob(jobData);
    }

    if (msgsRes.data) {
      setMessages(msgsRes.data as Message[]);
      const senderIds = [...new Set(msgsRes.data.map((m) => m.sender_id))];
      const unknownIds = senderIds.filter((id) => !senderNamesRef.current[id]);
      if (unknownIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", unknownIds);
        if (profiles) {
          setSenderNames((prev) => {
            const next = { ...prev };
            profiles.forEach((p) => (next[p.user_id] = p.full_name));
            return next;
          });
        }
      }
    }
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 50);
  };

  const markAsRead = useCallback(async () => {
    if (!user || !conversationId) return;
    await supabase.from("conversation_participants").update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).eq("user_id", user.id);
    onMessagesRead?.();
  }, [user, conversationId, onMessagesRead]);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          const wasNearBottom = isNearBottom();
          setMessages((prev) => {
            const withoutOptimistic = prev.filter(
              (m) => !(m._optimistic && m.sender_id === newMsg.sender_id && m.text === newMsg.text)
            );
            if (withoutOptimistic.some((m) => m.id === newMsg.id)) return withoutOptimistic;
            return [...withoutOptimistic, newMsg];
          });
          if (!senderNamesRef.current[newMsg.sender_id]) {
            const { data: profile } = await supabase.from("profiles").select("user_id, full_name").eq("user_id", newMsg.sender_id).single();
            if (profile) setSenderNames((prev) => ({ ...prev, [profile.user_id]: profile.full_name }));
          }
          if (newMsg.sender_id !== user?.id) markAsRead();
          if (wasNearBottom) setTimeout(() => scrollToBottom(), 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, markAsRead]);

  useEffect(() => { if (isNearBottom()) scrollToBottom(); }, [messages, scrollToBottom, isNearBottom]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.close();
    };
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const msgText = text.trim();
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setShowEmoji(false);

    playMessageSent();

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      text: msgText,
      message_type: "text",
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: user.id, text: msgText, message_type: "text",
    });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setText(msgText);
      toast.error("Не удалось отправить");
    } else {
      supabase.functions.invoke("notify-email", {
        body: { type: "new_message", conversation_id: conversationId, sender_id: user.id, text: msgText },
      }).catch(() => {});
    }
    setSending(false);
  };

  const handleSendSticker = async (sticker: string) => {
    if (!user) return;
    setShowStickers(false);
    playMessageSent();

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      text: sticker,
      message_type: "sticker",
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: user.id, text: sticker, message_type: "sticker",
    });
  };

  const handleSendVoice = async (blob: Blob, duration: number) => {
    if (!user) return;
    setIsRecording(false);
    
    const ext = "webm";
    const path = `${conversationId}/${Date.now()}_voice.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "audio/webm" });
    if (uploadError) { toast.error("Ошибка загрузки"); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    
    playMessageSent();

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: `voice:${duration}`,
      media_url: urlData.publicUrl,
      message_type: "voice",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Макс 10МБ"); return; }

    setUploading(true);
    setShowAttach(false);
    const ext = file.name.split(".").pop();
    const path = `${conversationId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, file);
    if (uploadError) { toast.error("Ошибка загрузки"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const msgType = isVideo ? "video" : isImage ? "image" : "file";
    await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: user.id, text: file.name, media_url: urlData.publicUrl, message_type: msgType,
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startVoiceRoom = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setInVoiceRoom(true);
      setVoiceActive(true);
      const { data: room } = await supabase.from("voice_rooms").insert({ conversation_id: conversationId, created_by: user.id }).select().single();
      if (room) {
        setVoiceRoomId(room.id);
        await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, text: "📞 Начал голосовой звонок", message_type: "voice_room" });
      }
      toast.success("Голосовая комната создана");
    } catch { toast.error("Нет доступа к микрофону"); }
  };

  const joinVoiceRoom = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setInVoiceRoom(true);
      setVoiceActive(true);
      toast.success("Вы в голосовой комнате");
      await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, text: "📞 Присоединился к звонку", message_type: "system" });
    } catch { toast.error("Нет доступа к микрофону"); }
  };

  const leaveVoiceRoom = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setInVoiceRoom(false);
    setVoiceActive(false);
    setPeerConnected(false);
    toast.info("Вы покинули звонок");
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) { track.enabled = !track.enabled; setVoiceActive(track.enabled); }
    }
  };

  const handleDeleteConversation = async () => {
    if (!user) return;
    setShowMenu(false);
    await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
    toast.success("Диалог удалён");
    onBack();
  };

  const handleBlockUser = async () => {
    if (!user || !otherUserId) return;
    setShowMenu(false);
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
    if (error?.code === "23505") toast.info("Уже в чёрном списке");
    else if (error) toast.error("Ошибка");
    else toast.success(`${resolvedTitle} добавлен в чёрный список`);
  };

  const handleMuteNotifications = () => { setShowMenu(false); toast.success("Уведомления отключены"); };

  const hasActiveVoiceRoom = messages.some((m) => m.message_type === "voice_room" && m.sender_id !== user?.id);

  const renderMediaMessage = (msg: Message) => {
    if (msg.message_type === "voice" && msg.media_url) {
      const durationMatch = msg.text?.match(/^voice:(\d+)$/);
      const dur = durationMatch ? parseInt(durationMatch[1]) : 0;
      return <VoiceMessagePlayer url={msg.media_url} duration={dur} isOwn={msg.sender_id === user?.id} />;
    }
    if (msg.message_type === "image" && msg.media_url) {
      return <img src={msg.media_url} alt="Фото" className="max-w-full rounded-xl max-h-60 object-cover cursor-pointer" onClick={() => window.open(msg.media_url!, "_blank")} />;
    }
    if (msg.message_type === "video" && msg.media_url) {
      return <video src={msg.media_url} controls className="max-w-full rounded-xl max-h-60" />;
    }
    if (msg.message_type === "voice_room") {
      return (
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          <span className="text-sm">{msg.text}</span>
          {!inVoiceRoom && msg.sender_id !== user?.id && (
            <button onClick={joinVoiceRoom} className="ml-2 px-3 py-1 rounded-lg bg-foreground text-primary-foreground text-xs font-semibold">Войти</button>
          )}
        </div>
      );
    }
    return <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>;
  };

  const initials = resolvedTitle.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <audio ref={remoteAudioRef} autoPlay />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="flex items-center gap-2 px-2 safe-top pb-2.5 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center text-foreground active:bg-muted/50 transition-colors">
          <ArrowLeft size={20} />
        </button>

        <button
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left py-1"
          onClick={() => otherUserId && onOpenProfile?.(otherUserId)}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 relative"
            style={{ background: getAvatarColor(resolvedTitle) }}
          >
            {initials}
            {presenceInfo.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate leading-tight">{resolvedTitle}</h2>
            <p className={`text-[11px] leading-tight ${presenceInfo.isOnline ? "text-green-500" : "text-muted-foreground"}`}>
              {presenceInfo.text}
            </p>
          </div>
        </button>

        <div className="flex gap-0.5">
          {inVoiceRoom ? (
            <>
              <button onClick={toggleMic} className={`w-9 h-9 rounded-full flex items-center justify-center ${voiceActive ? "bg-primary/20 text-primary" : "text-destructive"}`}>
                {voiceActive ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button onClick={leaveVoiceRoom} className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center">
                <Phone size={18} className="text-destructive" />
              </button>
            </>
          ) : (
            <button onClick={hasActiveVoiceRoom ? joinVoiceRoom : startVoiceRoom} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors">
              <Phone size={18} />
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors">
              <MoreVertical size={18} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 w-52 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden"
                >
                  <button onClick={handleMuteNotifications} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors">
                    <BellOff size={16} className="text-muted-foreground" /> Без звука
                  </button>
                  <button onClick={handleBlockUser} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors">
                    <Ban size={16} className="text-muted-foreground" /> Чёрный список
                  </button>
                  <button onClick={handleDeleteConversation} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={16} /> Удалить диалог
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Voice room banner */}
      <AnimatePresence>
        {inVoiceRoom && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(145 65% 40%), hsl(160 60% 45%))" }}>
            <div className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-semibold flex-1">Голосовой звонок {voiceActive ? "· Микрофон вкл" : "· Микрофон выкл"}</span>
              <button onClick={leaveVoiceRoom} className="text-white/80 text-xs font-medium">Завершить</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-hide">
        {linkedJob && (
          <div className="bubble-other rounded-2xl p-3 mb-3">
            <p className="text-[11px] text-muted-foreground mb-1">Заказ</p>
            <p className="text-sm font-bold text-foreground">{linkedJob.title}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
              {linkedJob.address && <span className="flex items-center gap-1"><MapPin size={10} /> {linkedJob.address}</span>}
              <span className="flex items-center gap-1"><Users size={10} /> {linkedJob.workers_needed || 1} чел.</span>
              <span className="flex items-center gap-1"><Wallet size={10} /> {linkedJob.hourly_rate} ₽/ч</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Начните диалог — напишите сообщение</div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user?.id;
            const isSystem = msg.message_type === "system";
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const showDateSep = !prev || !isSameDay(prev.created_at, msg.created_at);
            const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameGroup(prev, msg) || isSystem;
            const isLastInGroup = !next || next.sender_id !== msg.sender_id || !isSameGroup(msg, next) || next.message_type === "system";

            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">{formatDateSeparator(msg.created_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-center my-2">
                    <span className="text-[11px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full font-medium">{formatDateSeparator(msg.created_at)}</span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  isOwn={isOwn}
                  showSender={isFirstInGroup}
                  senderName={senderNames[msg.sender_id] || "..."}
                  isLastInGroup={isLastInGroup}
                  renderMedia={renderMediaMessage}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emoji / Sticker picker */}
      <AnimatePresence>
        {showEmoji && (
          <div className="px-3 pb-1">
            <EmojiPicker onSelect={handleEmojiSelect} />
          </div>
        )}
        {showStickers && (
          <div className="px-3 pb-1">
            <StickerPicker onSelect={handleSendSticker} />
          </div>
        )}
      </AnimatePresence>

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
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "video/*"; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center"><Video size={20} className="text-primary" /></div>
                <span className="text-[11px] text-muted-foreground">Видео</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-3 pt-2 pb-3 border-t border-border/20">
        {uploading && <div className="text-center text-xs text-primary mb-2 animate-pulse">Загрузка файла...</div>}
        
        <AnimatePresence mode="wait">
          {isRecording ? (
            <VoiceRecorder
              key="recorder"
              onSend={handleSendVoice}
              onCancel={() => setIsRecording(false)}
            />
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-1.5"
            >
              <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); setShowStickers(false); }} className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0 mb-0.5">
                <Paperclip size={20} />
              </button>

              <div className="flex-1 flex items-end bg-muted/40 rounded-3xl px-3 py-2 border border-border/30 gap-1">
                <button
                  onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); setShowAttach(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0"
                >
                  <Smile size={20} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { setShowEmoji(false); setShowStickers(false); }}
                  placeholder="Сообщение..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-5 max-h-[120px] py-1"
                  style={{ height: "20px" }}
                />
                <button
                  onClick={() => { setShowStickers(!showStickers); setShowEmoji(false); setShowAttach(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0"
                >
                  <Sticker size={18} />
                </button>
              </div>

              {text.trim() ? (
                <motion.button
                  onClick={handleSend}
                  disabled={sending}
                  whileTap={{ scale: 0.85 }}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0 mb-0.5"
                >
                  <Send size={18} className="text-primary-foreground ml-0.5" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => setIsRecording(true)}
                  whileTap={{ scale: 0.85 }}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 mb-0.5"
                >
                  <Mic size={18} className="text-primary-foreground" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RealChatScreen;
