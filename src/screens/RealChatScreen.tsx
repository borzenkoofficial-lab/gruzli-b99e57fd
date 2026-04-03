import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Mic, Play, Phone, Video, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

interface RealChatScreenProps {
  conversationId: string;
  title: string;
  onBack: () => void;
}

const RealChatScreen = ({ conversationId, title, onBack }: RealChatScreenProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      // fetch sender names
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", senderIds);
      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach((p) => (map[p.user_id] = p.full_name));
        setSenderNames(map);
      }
    }
  };

  useEffect(() => {
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Tables<"messages">;
          setMessages((prev) => [...prev, newMsg]);
          // fetch sender name if unknown
          if (!senderNames[newMsg.sender_id]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_id, full_name")
              .eq("user_id", newMsg.sender_id)
              .single();
            if (profile) {
              setSenderNames((prev) => ({ ...prev, [profile.user_id]: profile.full_name }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: text.trim(),
      message_type: "text",
    });
    if (!error) setText("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
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
          <button className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center">
            <Video size={16} className="text-muted-foreground" />
          </button>
          <button className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center">
            <Phone size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Начните диалог — напишите сообщение
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%]">
                {!isOwn && (
                  <p className="text-[10px] text-primary font-semibold mb-1 ml-1">
                    {senderNames[msg.sender_id] || "..."}
                  </p>
                )}
                <div className={`px-4 py-3 rounded-2xl ${isOwn ? "neu-flat rounded-br-md" : "neu-flat rounded-bl-md"}`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1.5 ${isOwn ? "text-right" : "text-left"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-8 pt-3">
        <div className="flex items-center gap-2.5">
          <button className="w-11 h-11 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all">
            <Plus size={18} className="text-muted-foreground" />
          </button>
          <div className="flex-1 flex items-center neu-inset rounded-2xl px-4 py-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            style={{
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            }}
          >
            <Send size={18} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealChatScreen;
