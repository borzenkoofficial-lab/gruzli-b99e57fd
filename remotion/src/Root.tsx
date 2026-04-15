import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 5 scenes: Intro(120) + Core(180) + AI(240) + Workflow(150) + Closing(120) = 810
// Transitions: 4 x 20 = 80 overlap
// Total: 810 - 80 = 730 frames ~ 24.3s at 30fps
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={730}
    fps={30}
    width={1920}
    height={1080}
  />
);
