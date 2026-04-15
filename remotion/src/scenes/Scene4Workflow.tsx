import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const steps = [
  { num: "01", label: "Диспетчер создаёт заявку", sub: "AI проверяет и улучшает описание" },
  { num: "02", label: "Грузчики находят через поиск", sub: "Умный AI-поиск по смыслу" },
  { num: "03", label: "Чат и координация", sub: "Модерация контента в реальном времени" },
  { num: "04", label: "Аналитика и рост", sub: "AI-советы для оптимизации" },
];

export const Scene4Workflow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const titleOpacity = interpolate(titleS, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ padding: "80px 140px" }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          marginBottom: 60,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        Как это работает
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, justifyContent: "center" }}>
        {steps.map((step, i) => {
          const delay = 15 + i * 18;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
          const y = interpolate(s, [0, 1], [100, 0]);
          const opacity = interpolate(s, [0, 1], [0, 1]);
          const lineProgress = interpolate(frame, [delay + 20, delay + 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 340,
                  textAlign: "center",
                  transform: `translateY(${y}px)`,
                  opacity,
                }}
              >
                {/* Number */}
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, hsl(230, 60%, 58%), hsl(260, 60%, 55%))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 800,
                    color: "white",
                    fontFamily: "sans-serif",
                    margin: "0 auto 20px",
                    boxShadow: "0 0 30px hsla(230, 60%, 50%, 0.3)",
                  }}
                >
                  {step.num}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "white", fontFamily: "sans-serif", marginBottom: 10 }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 16, color: "hsla(230, 20%, 70%, 0.8)", fontFamily: "sans-serif", lineHeight: 1.4 }}>
                  {step.sub}
                </div>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    width: 40,
                    height: 2,
                    background: `linear-gradient(90deg, hsl(230, 60%, 58%), transparent)`,
                    opacity: lineProgress,
                    marginTop: -60,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
