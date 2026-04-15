import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const aiFeatures = [
  {
    icon: "✨",
    title: "AI-описания",
    desc: "Нейросеть улучшает текст заявки — грамотнее, структурированнее, профессиональнее",
    color: "hsl(270, 60%, 55%)",
  },
  {
    icon: "🔍",
    title: "Умный поиск",
    desc: "Поиск заявок на естественном языке: «переезд завтра утром за 500₽»",
    color: "hsl(200, 70%, 50%)",
  },
  {
    icon: "🛡️",
    title: "AI-модерация",
    desc: "Автоматическая проверка контента на спам, мат и мошенничество",
    color: "hsl(150, 60%, 45%)",
  },
  {
    icon: "📊",
    title: "AI-аналитика",
    desc: "Персональные советы для диспетчеров по оптимизации бизнеса",
    color: "hsl(35, 80%, 55%)",
  },
];

const AICard: React.FC<{ feature: typeof aiFeatures[0]; index: number }> = ({ feature, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 20;
  const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80, mass: 1.2 } });
  const x = interpolate(s, [0, 1], [index % 2 === 0 ? -300 : 300, 0]);
  const opacity = interpolate(s, [0, 1], [0, 1]);
  
  // Subtle floating
  const floatY = Math.sin((frame - delay) * 0.04) * 3;

  // Glow pulse
  const glowOpacity = 0.3 + Math.sin((frame - delay) * 0.06) * 0.15;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        padding: "30px 40px",
        borderRadius: 20,
        background: "hsla(230, 25%, 15%, 0.7)",
        border: `1px solid ${feature.color}33`,
        transform: `translateX(${x}px) translateY(${floatY}px)`,
        opacity,
        boxShadow: `0 0 40px ${feature.color}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}`,
        width: 750,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${feature.color}, ${feature.color}88)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          flexShrink: 0,
        }}
      >
        {feature.icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "white", fontFamily: "sans-serif", marginBottom: 6 }}>
          {feature.title}
        </div>
        <div style={{ fontSize: 17, color: "hsla(230, 20%, 75%, 0.9)", fontFamily: "sans-serif", lineHeight: 1.4 }}>
          {feature.desc}
        </div>
      </div>
    </div>
  );
};

export const Scene3AI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const badgeScale = interpolate(badgeS, [0, 1], [0.3, 1]);
  const badgeOpacity = interpolate(badgeS, [0, 1], [0, 1]);

  const titleS = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 100 } });
  const titleY = interpolate(titleS, [0, 1], [60, 0]);
  const titleOpacity = interpolate(titleS, [0, 1], [0, 1]);

  // Sparkle particles
  const sparkles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + frame * 0.02;
    const radius = 40 + Math.sin(frame * 0.03 + i) * 10;
    return {
      x: 960 + Math.cos(angle) * radius,
      y: 75 + Math.sin(angle) * radius * 0.5,
      opacity: 0.4 + Math.sin(frame * 0.05 + i * 1.3) * 0.3,
      size: 3 + Math.sin(frame * 0.04 + i) * 2,
    };
  });

  return (
    <AbsoluteFill style={{ padding: "60px 0" }}>
      {/* Sparkles */}
      {sparkles.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "hsl(230, 60%, 70%)",
            opacity: s.opacity * badgeOpacity,
          }}
        />
      ))}

      {/* AI Badge */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <span
          style={{
            display: "inline-block",
            padding: "8px 24px",
            borderRadius: 30,
            background: "linear-gradient(135deg, hsl(270, 60%, 55%), hsl(230, 60%, 58%))",
            fontSize: 16,
            fontWeight: 600,
            color: "white",
            fontFamily: "sans-serif",
            letterSpacing: "0.1em",
            transform: `scale(${badgeScale})`,
            opacity: badgeOpacity,
          }}
        >
          POWERED BY AI
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          textAlign: "center",
          fontSize: 52,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          marginBottom: 50,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        Нейросеть внутри
      </div>

      {/* AI Feature Cards - two columns */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {aiFeatures.map((f, i) => (
          <Sequence key={i} from={30}>
            <AICard feature={f} index={i} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
