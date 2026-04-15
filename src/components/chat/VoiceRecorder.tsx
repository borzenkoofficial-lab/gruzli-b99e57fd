import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, Send, Trash2, Square } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

const VoiceRecorder = ({ onSend, onCancel }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(true);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(100);
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 200);
      } catch {
        onCancel();
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onCancel]);

  const handleSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      onSend(blob, finalDuration);
    };

    if (recorder.state === "recording") {
      recorder.stop();
    } else {
      // Already stopped (paused state) — send collected chunks
      streamRef.current?.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      onSend(blob, duration);
    }
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 flex-1"
    >
      {/* Delete */}
      <button
        onClick={handleCancel}
        className="w-10 h-10 rounded-full flex items-center justify-center text-destructive active:bg-destructive/10 transition-colors shrink-0"
      >
        <Trash2 size={20} />
      </button>

      {/* Waveform area */}
      <div className="flex-1 flex items-center gap-3 bg-muted/40 rounded-3xl px-4 py-2.5 border border-border/40">
        {recording && (
          <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
        )}

        {/* Fake waveform */}
        <div className="flex items-center gap-[2px] flex-1 h-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-primary/60"
              animate={recording ? {
                height: [4, Math.random() * 20 + 4, 4],
              } : { height: 4 }}
              transition={{
                duration: 0.5,
                repeat: recording ? Infinity : 0,
                delay: i * 0.04,
              }}
              style={{ height: 4 }}
            />
          ))}
        </div>

        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {formatTime(duration)}
        </span>

        {recording && (
          <button
            onClick={stopRecording}
            className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center shrink-0"
          >
            <Square size={12} className="text-destructive fill-destructive" />
          </button>
        )}
      </div>

      {/* Send */}
      <motion.button
        onClick={handleSend}
        whileTap={{ scale: 0.85 }}
        className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0"
      >
        <Send size={18} className="text-primary-foreground ml-0.5" />
      </motion.button>
    </motion.div>
  );
};

export default VoiceRecorder;
