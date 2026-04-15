import { Composition } from "remotion";
import { AppWalkthrough } from "./AppWalkthrough";

// 7 scenes: Title(90) + Feed(120) + JobDetail(100) + Orders(100) + Chats(100) + Kartoteka(90) + Profile(100) + Closing(90)
// = 790 frames, 7 transitions x 15 = 105 overlap => 790 - 105 = 685 frames ~22.8s
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={AppWalkthrough}
    durationInFrames={685}
    fps={30}
    width={1920}
    height={1080}
  />
);
