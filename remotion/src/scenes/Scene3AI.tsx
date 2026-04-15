import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const aiFeatures = [
  {
    icon: "AI",
    title: "AI-описания",
    desc: "Нейросеть улучшает текст заявки — грамотнее, структурированнее, профессиональнее",
    color: "hsl(270, 60%, 55%)",
  },
  {
    icon: "Q",
    title: "Умный поиск",
    desc: "Поиск заявок на естественном языке: «переезд завтра утром за 500»",
    color: "hsl(200, 70%, 50%)",
  },
  {
    icon: "M",
    title: "AI-модерация",
    desc: "Автоматическая проверка контента на спам, мат и мошенничество",
    color: "hsl(150, 60%, 45%)",
  },
  {
    icon: "S",
    title: "AI-аналитика",
    desc: "Персональные советы для диспетчеров по оптимизации бизнеса",
    color: "hsl(35, 80%, 55%)",
  },
];

const AICard: React.FC<{ feature: typeof aiFeatures[0]; index: number }> = ({ feature, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 18;
  const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 80 } });
  const x = interpolate(s, [0, 1], [index % 2 === 0 ? -200 : 200, 0]);
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const floatY = Math.sin((frame - delay) * 0.04) * 3;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "28px 36px",
        borderRadius: 20,
        background: "hsla(230, 25%, 15%, 0.8)",
        border: `1px solid ${feature.color}44`,
        transform: `translateX(${x}px) translateY(${floatY}px)`,
        opacity,
        boxShadow: `0 0 30px ${feature.color}22`,
        width: 700,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${feature.color}, ${feature.color}88)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          flexShrink: 0,
        }}
      >
        {feature.icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "white", fontFamily: "sans-serif", marginBottom: 6 }}>
          {feature.title}
        </div>
        <div style={{ fontSize: 16, color: "hsla(230, 20%, 75%, 0.9)", fontFamily: "sans-serif", lineHeight: 1.4 }}>
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

  return (
    <AbsoluteFill style={{ padding: "60px 0", alignItems: "center" }}>
      {/* AI Badge */}
      <div style={{ marginBottom: 16 }}>
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
          fontSize: 52,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          marginBottom: 40,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        Нейросеть внутри
      </div>

      {/* AI Feature Cards */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {aiFeatures.map((f, i) => (
          <Sequence key={i} from={25}>
            <AICard feature={f} index={i} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
