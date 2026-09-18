import { Composition, Img, staticFile, useCurrentFrame, interpolate, spring, Easing, AbsoluteFill } from 'remotion';

const COLORS = {
  bg: '#07090D',
  panel: '#101620',
  text: '#F4F7FA',
  muted: '#A7B4C5',
  faint: '#6E7D90',
  orange: '#FF9F45',
  cyan: '#58C7F0',
};

const FPS = 30;
const DURATION = 570;

export const MyComposition = () => {
  return <Composition id="CutawayPromo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />;
};

function Promo() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' }}>
      <Backdrop />
      <Scene start={0} end={95}>
        <BrandScene />
      </Scene>
      <Scene start={78} end={180}>
        <FeatureScene
          kicker="A LIBRARY OF REAL OBJECTS"
          title="Start with curiosity."
          body="Explore the things around you in interactive 3D."
          image="screens/library.png"
          accent={COLORS.cyan}
          tags={['ELECTRONICS', 'MECHANICAL', 'ANATOMY']}
        />
      </Scene>
      <Scene start={168} end={270}>
        <FeatureScene
          kicker="ROTATE / ZOOM / RUN"
          title="See how the pieces move."
          body="Turn every object over. Follow the mechanism from input to output."
          image="screens/fridge.png"
          accent="#5ED9D8"
          tags={['ROTATE', 'ZOOM', 'RUN']}
        />
      </Scene>
      <Scene start={258} end={360}>
        <FeatureScene
          kicker="EXPLODE / PEEL / CUT"
          title="Look inside the surface."
          body="Separate the layers until the hidden structure makes sense."
          image="screens/explode.png"
          accent={COLORS.orange}
          tags={['EXPLODE', 'PEEL', 'X-RAY']}
        />
      </Scene>
      <Scene start={348} end={450}>
        <FeatureScene
          kicker="PARTS + STORIES"
          title="Every part has a job."
          body="Tap a component, learn its role, then connect the whole story."
          image="screens/parts.png"
          accent="#C88BFF"
          tags={['TAP A PART', 'READ', 'CONNECT']}
        />
      </Scene>
      <Scene start={438} end={520}>
        <QuizScene />
      </Scene>
      <Scene start={500} end={DURATION}>
        <FinalScene />
      </Scene>
    </AbsoluteFill>
  );
}

function Backdrop() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, DURATION], [-50, 70], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(130deg, #07090D 0%, #0C1420 52%, #07090D 100%)' }}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          right: -260,
          top: -360,
          borderRadius: 900,
          border: `2px solid ${COLORS.orange}`,
          opacity: 0.2,
          transform: `translate(${drift}px, ${drift * 0.35}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 620,
          height: 620,
          left: -280,
          bottom: -310,
          borderRadius: 620,
          backgroundColor: COLORS.cyan,
          opacity: 0.055,
          transform: `translate(${-drift * 0.35}px, ${drift * 0.25}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.15,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
        }}
      />
    </AbsoluteFill>
  );
}

function Scene({ start, end, children }: { start: number; end: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 16, end - 16, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.ease,
  });
  const y = interpolate(frame, [start, start + 18, end - 18, end], [30, 0, 0, -22], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return <AbsoluteFill style={{ opacity, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
}

function BrandScene() {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 90, mass: 0.7 } });
  const line = interpolate(frame, [12, 72], [0, 540], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 42, transform: `scale(${0.84 + scale * 0.16})` }}>
        <Img src={staticFile('cutaway-icon.png')} style={{ width: 190, height: 190, borderRadius: 48 }} />
        <div>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -4 }}>Cutaway</div>
          <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 42, letterSpacing: 1 }}>3D Objects</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 168, left: 690, width: line, height: 4, backgroundColor: COLORS.orange }} />
      <div style={{ position: 'absolute', bottom: 128, color: COLORS.muted, fontSize: 28, letterSpacing: 6 }}>LOOK INSIDE EVERYTHING</div>
    </AbsoluteFill>
  );
}

function FeatureScene({ kicker, title, body, image, accent, tags }: { kicker: string; title: string; body: string; image: string; accent: string; tags: string[] }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 132px', gap: 110 }}>
      <div style={{ flex: 1, paddingBottom: 14 }}>
        <Kicker text={kicker} accent={accent} />
        <h1 style={{ margin: '26px 0 24px', fontSize: 76, lineHeight: 1.04, letterSpacing: -3, fontWeight: 700, whiteSpace: 'pre-line' }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 610, color: COLORS.muted, fontSize: 34, lineHeight: 1.25 }}>{body}</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 50, flexWrap: 'wrap' }}>
          {tags.map((tag, index) => <Tag key={tag} text={tag} accent={accent} delay={index * 5} frame={frame} />)}
        </div>
      </div>
      <DeviceCard src={image} accent={accent} enter={10} />
    </AbsoluteFill>
  );
}

function QuizScene() {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame % 45, [0, 22, 45], [0.88, 1, 0.88], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 132px', gap: 110 }}>
      <div style={{ flex: 1 }}>
        <Kicker text="LEARN BY DOING" accent={COLORS.orange} />
        <h1 style={{ margin: '26px 0 24px', fontSize: 80, lineHeight: 1.02, letterSpacing: -3, fontWeight: 700 }}>Learn it.<br />Then prove it.</h1>
        <p style={{ margin: 0, maxWidth: 610, color: COLORS.muted, fontSize: 34, lineHeight: 1.25 }}>Interactive quizzes turn curiosity into understanding.</p>
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: 22, backgroundColor: COLORS.orange, transform: `scale(${pulse})` }} />
          <span style={{ color: COLORS.text, fontSize: 26, letterSpacing: 1 }}>ROTATE · IDENTIFY · REMEMBER</span>
        </div>
      </div>
      <DeviceCard src="screens/quiz.png" accent={COLORS.orange} enter={10} position="bottom" />
    </AbsoluteFill>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const progress = spring({ frame: Math.max(0, frame - 500), fps: FPS, config: { damping: 18, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Img src={staticFile('cutaway-icon.png')} style={{ width: 150, height: 150, borderRadius: 38, transform: `scale(${0.86 + progress * 0.14})` }} />
      <div style={{ marginTop: 26, fontSize: 74, fontWeight: 700, letterSpacing: -3 }}>Cutaway: 3D Objects</div>
      <div style={{ marginTop: 18, color: COLORS.muted, fontSize: 34 }}>Interactive 3D learning for curious minds.</div>
      <div style={{ marginTop: 46, padding: '16px 28px', border: `1px solid ${COLORS.orange}`, borderRadius: 30, color: COLORS.orange, fontSize: 21, fontWeight: 700, letterSpacing: 3 }}>AVAILABLE ON GOOGLE PLAY</div>
    </AbsoluteFill>
  );
}

function DeviceCard({ src, accent, enter, position = 'top' }: { src: string; accent: string; enter: number; position?: string }) {
  const frame = useCurrentFrame();
  const progress = spring({ frame: Math.max(0, frame - enter), fps: FPS, config: { damping: 18, stiffness: 100, mass: 0.8 } });
  const rotate = interpolate(progress, [0, 1], [3, 0]);
  return (
    <div
      style={{
        width: 486,
        height: 884,
        flexShrink: 0,
        borderRadius: 42,
        padding: 12,
        backgroundColor: '#131D29',
        border: `2px solid ${accent}`,
        boxShadow: `0 26px 90px rgba(0,0,0,.46), 0 0 54px ${accent}22`,
        overflow: 'hidden',
        transform: `translateY(${(1 - progress) * 46}px) scale(${0.92 + progress * 0.08}) rotate(${rotate}deg)`,
      }}
    >
      <div style={{ height: '100%', borderRadius: 32, overflow: 'hidden', backgroundColor: '#07090D' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position }} />
      </div>
      <div style={{ position: 'absolute', top: 28, right: 28, width: 12, height: 12, borderRadius: 12, backgroundColor: accent }} />
    </div>
  );
}

function Kicker({ text, accent }: { text: string; accent: string }) {
  return <div style={{ color: accent, fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>{text}</div>;
}

function Tag({ text, accent, delay, frame }: { text: string; accent: string; delay: number; frame: number }) {
  const progress = spring({ frame: Math.max(0, frame - delay), fps: FPS, config: { damping: 18, stiffness: 120 } });
  return <div style={{ padding: '12px 18px', borderRadius: 24, border: `1px solid ${accent}88`, color: COLORS.text, fontSize: 18, letterSpacing: 2, opacity: progress, transform: `translateY(${(1 - progress) * 12}px)` }}>{text}</div>;
}
