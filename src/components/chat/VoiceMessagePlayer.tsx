import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { motion } from "framer-motion";

interface VoiceMessagePlayerProps {
  url: string;
  duration?: number;
  isOwn: boolean;
}

const VoiceMessagePlayer = ({ url, duration: initialDuration, isOwn }: VoiceMessagePlayerProps) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(Math.floor(audio.duration));
      }
    });

    audio.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
      cancelAnimationFrame(animRef.current);
    });

    return () => {
      audio.pause();
      audio.src = "";
      cancelAnimationFrame(animRef.current);
    };
  }, [url]);

  const updateProgress = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
    } else {
      try {
        await audio.play();
        animRef.current = requestAnimationFrame(updateProgress);
        setPlaying(true);
      } catch (err) {
        console.warn("Audio play failed:", err);
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Generate static waveform bars
  const bars = 20;

  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isOwn ? "bg-primary-foreground/20" : "bg-primary/20"
        }`}
      >
        {playing ? (
          <Pause size={16} className={isOwn ? "text-primary-foreground" : "text-primary"} />
        ) : (
          <Play size={16} className={`${isOwn ? "text-primary-foreground" : "text-primary"} ml-0.5`} />
        )}
      </button>

      <div className="flex-1">
        {/* Waveform */}
        <div className="flex items-center gap-[2px] h-5">
          {Array.from({ length: bars }).map((_, i) => {
            const barHeight = 4 + Math.sin(i * 0.8 + 2) * 6 + Math.cos(i * 1.3) * 4;
            const filled = i / bars <= progress;
            return (
              <div
                key={i}
                className={`w-[2.5px] rounded-full transition-colors duration-150 ${
                  filled
                    ? isOwn ? "bg-primary-foreground" : "bg-primary"
                    : isOwn ? "bg-primary-foreground/30" : "bg-primary/30"
                }`}
                style={{ height: `${barHeight}px` }}
              />
            );
          })}
        </div>

        <span className={`text-[10px] mt-0.5 block ${
          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
        }`}>
          {playing && audioRef.current
            ? formatTime(Math.floor(audioRef.current.currentTime))
            : formatTime(duration)
          }
        </span>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
