import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile, Sequence } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

const transitionTiming = springTiming({ config: { damping: 200 }, durationInFrames: 15 });

// Phone mockup component
const PhoneMockup: React.FC<{
  src: string;
  label: string;
  description: string;
  enterFrom?: "left" | "right" | "bottom";
}> = ({ src, label, description, enterFrom = "right" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const phoneX = enterFrom === "left" 
    ? interpolate(s, [0, 1], [-400, 0])
    : enterFrom === "right"
    ? interpolate(s, [0, 1], [400, 0])
    : 0;
  const phoneY = enterFrom === "bottom"
    ? interpolate(s, [0, 1], [300, 0])
    : 0;
  const phoneOpacity = interpolate(s, [0, 1], [0, 1]);

  const textS = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 100 } });
  const textOpacity = interpolate(textS, [0, 1], [0, 1]);
  const textX = interpolate(textS, [0, 1], [enterFrom === "left" ? 60 : -60, 0]);

  // Subtle floating
  const floatY = Math.sin(frame * 0.03) * 5;

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 80 }}>
      {/* Phone */}
      <div
        style={{
          transform: `translateX(${phoneX}px) translateY(${phoneY + floatY}px)`,
          opacity: phoneOpacity,
          position: "relative",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 320,
            height: 660,
            borderRadius: 40,
            border: "4px solid hsla(230, 30%, 40%, 0.6)",
            overflow: "hidden",
            boxShadow: "0 30px 80px hsla(230, 60%, 10%, 0.8), 0 0 40px hsla(230, 60%, 50%, 0.15)",
            background: "#000",
          }}
        >
          {/* Notch */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 120,
              height: 28,
              background: "#000",
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              zIndex: 10,
            }}
          />
          <Img
            src={staticFile(`images/${src}`)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>

      {/* Text description */}
      <div
        style={{
          maxWidth: 500,
          transform: `translateX(${textX}px)`,
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "hsl(230, 60%, 65%)",
            fontFamily: "sans-serif",
            letterSpacing: "0.15em",
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 800,
            color: "white",
            fontFamily: "sans-serif",
            lineHeight: 1.2,
          }}
        >
          {description}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Title scene
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 12, stiffness: 60, mass: 1.5 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  const subS = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 100 } });
  const subOpacity = interpolate(subS, [0, 1], [0, 1]);
  const subY = interpolate(subS, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(230, 60%, 58%), hsl(260, 70%, 65%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 30px",
            transform: `scale(${scale})`,
            opacity,
            boxShadow: "0 0 60px hsla(230, 70%, 50%, 0.4)",
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 800, color: "white", fontFamily: "sans-serif" }}>Г</span>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "white",
            fontFamily: "sans-serif",
            transform: `scale(${scale})`,
            opacity,
            marginBottom: 16,
          }}
        >
          Как работает Грузли
        </div>
        <div
          style={{
            fontSize: 24,
            color: "hsla(230, 20%, 75%, 0.8)",
            fontFamily: "sans-serif",
            fontWeight: 300,
            transform: `translateY(${subY}px)`,
            opacity: subOpacity,
          }}
        >
          Полный обзор мобильного приложения
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Closing scene
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const scale = interpolate(s, [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          textAlign: "center",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(230, 60%, 58%), hsl(260, 70%, 65%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 0 50px hsla(230, 70%, 50%, 0.3)",
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 800, color: "white", fontFamily: "sans-serif" }}>Г</span>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: "white", fontFamily: "sans-serif", marginBottom: 16 }}>
          Всё в одном приложении
        </div>
        <div style={{ fontSize: 22, color: "hsl(230, 60%, 70%)", fontFamily: "sans-serif" }}>
          gruzli.lovable.app
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Background
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at ${35 + Math.sin(frame * 0.008) * 10}% ${45 + Math.cos(frame * 0.006) * 10}%, 
            hsl(230, 55%, 16%) 0%, hsl(228, 22%, 8%) 55%, hsl(225, 25%, 5%) 100%)`,
        }}
      />
      {[0, 1].map(i => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 300 + i * 800 + Math.sin(frame * 0.01 + i) * 100,
            top: 200 + Math.cos(frame * 0.012 + i * 3) * 100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: `radial-gradient(circle, hsla(${230 + i * 30}, 60%, 50%, 0.06), transparent 70%)`,
            filter: "blur(50px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export const AppWalkthrough: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <TitleScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <PhoneMockup
            src="screen-feed.png"
            label="Главная — Лента заявок"
            description="Находите заказы рядом с AI-поиском. Фильтры по срочности и типу работы"
            enterFrom="right"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <PhoneMockup
            src="screen-job-detail.png"
            label="Детали заказа"
            description="Полная информация: оплата, время, количество грузчиков. Один клик — откликнуться"
            enterFrom="left"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <PhoneMockup
            src="screen-orders.png"
            label="Мои заказы"
            description="Все активные заказы в одном месте. Статусы, дедлайны, завершение работы"
            enterFrom="right"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <PhoneMockup
            src="screen-chats.png"
            label="Чаты"
            description="Мгновенные сообщения с диспетчерами. AI-модерация защищает от спама"
            enterFrom="left"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <PhoneMockup
            src="screen-kartoteka.png"
            label="Картотека"
            description="Реестр недобросовестных исполнителей. Безопасность для всех участников"
            enterFrom="bottom"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <PhoneMockup
            src="screen-profile.png"
            label="Профиль"
            description="Заработок, рейтинг, Premium-статус и виртуальная банковская карта"
            enterFrom="right"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transitionTiming} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <ClosingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
