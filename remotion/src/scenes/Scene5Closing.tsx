import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene5Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 12, stiffness: 60, mass: 1.5 } });
  const logoScale = interpolate(logoS, [0, 1], [0.3, 1]);
  const logoOpacity = interpolate(logoS, [0, 1], [0, 1]);

  const textS = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 100 } });
  const textOpacity = interpolate(textS, [0, 1], [0, 1]);
  const textY = interpolate(textS, [0, 1], [40, 0]);

  const urlS = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 100 } });
  const urlOpacity = interpolate(urlS, [0, 1], [0, 1]);

  // Pulsing glow
  const glowSize = 100 + Math.sin(frame * 0.05) * 20;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: glowSize * 3,
          height: glowSize * 3,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsla(230, 60%, 50%, 0.2), transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "linear-gradient(135deg, hsl(230, 60%, 58%), hsl(260, 70%, 65%))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          boxShadow: "0 0 60px hsla(230, 70%, 50%, 0.4)",
          marginBottom: 30,
        }}
      >
        <span style={{ fontSize: 54, fontWeight: 800, color: "white", fontFamily: "sans-serif" }}>Г</span>
      </div>

      {/* CTA text */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "white",
          fontFamily: "sans-serif",
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
          marginBottom: 20,
        }}
      >
        Будущее уже здесь
      </div>

      {/* URL */}
      <div
        style={{
          fontSize: 24,
          color: "hsl(230, 60%, 70%)",
          fontFamily: "sans-serif",
          fontWeight: 400,
          letterSpacing: "0.08em",
          opacity: urlOpacity,
        }}
      >
        gruzli.lovable.app
      </div>
    </AbsoluteFill>
  );
};
