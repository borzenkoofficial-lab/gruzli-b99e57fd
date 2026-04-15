import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const features = [
  { icon: "▣", title: "Заявки", desc: "Создание и управление заказами", color: "hsl(230, 60%, 58%)" },
  { icon: "◈", title: "Чат", desc: "Мгновенные сообщения", color: "hsl(200, 60%, 55%)" },
  { icon: "◉", title: "Диспетчеры", desc: "Управление командой", color: "hsl(270, 60%, 55%)" },
  { icon: "★", title: "Рейтинг", desc: "Система отзывов", color: "hsl(45, 80%, 55%)" },
];

const FeatureCard: React.FC<{ icon: string; title: string; desc: string; color: string; index: number }> = ({ icon, title, desc, color, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const delay = index * 12;
  const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const y = interpolate(s, [0, 1], [60, 0]);

  return (
    <div
      style={{
        width: 360,
        padding: "40px 30px",
        borderRadius: 24,
        background: "linear-gradient(135deg, hsla(230, 30%, 20%, 0.8), hsla(230, 20%, 15%, 0.6))",
        border: "1px solid hsla(230, 40%, 40%, 0.3)",
        textAlign: "center",
        transform: `scale(${scale}) translateY(${y}px)`,
        opacity,
        boxShadow: "0 20px 60px hsla(230, 50%, 10%, 0.5)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16, color }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "white", fontFamily: "sans-serif", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 18, color: "hsla(230, 20%, 70%, 0.8)", fontFamily: "sans-serif" }}>{desc}</div>
    </div>
  );
};

export const Scene2Core: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const titleOpacity = interpolate(titleS, [0, 1], [0, 1]);
  const titleX = interpolate(titleS, [0, 1], [-100, 0]);

  return (
    <AbsoluteFill style={{ padding: "80px 120px" }}>
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          marginBottom: 60,
          transform: `translateX(${titleX}px)`,
          opacity: titleOpacity,
        }}
      >
        Возможности платформы
      </div>

      <div style={{ display: "flex", gap: 30, justifyContent: "center", flexWrap: "wrap" }}>
        {features.map((f, i) => (
          <Sequence key={i} from={20}>
            <FeatureCard {...f} index={i} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
