import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, Send, Mic, Plus, Play } from "lucide-react";
import { mockMessages, type ChatPreview } from "@/data/mockData";

interface ChatDetailScreenProps {
  chat: ChatPreview;
  onBack: () => void;
}

const ChatDetailScreen = ({ chat, onBack }: ChatDetailScreenProps) => {
  const [message, setMessage] = useState("");

  const waveformBars = useMemo(
    () => Array.from({ length: 28 }, () => Math.random() * 100),
    []
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full neu-raised flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {chat.avatar}
          </div>
          {chat.online && (
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-surface-2" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">{chat.name}</h2>
          <p className="text-[11px] text-online font-medium">
            {chat.online ? "● Онлайн" : "Не в сети"}
          </p>
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
        {mockMessages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex ${msg.own ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[80%]">
              {/* Text Message */}
              {msg.text && (
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.own
                    ? "neu-flat rounded-br-md"
                    : "neu-flat rounded-bl-md"
                }`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                </div>
              )}

              {/* Image Message with Progress */}
              {msg.image && (
                <div className="relative w-52 h-40 rounded-2xl neu-card overflow-hidden">
                  <div className="absolute inset-0 bg-surface-4" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {msg.imageProgress && msg.imageProgress < 100 && (
                      <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(228 14% 25%)" strokeWidth="3" />
                          <circle
                            cx="32" cy="32" r="28" fill="none"
                            stroke="hsl(230 60% 58%)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - (msg.imageProgress || 0) / 100)}`}
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
                <div className="flex items-center gap-2.5 px-3 py-3 rounded-2xl neu-flat min-w-[220px]">
                  <button className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <Play size={14} className="text-primary-foreground ml-0.5" />
                  </button>
                  <div className="flex-1 flex items-center gap-[2px] h-7">
                    {waveformBars.map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] rounded-full bg-primary/60"
                        style={{ height: `${h}%`, minHeight: 3 }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium ml-1">{msg.voice.duration}</span>
                </div>
              )}

              {/* Timestamp */}
              {msg.time && (
                <p className={`text-[10px] text-muted-foreground mt-1.5 ${msg.own ? "text-right" : "text-left"}`}>
                  {msg.time}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-8 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center neu-inset rounded-2xl px-4 py-3">
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
          <button className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center active:scale-95 transition-transform">
            <Send size={16} className="text-primary-foreground" />
          </button>
          <button className="w-11 h-11 rounded-xl neu-raised flex items-center justify-center active:neu-inset transition-all">
            <Plus size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetailScreen;
