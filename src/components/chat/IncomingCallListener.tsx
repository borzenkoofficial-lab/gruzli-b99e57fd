import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CallModal, { type CallMode } from "./CallModal";

interface IncomingCall {
  conversationId: string;
  fromUserId: string;
  fromName: string;
  mode: CallMode;
}

const IncomingCallListener = () => {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<IncomingCall | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
    socketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type !== "call:ring" || payload.fromUserId === user.id) return;
        const next: IncomingCall = {
          conversationId: payload.conversationId,
          fromUserId: payload.fromUserId,
          fromName: payload.fromName || "Пользователь",
          mode: payload.mode === "video" ? "video" : "audio",
        };
        setIncoming(next);
        socket.send(JSON.stringify({ type: "conversation:subscribe", conversationId: next.conversationId }));
      } catch (error) {
        console.error("[calls] Invalid incoming call event:", error);
      }
    };
    socket.onerror = () => console.warn("[calls] Incoming-call channel unavailable.");
    socket.onclose = () => { if (socketRef.current === socket) socketRef.current = null; };
    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user?.id]);

  const accept = () => {
    if (!incoming) return;
    setActive(incoming);
    setIncoming(null);
  };

  const reject = () => {
    if (!incoming || !user) return;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "call:signal",
        conversationId: incoming.conversationId,
        toUserId: incoming.fromUserId,
        signal: { kind: "reject", from: user.id },
      }));
    }
    setIncoming(null);
  };

  return (
    <>
      <AnimatePresence>
        {incoming && !active && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[120] safe-top"
          >
            <div className="mx-3 mt-2 bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                {incoming.mode === "video" ? <VideoIcon size={22} className="text-primary" /> : <Phone size={22} className="text-primary animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{incoming.fromName}</p>
                <p className="text-xs text-muted-foreground">{incoming.mode === "video" ? "Входящий видеозвонок" : "Входящий звонок"}</p>
              </div>
              <button onClick={reject} className="w-11 h-11 rounded-full bg-destructive flex items-center justify-center">
                <PhoneOff size={18} className="text-destructive-foreground" />
              </button>
              <button onClick={accept} className="w-11 h-11 rounded-full bg-online flex items-center justify-center">
                <Phone size={18} className="text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {active && user && (
        <CallModal
          conversationId={active.conversationId}
          selfUserId={user.id}
          peerUserId={active.fromUserId}
          peerName={active.fromName}
          mode={active.mode}
          role="callee"
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
};

export default IncomingCallListener;
