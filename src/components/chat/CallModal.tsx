import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { toast } from "sonner";

export type CallMode = "audio" | "video";
export type CallRole = "caller" | "callee";

interface CallModalProps {
  conversationId: string;
  selfUserId: string;
  peerUserId: string;
  peerName: string;
  mode: CallMode;
  role: CallRole;
  onClose: () => void;
}

// Public STUN servers (no TURN — works on most home/mobile networks; falls back gracefully)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

type Signal =
  | { kind: "ringing"; from: string }
  | { kind: "accept"; from: string }
  | { kind: "reject"; from: string }
  | { kind: "hangup"; from: string }
  | { kind: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; candidate: RTCIceCandidateInit };

const CallModal = ({ conversationId, selfUserId, peerUserId, peerName, mode, role, onClose }: CallModalProps) => {
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">(
    role === "caller" ? "ringing" : "connecting"
  );
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(mode === "video");
  const [secs, setSecs] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<WebSocket | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const send = (signal: Signal) => {
    const socket = channelRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "call:signal", conversationId, toUserId: peerUserId, signal }));
    }
  };

  // Timer when connected
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const cleanup = (notifyPeer = true) => {
    if (notifyPeer) send({ kind: "hangup", from: selfUserId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
  };

  const endCall = () => {
    cleanup(true);
    setStatus("ended");
    setTimeout(onClose, 200);
  };

  // Setup peer connection
  const initPeer = async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ kind: "ice", from: selfUserId, candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (mode === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        toast.error("Соединение потеряно");
        endCall();
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      if (mode === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Нет доступа к камере или микрофону");
      endCall();
      throw new Error("media_denied");
    }

    return pc;
  };

  // Caller flow: send ringing, wait for accept, then exchange offer/answer
  const startAsCaller = async () => {
    const pc = await initPeer().catch(() => null);
    if (!pc) return;
    send({ kind: "ringing", from: selfUserId });
  };

  // Callee flow: peer is already setup, send offer back
  const acceptIncoming = async () => {
    setStatus("connecting");
    await initPeer().catch(() => null);
    send({ kind: "accept", from: selfUserId });
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
    channelRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: "conversation:subscribe", conversationId }));
    socket.onmessage = async (event) => {
      let payload: { type?: string; conversationId?: string; signal?: Signal };
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (payload.type === "conversation:subscribed" && payload.conversationId === conversationId) {
        if (role === "caller") await startAsCaller();
        else await acceptIncoming();
        return;
      }
      if (payload.type !== "call:signal" || payload.conversationId !== conversationId || !payload.signal) return;
      const sig = payload.signal;
      const pc = pcRef.current;
      if (sig.kind === "ringing" && role === "callee") return;
      try {
        if (sig.kind === "accept" && role === "caller" && pc) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ kind: "offer", from: selfUserId, sdp: offer });
        }
        if (sig.kind === "offer" && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          for (const candidate of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale ICE candidate */ }
          }
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ kind: "answer", from: selfUserId, sdp: answer });
        }
        if (sig.kind === "answer" && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          for (const candidate of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale ICE candidate */ }
          }
          pendingIceRef.current = [];
        }
        if (sig.kind === "ice") {
          if (pc?.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(sig.candidate)); } catch { /* invalid ICE candidate */ }
          } else {
            pendingIceRef.current.push(sig.candidate);
          }
        }
        if (sig.kind === "reject" || sig.kind === "hangup") {
          toast.info(sig.kind === "reject" ? "Звонок отклонён" : "Звонок завершён");
          cleanup(false);
          setStatus("ended");
          window.setTimeout(onClose, 200);
        }
      } catch (error) {
        console.error("[call] WebRTC signaling failed:", error);
        toast.error("Не удалось установить соединение");
        cleanup(false);
        setStatus("ended");
        window.setTimeout(onClose, 200);
      }
    };
    socket.onerror = () => toast.error("Не удалось подключиться к серверу звонков");
    return () => cleanup(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {mode === "video" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />
      )}

      {mode === "video" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-20 right-4 w-28 h-40 rounded-2xl object-cover bg-muted border-2 border-background z-10 shadow-xl"
        />
      )}

      {/* Header info */}
      <div className="relative z-20 pt-16 px-6 text-center">
        <p className="text-base text-muted-foreground mb-2">
          {status === "ringing" && "Вызов..."}
          {status === "connecting" && "Соединение..."}
          {status === "connected" && fmt(secs)}
          {status === "ended" && "Завершено"}
        </p>
        <h2 className="text-3xl font-bold text-foreground">{peerName}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "video" ? "Видеозвонок" : "Аудиозвонок"}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-auto pb-12 pt-8 px-6 flex items-center justify-center gap-5 relative z-20 bg-gradient-to-t from-background via-background/80 to-transparent">
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            micOn ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground"
          }`}
        >
          {micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <PhoneOff size={26} className="text-destructive-foreground" />
        </button>

        {mode === "video" && (
          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              camOn ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {camOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default CallModal;
