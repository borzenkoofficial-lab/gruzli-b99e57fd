import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Paperclip, Phone, X, Image, Video, Mic, MicOff, MapPin, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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
}

const RealChatScreen = ({ conversationId, title, onBack }: RealChatScreenProps) => {
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const senderNamesRef = useRef(senderNames);
  senderNamesRef.current = senderNames;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

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
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Replace optimistic message or skip duplicate
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
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.close();
    };
  }, []);

  // Optimistic send
  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const msgText = text.trim();
    setText("");
    
    // Add optimistic message immediately
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
      conversation_id: conversationId,
      sender_id: user.id,
      text: msgText,
      message_type: "text",
    });
    if (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setText(msgText);
      toast.error("Не удалось отправить");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Файл слишком большой (макс 10МБ)"); return; }

    setUploading(true);
    setShowAttach(false);
    const ext = file.name.split(".").pop();
    const path = `${conversationId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, file);
    if (uploadError) { toast.error("Ошибка загрузки файла"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const msgType = isVideo ? "video" : isImage ? "image" : "file";
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: file.name,
      media_url: urlData.publicUrl,
      message_type: msgType,
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
        await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, text: "📞 Начал голосовой звонок. Нажмите 📞 чтобы присоединиться.", message_type: "voice_room" });
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

  const hasActiveVoiceRoom = messages.some((m) => m.message_type === "voice_room" && m.sender_id !== user?.id);

  const renderMediaMessage = (msg: Message) => {
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
            <button onClick={joinVoiceRoom} className="ml-2 px-3 py-1 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold">Войти</button>
          )}
        </div>
      );
    }
    return <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <audio ref={remoteAudioRef} autoPlay />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-[11px] text-online font-medium">● Онлайн</p>
        </div>
        <div className="flex gap-2">
          {inVoiceRoom ? (
            <>
              <button onClick={toggleMic} className={`w-10 h-10 rounded-2xl flex items-center justify-center ${voiceActive ? "gradient-primary" : "neu-raised"}`}>
                {voiceActive ? <Mic size={16} className="text-primary-foreground" /> : <MicOff size={16} className="text-destructive" />}
              </button>
              <button onClick={leaveVoiceRoom} className="w-10 h-10 rounded-2xl bg-destructive/20 flex items-center justify-center">
                <Phone size={16} className="text-destructive" />
              </button>
            </>
          ) : (
            <button onClick={hasActiveVoiceRoom ? joinVoiceRoom : startVoiceRoom} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center">
              <Phone size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Voice room banner */}
      <AnimatePresence>
        {inVoiceRoom && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mx-4 mb-2 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(145 65% 40%), hsl(160 60% 45%))" }}>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-semibold flex-1">Голосовой звонок {voiceActive ? "· Микрофон вкл" : "· Микрофон выкл"}</span>
              <button onClick={leaveVoiceRoom} className="text-white/80 text-xs font-medium">Завершить</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {linkedJob && (
          <div className="neu-flat rounded-2xl p-3 mb-2">
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
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            const isSystem = msg.message_type === "system";
            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">{msg.text}</span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} ${msg._optimistic ? "opacity-70" : ""}`}>
                <div className="max-w-[80%]">
                  {!isOwn && (
                    <p className="text-[10px] text-primary font-semibold mb-1 ml-1">{senderNames[msg.sender_id] || "..."}</p>
                  )}
                  <div className={`px-4 py-3 rounded-2xl ${isOwn ? "neu-flat rounded-br-md" : "neu-flat rounded-bl-md"}`}>
                    {renderMediaMessage(msg)}
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1.5 ${isOwn ? "text-right" : "text-left"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attach popup */}
      <AnimatePresence>
        {showAttach && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-24 left-4 right-4 neu-card rounded-2xl p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Прикрепить</span>
              <button onClick={() => setShowAttach(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center"><Image size={22} className="text-primary" /></div>
                <span className="text-[11px] text-muted-foreground">Фото</span>
              </button>
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "video/*"; fileInputRef.current.click(); } }} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center"><Video size={22} className="text-primary" /></div>
                <span className="text-[11px] text-muted-foreground">Видео</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-8 pt-3">
        {uploading && <div className="text-center text-xs text-primary mb-2 animate-pulse">Загрузка файла...</div>}
        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowAttach(!showAttach)} className="w-11 h-11 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all">
            <Paperclip size={18} className="text-muted-foreground" />
          </button>
          <div className="flex-1 flex items-center neu-inset rounded-2xl px-4 py-3">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Написать сообщение..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          <button onClick={handleSend} disabled={!text.trim() || sending} className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50" style={{ boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)' }}>
            <Send size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealChatScreen;
