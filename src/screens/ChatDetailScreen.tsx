import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, Send, Mic, Plus, Play } from "lucide-react";
import { mockMessages, type ChatPreview } from "@/data/mockData";

interface ChatDetailScreenProps {
  chat: ChatPreview;
  onBack: () => void;
}

const ChatDetailScreen = ({ chat, onBack }: ChatDetailScreenProps) => {
  const [message, setMessage] = useState("");

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-surface-2 border-b border-border/30">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-surface-4 flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {chat.avatar}
          </div>
          {chat.online && (
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-surface-2" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">{chat.name}</h2>
          <p className="text-[11px] text-online font-medium">
            {chat.online ? "● Онлайн" : "Не в сети"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center">
            <Video size={16} className="text-muted-foreground" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center">
            <Phone size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {mockMessages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex ${msg.own ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] ${msg.own ? "" : ""}`}>
              {/* Text Message */}
              {msg.text && (
                <div className={`px-4 py-2.5 rounded-2xl ${
                  msg.own
                    ? "bg-surface-3 rounded-br-md"
                    : "bg-surface-3 rounded-bl-md"
                }`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                </div>
              )}

              {/* Image Message with Progress */}
              {msg.image && (
                <div className="relative w-52 h-36 rounded-2xl bg-surface-4 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {msg.imageProgress && msg.imageProgress < 100 && (
                      <div className="relative w-14 h-14">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(220 14% 25%)" strokeWidth="3" />
                          <circle
                            cx="28" cy="28" r="24" fill="none"
                            stroke="hsl(195 100% 50%)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 24}`}
                            strokeDashoffset={`${2 * Math.PI * 24 * (1 - (msg.imageProgress || 0) / 100)}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                          {msg.imageProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  {msg.imageProgress && msg.imageProgress < 100 && (
                    <p className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">Отправка</p>
                  )}
                </div>
              )}

              {/* Voice Message */}
              {msg.voice && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-surface-3 min-w-[200px]">
                  <button className="w-8 h-8 rounded-full gradient-cyan flex items-center justify-center flex-shrink-0">
                    <Play size={14} className="text-primary-foreground ml-0.5" />
                  </button>
                  <div className="flex-1 flex items-center gap-[2px] h-6">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[2px] rounded-full bg-primary/60"
                        style={{ height: `${Math.random() * 100}%`, minHeight: 3 }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium ml-1">{msg.voice.duration}</span>
                </div>
              )}

              {/* Timestamp */}
              {msg.time && (
                <p className={`text-[10px] text-muted-foreground mt-1 ${msg.own ? "text-right" : "text-left"}`}>
                  {msg.time}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 bg-surface-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-surface-3 rounded-2xl px-4 py-2.5">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Написать сообщение..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button className="ml-2">
              <Mic size={18} className="text-muted-foreground" />
            </button>
          </div>
          <button className="w-10 h-10 rounded-xl gradient-cyan flex items-center justify-center shadow-soft active:scale-95 transition-transform">
            <Send size={16} className="text-primary-foreground" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
            <Plus size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetailScreen;
