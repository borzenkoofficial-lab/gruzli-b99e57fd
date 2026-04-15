import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  
  const hueShift = interpolate(frame, [0, 730], [0, 30]);
  const x1 = interpolate(frame, [0, 730], [0, 200]);
  const y1 = interpolate(frame, [0, 730], [0, 100]);
  
  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `
            radial-gradient(ellipse at ${30 + Math.sin(frame * 0.01) * 10}% ${40 + Math.cos(frame * 0.008) * 10}%, 
              hsl(${230 + hueShift}, 60%, 18%) 0%, 
              hsl(${228 + hueShift}, 20%, 8%) 60%, 
              hsl(${225 + hueShift}, 25%, 5%) 100%)
          `,
        }}
      />
      {/* Floating orbs */}
      {[0, 1, 2].map((i) => {
        const ox = interpolate(frame, [0, 730], [200 + i * 500, 400 + i * 400], { extrapolateRight: "clamp" });
        const oy = 300 + Math.sin(frame * 0.015 + i * 2) * 150;
        const opacity = 0.08 + Math.sin(frame * 0.02 + i) * 0.03;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ox,
              top: oy,
              width: 500 + i * 100,
              height: 500 + i * 100,
              borderRadius: "50%",
              background: `radial-gradient(circle, hsla(${230 + i * 20}, 70%, 50%, ${opacity}), transparent 70%)`,
              filter: "blur(60px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
