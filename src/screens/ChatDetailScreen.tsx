import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, Send, Mic, Plus, Play, Camera, Users } from "lucide-react";
import { mockMessages, type ChatPreview } from "@/data/mockData";

interface ChatDetailScreenProps {
  chat: ChatPreview;
  onBack: () => void;
}

const ChatDetailScreen = ({ chat, onBack }: ChatDetailScreenProps) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const waveformBars = useMemo(
    () => Array.from({ length: 28 }, () => Math.random() * 100),
    []
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold ${
            chat.isGroup ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground"
          }`}>
            {chat.avatar}
          </div>
          {chat.online && !chat.isGroup && (
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-surface-2" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">{chat.name}</h2>
          <p className="text-[11px] text-online font-medium">
            {chat.isGroup ? `${chat.members} участников` : chat.online ? "● Онлайн" : "Не в сети"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center">
            <Camera size={16} className="text-muted-foreground" />
          </button>
          <button className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center">
            <Video size={16} className="text-muted-foreground" />
          </button>
          <button className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center">
            <Phone size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* "Show object" banner */}
      <div className="mx-4 mb-2">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border text-xs font-semibold text-primary active:bg-surface-1 border border-border transition-all">
          <Video size={14} /> Покажи объект — видеозвонок
        </button>
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
              {/* Sender name in group */}
              {chat.isGroup && !msg.own && msg.sender && (
                <p className="text-[10px] text-primary font-semibold mb-1 ml-1">{msg.sender}</p>
              )}

              {msg.text && (
                <div className={`px-4 py-3 rounded-2xl ${msg.own ? "bg-card rounded-br-md" : "bg-card rounded-bl-md"}`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                </div>
              )}

              {msg.image && (
                <div className="relative w-52 h-40 rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="absolute inset-0 bg-surface-4" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {msg.imageProgress && msg.imageProgress < 100 && (
                      <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(228 14% 25%)" strokeWidth="3" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(230 60% 58%)" strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - (msg.imageProgress || 0) / 100)}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{msg.imageProgress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {msg.voice && (
                <div className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-card min-w-[220px]">
                  <button className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                    <Play size={14} className="text-primary-foreground ml-0.5" />
                  </button>
                  <div className="flex-1 flex items-center gap-[2px] h-7">
                    {waveformBars.map((h, i) => (
                      <div key={i} className="w-[2px] rounded-full bg-primary/60" style={{ height: `${h}%`, minHeight: 3 }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium ml-1">{msg.voice.duration}</span>
                </div>
              )}

              {msg.time && (
                <p className={`text-[10px] text-muted-foreground mt-1.5 ${msg.own ? "text-right" : "text-left"}`}>{msg.time}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-8 pt-3">
        {isRecording ? (
          <div className="flex items-center gap-3 bg-surface-1 border border-border rounded-2xl px-4 py-3">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-muted-foreground flex-1">Запись голоса...</span>
            <button onClick={() => setIsRecording(false)} className="px-4 py-2 rounded-xl bg-foreground text-xs font-semibold text-primary-foreground">
              Отправить
            </button>
            <button onClick={() => setIsRecording(false)} className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-muted-foreground">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button className="w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
              <Plus size={18} className="text-muted-foreground" />
            </button>
            <div className="flex-1 flex items-center bg-surface-1 border border-border rounded-2xl px-4 py-3">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Написать сообщение..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            {/* Big mic button */}
            <button
              onClick={() => setIsRecording(true)}
              className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center tap-scale"
              style={{
                boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
              }}
            >
              <Mic size={20} className="text-primary-foreground" />
            </button>
            <button className="w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
              <Send size={16} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDetailScreen;
