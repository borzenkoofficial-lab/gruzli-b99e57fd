import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CallModal, { type CallMode } from "./CallModal";

interface IncomingCall {
  conversationId: string;
  fromUserId: string;
  fromName: string;
  mode: CallMode;
}

/**
 * Global listener for incoming calls. Mounted once per app.
 * Subscribes to a per-user broadcast channel; presents an "incoming call"
 * sheet when someone rings, and opens the CallModal on accept.
 */
const IncomingCallListener = () => {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen to all conversations the user is part of via a user-scoped channel
    const ch = supabase
      .channel(`user-calls:${user.id}`)
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        const p = payload as { conversationId: string; fromUserId: string; fromName: string; mode: CallMode };
        if (p.fromUserId === user.id) return;
        setIncoming(p);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const accept = () => {
    if (!incoming) return;
    setActive(incoming);
    setIncoming(null);
  };

  const reject = async () => {
    if (!incoming || !user) return;
    // Notify caller via the call channel
    const ch = supabase.channel(`call:${incoming.conversationId}`);
    await new Promise<void>((resolve) => {
      ch.subscribe((s) => { if (s === "SUBSCRIBED") resolve(); });
    });
    await ch.send({ type: "broadcast", event: "signal", payload: { kind: "reject", from: user.id } });
    supabase.removeChannel(ch);
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
                {incoming.mode === "video" ? (
                  <VideoIcon size={22} className="text-primary" />
                ) : (
                  <Phone size={22} className="text-primary animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{incoming.fromName}</p>
                <p className="text-xs text-muted-foreground">
                  {incoming.mode === "video" ? "Входящий видеозвонок" : "Входящий звонок"}
                </p>
              </div>
              <button
                onClick={reject}
                className="w-11 h-11 rounded-full bg-destructive flex items-center justify-center"
              >
                <PhoneOff size={18} className="text-destructive-foreground" />
              </button>
              <button
                onClick={accept}
                className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center"
              >
                <Phone size={18} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {active && user && (
        <CallModal
          conversationId={active.conversationId}
          selfUserId={user.id}
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
