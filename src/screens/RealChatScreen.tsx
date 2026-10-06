import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { ArrowLeft, Send, Paperclip, Phone, X, Image, Video, Mic, MicOff, MapPin, Users, Wallet, CheckCheck, Clock3, MoreVertical, Trash2, Ban, BellOff, Smile, Reply as ReplyIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { playMessageSent } from "@/lib/sounds";
import { formatLastSeen } from "@/hooks/usePresence";
import type { Tables } from "@/integrations/supabase/types";
import EmojiPicker from "@/components/chat/EmojiPicker";
import VoiceRecorder from "@/components/chat/VoiceRecorder";
import VoiceMessagePlayer from "@/components/chat/VoiceMessagePlayer";
import SwipeableMessage from "@/components/chat/SwipeableMessage";
import CallModal, { type CallMode } from "@/components/chat/CallModal";
import { setActiveConversationId } from "@/lib/chatPresence";
import ChatSkeleton from "@/components/skeletons/ChatSkeleton";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  media_url?: string | null;
  message_type: string | null;
  created_at: string;
  reply_to_id?: string | null;
  _optimistic?: boolean;
  _status?: "sending" | "failed";
}

interface ReplyPreview {
  id: string;
  senderName: string;
  text: string;
}

const DeliveryStatusIcon = ({ msg }: { msg: Message }) => {
  if (msg._status === "sending" || msg._optimistic) {
    return <Clock3 size={12} className="text-muted-foreground animate-pulse" />;
  }

  return <CheckCheck size={12} className="text-primary" />;
};

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

const avatarColors = [
  "#191a1d",
  "#2b2c30",
  "#37383d",
  "#44454a",
  "#52535a",
  "#606168",
  "#6d6e75",
  "#797a80",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const MessageBubble = memo(({ msg, isOwn, showSender, senderName, isLastInGroup, renderMedia, replyPreview, onReplyClick }: {
  msg: Message;
  isOwn: boolean;
  showSender: boolean;
  senderName: string;
  isLastInGroup: boolean;
  renderMedia: (msg: Message) => React.ReactNode;
  replyPreview?: ReplyPreview | null;
  onReplyClick?: (id: string) => void;
}) => {
  const time = new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // Sticker message — render large without bubble
  if (msg.message_type === "sticker") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-2" : "mb-0.5"}`}>
        <div className="max-w-[78%]">
          <div className="text-5xl py-1 px-1">{msg.text}</div>
          <div className={`flex items-center gap-1.5 ${isOwn ? "justify-end" : "justify-start"} px-1`}>
            <span className="text-[11px] text-muted-foreground">{time}</span>
            {isOwn && (
              <DeliveryStatusIcon msg={msg} />
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
          <p className="text-[12px] font-semibold mb-1 ml-3 text-primary">
            {senderName}
          </p>
        )}
        <div className={`relative px-3 py-2 ${
          isOwn
            ? `bubble-own ${isLastInGroup ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl"}`
            : `bubble-other ${isLastInGroup ? "rounded-2xl rounded-bl-[4px]" : "rounded-2xl"}`
        }`}>
          {replyPreview && (
            <button
              onClick={() => onReplyClick?.(replyPreview.id)}
              className="w-full text-left mb-1.5 pl-2 pr-2 py-1 rounded-md bg-foreground/5 border-l-[3px] border-primary block"
            >
              <p className="text-[12px] font-semibold text-primary truncate">{replyPreview.senderName}</p>
              <p className="text-[12px] text-muted-foreground truncate">{replyPreview.text}</p>
            </button>
          )}
          {renderMedia(msg)}
          <div className={`flex items-end gap-1.5 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[11px] text-muted-foreground/70 leading-none">{time}</span>
            {isOwn && (
              <DeliveryStatusIcon msg={msg} />
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
  const isDemo = user?.id?.startsWith("demo-") === true;
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
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [activeCall, setActiveCall] = useState<CallMode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const senderNamesRef = useRef(senderNames);
  const sendLockRef = useRef(false);
  senderNamesRef.current = senderNames;
  const menuRef = useRef<HTMLDivElement>(null);

;

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
  }, []);

  const replaceOptimisticMessage = useCallback((optimisticId: string, nextMessage?: Message) => {
    setMessages((prev) => {
      const filtered = prev.filter((item) => item.id !== optimisticId);

      if (!nextMessage || filtered.some((item) => item.id === nextMessage.id)) {
        return filtered;
      }

      return [...filtered, nextMessage];
    });
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId]);

  const [resolvedTitle, setResolvedTitle] = useState(title);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !conversationId || isDemo) return;
    const fetchOther = async () => {
      const { data: parts } = await supabase
        .from("conversation_participants").select("user_id")
        .eq("conversation_id", conversationId).neq("user_id", user.id).limit(1);
      const otherId = parts?.[0]?.user_id;
      if (otherId) {
        setOtherUserId(otherId);
        const { data: profileRaw } = await supabase.from("profiles_public" as any).select("full_name, last_seen_at, avatar_url").eq("user_id", otherId).single();
        const profile = profileRaw as any;
        if (profile) {
          setOtherLastSeen(profile.last_seen_at);
          if (profile.full_name) setResolvedTitle(profile.full_name);
          setOtherAvatarUrl(profile.avatar_url || null);
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

  // Build the reply lookup once per message update instead of scanning the full history
  // for every bubble during render (avoids quadratic work in long conversations).
  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "instant" });
      }
    });
  }, []);

  // iOS Safari can resize the visual viewport independently when its keyboard opens.
  // Keep the chat shell tied to that visible area and re-anchor messages after resize.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const shell = scrollRef.current?.closest(".gruzli-chat-detail") as HTMLElement | null;
    if (!shell) return;

    const updateViewport = () => {
      shell.style.setProperty("--chat-visual-height", `${Math.round(viewport.height)}px`);
      requestAnimationFrame(() => {
        if (document.activeElement === textareaRef.current) scrollToBottom(false);
      });
    };

    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      viewport.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      shell.style.removeProperty("--chat-visual-height");
    };
  }, [scrollToBottom])

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

  const fetchMessages = useCallback(async () => {
    if (isDemo) {
      const now = new Date();
      const otherId = conversationId.includes("dispatcher") ? "demo-dispatcher" : conversationId.includes("worker") ? "demo-worker" : "demo-official";
      const otherName = conversationId.includes("dispatcher") ? "Анна Петрова" : conversationId.includes("worker") ? "Алексей Морозов" : "Gruzli Official";
      const currentUserId = user?.id || "demo";

      setOtherUserId(otherId);
      setResolvedTitle(otherName);
      setSenderNames({ [otherId]: otherName, [currentUserId]: profileNameForDemo(currentUserId) });

      const { data: storedMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (storedMessages && storedMessages.length > 0) {
        setMessages(storedMessages as Message[]);
      } else {
        const seedMessages: Message[] = [
          { id: `demo-msg-${conversationId}-1`, conversation_id: conversationId, sender_id: otherId, text: "Привет! Хотел уточнить детали заказа.", message_type: "text", created_at: new Date(now.getTime() - 18 * 60000).toISOString() },
          { id: `demo-msg-${conversationId}-2`, conversation_id: conversationId, sender_id: currentUserId, text: "Да, конечно. Заказ подтверждён, всё готово.", message_type: "text", created_at: new Date(now.getTime() - 16 * 60000).toISOString() },
          { id: `demo-msg-${conversationId}-3`, conversation_id: conversationId, sender_id: otherId, text: "Отлично. Тогда остаёмся на связи.", message_type: "text", created_at: new Date(now.getTime() - 14 * 60000).toISOString() },
        ];

        for (const message of seedMessages) {
          await supabase.from("messages").insert(message);
        }
        setMessages(seedMessages);
      }

      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
      return;
    }

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
          if (newMsg.sender_id === user?.id) return;
          const wasNearBottom = isNearBottom();
          appendMessage(newMsg);
          if (!senderNamesRef.current[newMsg.sender_id]) {
            const { data: profileRaw } = await supabase.from("profiles_public" as any).select("user_id, full_name").eq("user_id", newMsg.sender_id).single();
            const profile = profileRaw as any;
            if (profile) setSenderNames((prev) => ({ ...prev, [profile.user_id]: profile.full_name }));
          }
          if (newMsg.sender_id !== user?.id) markAsRead();
          if (wasNearBottom) setTimeout(() => scrollToBottom(), 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, fetchMessages, markAsRead, user?.id, isNearBottom, scrollToBottom, appendMessage]);

  useEffect(() => { if (isNearBottom()) scrollToBottom(); }, [messages, scrollToBottom, isNearBottom]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.close();
    };
  }, []);

  const handleReplyToMessage = useCallback((m: Message) => {
    let preview = "Сообщение";
    if (m.message_type === "voice") preview = "🎤 Голосовое сообщение";
    else if (m.message_type === "image") preview = "📷 Фото";
    else if (m.message_type === "video") preview = "📹 Видео";
    else if (m.message_type === "sticker") preview = m.text || "Стикер";
    else preview = m.text || "Медиа";
    const senderName = m.sender_id === user?.id ? "Вы" : (senderNamesRef.current[m.sender_id] || resolvedTitle);
    setReplyTo({ id: m.id, senderName, text: preview });
    textareaRef.current?.focus();
  }, [user?.id, resolvedTitle]);

  const scrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/60", "rounded-2xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/60", "rounded-2xl"), 1500);
    }
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user || sendLockRef.current) return;
    if (isDemo) {
      const msgText = text.trim();
      setText("");
      const demoMsg: Message = {
        id: `demo-local-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user.id,
        text: msgText,
        message_type: "text",
        created_at: new Date().toISOString(),
      };
      appendMessage(demoMsg);
      setTimeout(() => scrollToBottom(), 30);
      return;
    }
    const msgText = text.trim();
    const replyId = replyTo?.id ?? null;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;

    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setShowEmoji(false);
    setReplyTo(null);

    playMessageSent();

    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      text: msgText,
      message_type: "text",
      created_at: new Date().toISOString(),
      reply_to_id: replyId,
      _optimistic: true,
      _status: "sending",
    };
    appendMessage(optimisticMsg);
    scrollToBottom(false);

    sendLockRef.current = true;
    setSending(true);

    try {
      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: msgText,
          message_type: "text",
          reply_to_id: replyId,
        })
        .select("*")
        .single();

      if (error || !insertedMessage) {
        throw error || new Error("insert_failed");
      }

      replaceOptimisticMessage(optimisticId, insertedMessage as Message);
      scrollToBottom(false);

      supabase.functions.invoke("notify-email", {
        body: { type: "new_message", conversation_id: conversationId, sender_id: user.id, text: msgText },
      }).catch(() => {});
    } catch {
      replaceOptimisticMessage(optimisticId);
      setText(msgText);
      toast.error("Не удалось отправить");
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };




  const handleSendVoice = async (blob: Blob, duration: number) => {
    if (!user) return;
    setIsRecording(false);
    
    const path = `voice/${conversationId}/${Date.now()}_voice.webm`;
    const { error: uploadError } = await supabase.storage.from("kartoteka-photos").upload(path, blob, { contentType: "audio/webm" });
    if (uploadError) { toast.error("Ошибка загрузки"); return; }
    const { data: urlData } = supabase.storage.from("kartoteka-photos").getPublicUrl(path);
    
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
    if (!window.confirm("Диалог будет удалён у всех участников. Продолжить?")) return;
    setShowMenu(false);
    const { data: mediaUrls, error } = await supabase.rpc('delete_conversation_fully', { _conversation_id: conversationId });
    if (error) { toast.error("Ошибка удаления"); return; }
    if (mediaUrls?.length) {
      const paths = (mediaUrls as string[]).map(u => {
        try { const url = new URL(u); const parts = url.pathname.split('/object/public/chat-media/'); return parts[1] || parts[0]; } catch { return u; }
      }).filter(Boolean);
      if (paths.length) await supabase.storage.from('chat-media').remove(paths);
    }
    toast.success("Диалог полностью удалён");
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
          <span className="text-[15px]">{msg.text}</span>
        </div>
      );
    }
    return <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>;
  };

  const startCall = async (callMode: CallMode) => {
    if (!user || !otherUserId) {
      toast.error("Не удалось определить собеседника");
      return;
    }
    // Get caller's display name
    const { data: selfProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();
    const fromName = selfProfile?.full_name || "Пользователь";

    // Notify the other user via their personal channel
    const ch = supabase.channel(`user-calls:${otherUserId}`);
    await new Promise<void>((resolve) => {
      ch.subscribe((s) => { if (s === "SUBSCRIBED") resolve(); });
    });
    await ch.send({
      type: "broadcast",
      event: "ring",
      payload: { conversationId, fromUserId: user.id, fromName, mode: callMode },
    });
    supabase.removeChannel(ch);
    setActiveCall(callMode);
  };

  const initials = resolvedTitle.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="gruzli-chat-detail app-shell">
      <audio ref={remoteAudioRef} autoPlay />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="relative z-40 flex items-center gap-2 px-3 safe-top pb-2.5 border-b border-border bg-background">
        <button onClick={onBack} className="w-10 h-10 rounded-[14px] flex items-center justify-center text-foreground bg-card border border-border active:bg-muted transition-colors">
          <ArrowLeft size={20} />
        </button>

        <button
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left py-1"
          onClick={() => otherUserId && onOpenProfile?.(otherUserId)}
        >
          {otherAvatarUrl ? (
            <div className="w-9 h-9 rounded-full shrink-0 relative overflow-hidden">
              <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
              {presenceInfo.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 relative"
              style={{ background: getAvatarColor(resolvedTitle) }}
            >
              {initials}
              {presenceInfo.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate leading-tight">{resolvedTitle}</h2>
            <p className={`text-[11px] leading-tight ${presenceInfo.isOnline ? "text-green-500" : "text-muted-foreground"}`}>
              {presenceInfo.text}
            </p>
          </div>
        </button>

        <div className="flex gap-0.5">
          <button
            onClick={() => startCall("audio")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors"
            aria-label="Аудиозвонок"
          >
            <Phone size={18} />
          </button>
          <button
            onClick={() => startCall("video")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors"
            aria-label="Видеозвонок"
          >
            <Video size={18} />
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors">
              <MoreVertical size={18} />
            </button>
            {showMenu && (
                <div className="absolute right-0 top-11 w-52 bg-card border border-border rounded-2xl shadow-md z-50 overflow-hidden">
                  <button onClick={handleMuteNotifications} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors">
                    <BellOff size={16} className="text-muted-foreground" /> Без звука
                  </button>
                  <button onClick={handleBlockUser} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors">
                    <Ban size={16} className="text-muted-foreground" /> Чёрный список
                  </button>
                  <button onClick={handleDeleteConversation} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={16} /> Удалить диалог
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Active call modal */}
      {activeCall && user && otherUserId && (
          <CallModal
            conversationId={conversationId}
            selfUserId={user.id}
            peerName={resolvedTitle}
            mode={activeCall}
            role="caller"
            onClose={() => setActiveCall(null)}
          />
        )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 scrollbar-hide bg-transparent">
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
          <ChatSkeleton />
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
                      <span className="text-[12px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">{formatDateSeparator(msg.created_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-center my-2">
                    <span className="text-[12px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">{msg.text}</span>
                  </div>
                </div>
              );
            }

            // Build reply preview if this message replies to another one
            let replyPreview: ReplyPreview | null = null;
            if (msg.reply_to_id) {
              const original = messageById.get(msg.reply_to_id);
              if (original) {
                let txt = "Сообщение";
                if (original.message_type === "voice") txt = "🎤 Голосовое сообщение";
                else if (original.message_type === "image") txt = "📷 Фото";
                else if (original.message_type === "video") txt = "📹 Видео";
                else if (original.message_type === "sticker") txt = original.text || "Стикер";
                else txt = original.text || "Медиа";
                const sName = original.sender_id === user?.id ? "Вы" : (senderNames[original.sender_id] || "...");
                replyPreview = { id: original.id, senderName: sName, text: txt };
              }
            }

            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {showDateSep && (
                  <div className="flex justify-center my-3">
                    <span className="text-[12px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full font-medium">{formatDateSeparator(msg.created_at)}</span>
                  </div>
                )}
                <SwipeableMessage onReply={() => handleReplyToMessage(msg)}>
                  <MessageBubble
                    msg={msg}
                    isOwn={isOwn}
                    showSender={isFirstInGroup}
                    senderName={senderNames[msg.sender_id] || "..."}
                    isLastInGroup={isLastInGroup}
                    renderMedia={renderMediaMessage}
                    replyPreview={replyPreview}
                    onReplyClick={scrollToMessage}
                  />
                </SwipeableMessage>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emoji / Sticker picker */}
      {showEmoji && (
          <div className="px-3 pb-1">
            <EmojiPicker onSelect={handleEmojiSelect} />
          </div>
        )}

      {/* Attach popup */}
      {showAttach && (
          <div className="absolute bottom-20 left-3 right-3 bg-card rounded-2xl p-4 z-50 border border-border shadow-md">
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
          </div>
        )}

      {/* Input area */}
      <div className="px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-border bg-background">
        {uploading && <div className="text-center text-xs text-primary mb-2 animate-pulse">Загрузка файла...</div>}

        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-muted/40 border-l-[3px] border-primary">
            <ReplyIcon size={16} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-primary truncate">Ответ {replyTo.senderName}</p>
              <p className="text-[12px] text-muted-foreground truncate">{replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50">
              <X size={14} />
            </button>
          </div>
        )}
        
        {isRecording ? (
          <VoiceRecorder
            onSend={handleSendVoice}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-1.5">
              <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }} className="native-press w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0 mb-0.5">
                <Paperclip size={20} />
              </button>

              <div className="flex-1 flex items-end bg-card rounded-[18px] px-3 py-2 border border-border gap-1">
                <button
                  onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
                  className="native-press w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted/50 transition-colors shrink-0"
                >
                  <Smile size={20} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { setShowEmoji(false); }}
                  placeholder="Сообщение..."
                  rows={1}
                  className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-5 max-h-[120px] py-1"
                  style={{ height: "22px" }}
                />
              </div>

              {text.trim() ? (
                <button onClick={handleSend}
                  disabled={sending}
                  className="native-press w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0 mb-0.5"
                >
                  <Send size={18} className="text-primary-foreground ml-0.5" />
                </button>
              ) : (
                <button onClick={() => setIsRecording(true)}
                  className="native-press w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 mb-0.5"
                >
                  <Mic size={18} className="text-primary-foreground" />
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RealChatScreen;
const profileNameForDemo = (id?: string) => id?.includes("client") ? "Сергей Волков" : id?.includes("dispatcher") ? "Анна Петрова" : id?.includes("worker") ? "Алексей Морозов" : "Сергей";
