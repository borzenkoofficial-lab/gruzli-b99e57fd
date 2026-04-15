import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale spring
  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 80, mass: 1.5 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Title slide in
  const titleY = interpolate(
    spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 100 } }),
    [0, 1], [80, 0]
  );
  const titleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });

  // Subtitle
  const subOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(
    spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 100 } }),
    [0, 1], [40, 0]
  );

  // Decorative line
  const lineWidth = interpolate(frame, [35, 65], [0, 400], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Logo circle */}
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "linear-gradient(135deg, hsl(230, 60%, 58%), hsl(260, 70%, 65%))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          boxShadow: "0 0 80px hsla(230, 70%, 50%, 0.4)",
          marginBottom: 40,
        }}
      >
        <span style={{ fontSize: 64, fontWeight: 800, color: "white", fontFamily: "sans-serif" }}>Г</span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
          letterSpacing: "0.05em",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        ГРУЗЛИ
      </div>

      {/* Decorative line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          background: "linear-gradient(90deg, transparent, hsl(230, 60%, 58%), transparent)",
          marginTop: 20,
          marginBottom: 20,
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          fontSize: 32,
          color: "hsla(230, 20%, 80%, 0.9)",
          fontFamily: "sans-serif",
          fontWeight: 300,
          letterSpacing: "0.15em",
          transform: `translateY(${subY}px)`,
          opacity: subOpacity,
        }}
      >
        ПЛАТФОРМА ДЛЯ ГРУЗЧИКОВ
      </div>
    </AbsoluteFill>
  );
};
