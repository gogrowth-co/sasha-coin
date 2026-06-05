import { Composition } from "remotion";
import { MantleDemo, TOTAL_FRAMES } from "./MantleDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MantleDemo"
      component={MantleDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
