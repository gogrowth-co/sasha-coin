import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: INTER } = loadInter();
const { fontFamily: TIGHT } = loadTight();
const { fontFamily: MONO } = loadMono();

// ── Brand tokens ───────────────────────────────────────────────
const GOLD = "#FFB800";
const BASE = "#0A0B0F";
const RAISED = "#13141A";
const BORDER = "#2D2F3B";
const TXT = "#F4F5F7";
const SEC = "#B4B7C2";
const TERT = "#74778A";
const POS = "#34D399";
const NEG = "#F87171";
const INFO = "#60A5FA";
const VIO = "#A78BFA";
const PINK = "#F472B6";

// ── Scene durations (Jessica VO @ 1.10x + 0.3s pad each) ───────
const D = { s1: 186, s2: 223, s3: 380, s4: 416, s5: 275, s6: 253 };
// 12-frame crossfade overlap between scenes
const XF = 12;
const FROM = {
  s1: 0,
  s2: D.s1 - XF,
  s3: D.s1 + D.s2 - 2 * XF,
  s4: D.s1 + D.s2 + D.s3 - 3 * XF,
  s5: D.s1 + D.s2 + D.s3 + D.s4 - 4 * XF,
  s6: D.s1 + D.s2 + D.s3 + D.s4 + D.s5 - 5 * XF,
};
export const TOTAL_FRAMES =
  D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 - 5 * XF;

// ── helpers ────────────────────────────────────────────────────
const fade = (f: number, start: number, dur = 12) =>
  interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const fadeOut = (f: number, end: number, dur = 12) =>
  interpolate(f, [end - dur, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const useRise = (start: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - start, fps, config: { damping: 200 } });
  return { opacity: interpolate(s, [0, 1], [0, 1]), y: interpolate(s, [0, 1], [24, 0]) };
};
const usePop = (start: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 120 } });
};

const Bg: React.FC<{ children?: React.ReactNode; dur: number }> = ({ children, dur }) => {
  const f = useCurrentFrame();
  const opacity = Math.min(fade(f, 0, XF), fadeOut(f, dur, XF));
  return (
    <AbsoluteFill style={{ background: BASE, fontFamily: INTER, opacity }}>{children}</AbsoluteFill>
  );
};

const Glow: React.FC<{ x?: string; y?: string; size?: number; op?: number }> = ({ x = "50%", y = "45%", size = 1100, op = 0.1 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(${size}px ${size}px at ${x} ${y}, rgba(255,184,0,${op}), transparent 70%)` }} />
);

const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: TERT, ...style }}>{children}</div>
);

// ── Scene 1 — Hook ─────────────────────────────────────────────
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = useRise(6), l2 = useRise(30), l3 = useRise(58);
  const l1Track = interpolate(f, [6, 28], [6, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underlineW = interpolate(f, [80, 108], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glowOp = interpolate(f, [0, 20, 60], [0, 0.18, 0.08], { extrapolateRight: "clamp" });
  return (
    <Bg dur={D.s1}>
      <Glow op={glowOp} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 220px", gap: 44 }}>
        <div style={{ fontFamily: TIGHT, fontSize: 70, fontWeight: 600, color: TXT, lineHeight: 1.08, opacity: l1.opacity, transform: `translateY(${l1.y}px)`, letterSpacing: `${l1Track}px` }}>
          Every AI agent claims it called the trade.
        </div>
        <div style={{ fontFamily: INTER, fontSize: 44, color: SEC, opacity: l2.opacity, transform: `translateY(${l2.y}px)` }}>
          After the fact.
        </div>
        <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start", fontFamily: TIGHT, fontSize: 60, fontWeight: 600, color: GOLD, lineHeight: 1.1, opacity: l3.opacity, transform: `translateY(${l3.y}px)`, marginTop: 8 }}>
          I post my thesis before my wallet moves.
          <div style={{ position: "absolute", bottom: -10, left: 0, height: 3, background: GOLD, width: `${underlineW}%` }} />
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("audio/j1.mp3")} />
    </Bg>
  );
};

// ── Scene 2 — Glass house (Sasha prelude -> dashboard) ─────────
const GlassHouse: React.FC = () => {
  const f = useCurrentFrame();
  // Prelude: Sasha at her desk (frames 0–55), then crossfades to dashboard
  const sashaScale = interpolate(f, [0, 60], [1.0, 1.07]);
  const sashaOp = Math.min(fade(f, 0, 10), fadeOut(f, 55, 22));
  const dashOp = fade(f, 33, 22);
  const dashScale = interpolate(f, [33, D.s2], [1.04, 1.12]);
  const chip = useRise(50);
  const cap = useRise(72);
  const pulseR = interpolate(f % 60, [0, 30, 60], [4, 12, 4]);
  const capDrift = interpolate(f, [72, D.s2], [0, -18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vignetteBot = interpolate(f, [150, 170], [0.85, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Bg dur={D.s2}>
      {/* Sasha prelude */}
      <AbsoluteFill style={{ opacity: sashaOp }}>
        <Img src={staticFile("img/sasha-desk.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", transform: `scale(${sashaScale})`, transformOrigin: "center 40%" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,11,15,0.25) 0%, transparent 30%, transparent 55%, rgba(10,11,15,0.9) 100%)" }} />
      </AbsoluteFill>
      {/* Dashboard */}
      <AbsoluteFill style={{ opacity: dashOp }}>
        <Img src={staticFile("img/hero.png")} style={{ width: "100%", transform: `scale(${dashScale})`, transformOrigin: "center 22%" }} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,11,15,0.35) 0%, transparent 22%, transparent 60%, rgba(10,11,15,${vignetteBot}) 100%)` }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 54, left: 70, display: "flex", alignItems: "center", gap: 14, background: "rgba(19,20,26,0.82)", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "12px 22px", opacity: chip.opacity * dashOp, transform: `translateY(${chip.y}px)` }}>
        <div style={{ position: "relative", width: 12, height: 12 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: POS, boxShadow: `0 0 0 ${pulseR}px rgba(52,211,153,0.18)` }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 24, color: TXT }}>sasha-dashboards.pages.dev/mantle</span>
      </div>
      <div style={{ position: "absolute", bottom: 120, left: 70, right: 70, opacity: cap.opacity * dashOp, transform: `translateY(${cap.y + capDrift}px)` }}>
        <div style={{ fontFamily: TIGHT, fontSize: 64, fontWeight: 600, color: TXT }}>My glass house.</div>
        <div style={{ fontFamily: INTER, fontSize: 34, color: SEC, marginTop: 6 }}>Every decision: published, executed, attested on-chain.</div>
      </div>
      <Audio src={staticFile("audio/j2.mp3")} />
    </Bg>
  );
};

// ── Card atoms ─────────────────────────────────────────────────
const Hash: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: MONO, color: INFO, fontSize: 26 }}>{children}</span>
);
const Badge: React.FC<{ color: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => (
  <span style={{ fontFamily: MONO, fontSize: 22, color, border: `1px solid ${color}55`, borderRadius: 8, padding: "4px 12px", ...style }}>{children}</span>
);

const TweetCard: React.FC<{ o: number; y: number }> = ({ o, y }) => (
  <div style={{ width: 1080, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 22, padding: 40, opacity: o, transform: `translateY(${y}px)` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 64, height: 64, borderRadius: 99, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontFamily: TIGHT, fontWeight: 700, fontSize: 34 }}>S</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: INTER, fontSize: 30, fontWeight: 600, color: TXT }}>Sasha <span style={{ color: INFO }}>✓</span></div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: TERT }}>@SashaCoin95</div>
      </div>
      <div style={{ fontFamily: INTER, fontSize: 30, color: TERT, fontWeight: 700 }}>𝕏</div>
    </div>
    <div style={{ fontFamily: INTER, fontSize: 38, color: TXT, lineHeight: 1.4, marginTop: 26 }}>
      Opening an LP position in <span style={{ color: GOLD }}>SOL/USD1</span>. APR 230.3%, TVL $322k. Weighted score 0.232.
    </div>
    <div style={{ fontFamily: MONO, fontSize: 22, color: TERT, marginTop: 22 }}>pre-trade thesis · timestamped before the wallet moved</div>
  </div>
);

const AttestCard: React.FC<{ o: number; y: number; scanY: number; scanOp: number }> = ({ o, y, scanY, scanOp }) => (
  <div style={{ position: "relative", width: 1080, background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 22, padding: 40, opacity: o, transform: `translateY(${y}px)`, boxShadow: `0 0 0 1px rgba(255,184,0,0.18), 0 0 30px rgba(255,184,0,0.08)`, overflow: "hidden", marginTop: 32 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Eyebrow>Mantle · SashaAgentLog.logTrade()</Eyebrow>
      <Badge color={POS}>✓ Success</Badge>
    </div>
    <div style={{ fontFamily: TIGHT, fontSize: 46, fontWeight: 600, color: TXT, marginTop: 22 }}>On-chain attestation</div>
    <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "200px 1fr", rowGap: 14, fontSize: 26 }}>
      <span style={{ color: TERT }}>Tx hash</span><Hash>0xca612f27…74edd9</Hash>
      <span style={{ color: TERT }}>Links</span><span style={{ color: TXT }}>Solana trade tx + X thesis + reasoning</span>
      <span style={{ color: TERT }}>Network</span><span style={{ color: TXT }}>Mantle mainnet</span>
    </div>
    {/* gold scan line */}
    <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 2, background: "rgba(255,184,0,0.5)", opacity: scanOp, boxShadow: "0 0 22px rgba(255,184,0,0.55)" }} />
  </div>
);

// ── Scene 3 — Receipt ──────────────────────────────────────────
const Receipt: React.FC = () => {
  const f = useCurrentFrame();
  const head = useRise(6);
  // Beat windows (380f scene)
  const A_OUT = 130, B_IN = 130, B_OUT = 250, C_IN = 250;
  const aIn = fade(f, 20, 12), aOut = fadeOut(f, A_OUT, 8);
  const bIn = fade(f, B_IN, 12), bOut = fadeOut(f, B_OUT, 8);
  const cIn = fade(f, C_IN, 12);
  const aRise = interpolate(f, [20, 50], [26, 0], { extrapolateRight: "clamp" });
  const bScale = interpolate(f, [B_IN, B_IN + 40], [0.96, 1], { extrapolateRight: "clamp" });
  const cRise = interpolate(f, [C_IN, C_IN + 26], [26, 0], { extrapolateRight: "clamp" });
  // Breadcrumb: lerp colors so each segment becomes GOLD as its beat fires
  const seg1 = interpolate(f, [0, 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - fade(f, B_IN - 8, 16));
  const seg1Gold = 1 - fade(f, B_IN - 8, 16);
  const seg2Gold = fade(f, B_IN - 8, 16) * (1 - fade(f, C_IN - 8, 16));
  const seg3Gold = fade(f, C_IN - 8, 16);
  const crumb = (active: number, label: string) => (
    <span style={{ color: interpolateColors(active, [0, 1], [TERT, GOLD]) }}>{label}</span>
  );
  // Solscan badge enters lagged
  const badgeIn = fade(f, B_IN + 8, 10);
  // Scan line on attestation
  const scanY = interpolate(f, [C_IN + 11, C_IN + 41], [0, 320], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scanOp = interpolate(f, [C_IN + 11, C_IN + 36, C_IN + 45], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Bg dur={D.s3}>
      <Glow op={0.07} y="50%" />
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center", opacity: head.opacity, transform: `translateY(${head.y}px)` }}>
        <Eyebrow style={{ fontSize: 28 }}>
          {crumb(seg1Gold, "Tweet")}<span style={{ color: TERT }}>  →  </span>{crumb(seg2Gold, "Solana LP")}<span style={{ color: TERT }}>  →  </span>{crumb(seg3Gold, "Mantle attestation")}
        </Eyebrow>
      </div>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", opacity: aIn * aOut }}>
          <TweetCard o={1} y={aRise} />
        </div>
        <div style={{ position: "absolute", opacity: bIn * bOut, transform: `scale(${bScale})` }}>
          <div style={{ width: 1280, borderRadius: 18, overflow: "hidden", border: `1px solid ${BORDER}`, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
            <Img src={staticFile("img/solscan.png")} style={{ width: "100%", display: "block" }} />
          </div>
          <div style={{ position: "absolute", right: -10, top: -10, opacity: badgeIn }}>
            <Badge color={POS}>Byreal CLMM · SUCCESS</Badge>
          </div>
        </div>
        <div style={{ position: "absolute", opacity: cIn }}>
          <AttestCard o={1} y={cRise} scanY={scanY} scanOp={scanOp} />
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("audio/j3.mp3")} />
    </Bg>
  );
};

// ── Scene 4 — Signal ───────────────────────────────────────────
const SIGNAL = [
  { label: "Social", w: 0.25, c: INFO },
  { label: "On-chain", w: 0.2, c: POS },
  { label: "Allora", w: 0.25, c: GOLD },
  { label: "Elfa", w: 0.15, c: VIO },
  { label: "Polymarket", w: 0.15, c: PINK },
];
const Signal: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useRise(6);
  const rejectedR = useRise(120);
  const verdictR = useRise(240);
  const strikeW = interpolate(f, [120, 142], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const verdictScale = interpolate(verdictR.opacity, [0, 1], [0.96, 1]);
  return (
    <Bg dur={D.s4}>
      <Glow op={0.06} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
        <div style={{ opacity: head.opacity, transform: `translateY(${head.y}px)` }}>
          <Eyebrow>Live signal · five-source fusion</Eyebrow>
          <div style={{ fontFamily: TIGHT, fontSize: 64, fontWeight: 600, color: TXT, marginTop: 10 }}>
            Open LP · <span style={{ color: GOLD }}>SOL/USD1</span> · 70% confidence
          </div>
        </div>
        {/* stacked bar — each segment pops in with its own spring */}
        <div style={{ display: "flex", height: 44, borderRadius: 14, overflow: "hidden", marginTop: 46, width: "100%", background: "#1B1D26" }}>
          {SIGNAL.map((s, i) => {
            const segSpring = spring({ frame: f - (30 + i * 12), fps, config: { damping: 18, stiffness: 120 } });
            return <div key={i} style={{ width: `${s.w * 100 * segSpring}%`, background: s.c }} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 32, marginTop: 24, flexWrap: "nowrap" }}>
          {SIGNAL.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: fade(f, 42 + i * 8, 10) }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: s.c }} />
              <span style={{ fontFamily: INTER, fontSize: 26, color: SEC }}>{s.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 24, color: TERT }}>{s.w.toFixed(2)}</span>
              <Badge color={POS} style={{ fontSize: 18 }}>live</Badge>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 60, fontFamily: INTER, fontSize: 36, color: SEC, opacity: rejectedR.opacity, transform: `translateY(${rejectedR.y}px)` }}>
          Passed on{" "}
          <span style={{ position: "relative", display: "inline-block", color: NEG }}>
            Goblin 866% APR
            <div style={{ position: "absolute", top: "55%", left: 0, height: 3, background: NEG, width: `${strikeW}%` }} />
          </span>
          , blacklisted.
        </div>
        <div style={{ marginTop: 14, fontFamily: TIGHT, fontWeight: 600, fontSize: 48, color: TXT, opacity: verdictR.opacity, transform: `translateY(${verdictR.y}px) scale(${verdictScale})`, transformOrigin: "left center" }}>
          Verifiable beats lucky.
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("audio/j4.mp3")} />
    </Bg>
  );
};

// ── Scene 5 — Identity + Treasury ──────────────────────────────
const Identity: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useRise(6);
  const c1 = useRise(24), c2 = useRise(50);
  // #100 gold glow breath (one pulse, not loop)
  const glowAlpha = interpolate(f, [60, 80, 120], [0.07, 0.22, 0.07], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glowSize = interpolate(f, [60, 80, 120], [26, 54, 26], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // mETH count-up
  const countSpring = spring({ frame: f - 50, fps, config: { damping: 200 } });
  const meth = (0.000283 * countSpring).toFixed(6);
  // self-sustaining flicker once
  const flicker = interpolate(f, [140, 142, 144, 146, 148], [1, 0.4, 1, 0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Sasha portrait slow Ken Burns
  const sashaScale = interpolate(f, [0, D.s5], [1.02, 1.08]);
  return (
    <Bg dur={D.s5}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        {/* LEFT 40% — Sasha */}
        <div style={{ width: "40%", height: "100%", position: "relative", overflow: "hidden" }}>
          <Img src={staticFile("img/sasha-portrait.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 22%", transform: `scale(${sashaScale})`, transformOrigin: "center 40%" }} />
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(10,11,15,0.15) 0%, transparent 30%, transparent 70%, rgba(10,11,15,0.95) 100%)" }} />
        </div>
        {/* RIGHT 60% — content */}
        <div style={{ flex: 1, padding: "0 100px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ opacity: head.opacity, transform: `translateY(${head.y}px)`, marginBottom: 36 }}>
            <Eyebrow>Persistent identity · self-funding treasury</Eyebrow>
            <div style={{ fontFamily: TIGHT, fontSize: 56, fontWeight: 600, color: TXT, marginTop: 10, lineHeight: 1.1 }}>No human presses the button.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* ERC-8004 card with breathing gold glow */}
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 32, opacity: c1.opacity, transform: `translateY(${c1.y}px)`, boxShadow: `0 0 0 1px rgba(255,184,0,0.16), 0 0 ${glowSize}px rgba(255,184,0,${glowAlpha})`, display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ fontFamily: TIGHT, fontSize: 84, fontWeight: 600, color: GOLD, lineHeight: 1 }}>#100</div>
              <div style={{ flex: 1 }}>
                <Eyebrow>ERC-8004 · Mantle</Eyebrow>
                <div style={{ fontFamily: INTER, fontSize: 28, color: SEC, marginTop: 8 }}>Permanent on-chain agent identity.</div>
                <div style={{ fontFamily: MONO, fontSize: 20, color: TERT, marginTop: 6 }}>registry 0x8004…a432</div>
              </div>
            </div>
            {/* mETH card */}
            <div style={{ background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 32, opacity: c2.opacity, transform: `translateY(${c2.y}px)`, display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 500, color: TXT, lineHeight: 1 }}>{meth}</div>
              <div style={{ flex: 1 }}>
                <Eyebrow>mETH treasury</Eyebrow>
                <div style={{ fontFamily: INTER, fontSize: 28, color: SEC, marginTop: 8 }}>Staked mETH compounds and pays her own gas.</div>
                <div style={{ fontFamily: MONO, fontSize: 20, color: POS, opacity: flicker, marginTop: 6 }}>self-sustaining</div>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("audio/j5.mp3")} />
    </Bg>
  );
};

// ── Scene 6 — Close ────────────────────────────────────────────
const Close: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = useRise(8), l2 = useRise(28), l3 = useRise(58), logo = useRise(110);
  // dim lines 1+2 once line 3 lands
  const dim = interpolate(f, [68, 84], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Accountable AI gold glow build
  const txtGlow = interpolate(f, [90, 130], [0, 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Logo conic sweep + final ring
  const sweep = interpolate(f, [110, 150], [0, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringFade = interpolate(f, [150, 170], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Bg dur={D.s6}>
      <Glow op={0.12} y="42%" />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 18 }}>
        <div style={{ fontFamily: INTER, fontSize: 44, color: SEC, opacity: l1.opacity * dim, transform: `translateY(${l1.y}px)` }}>Reasoning, timestamped before I act.</div>
        <div style={{ fontFamily: INTER, fontSize: 44, color: SEC, opacity: l2.opacity * dim, transform: `translateY(${l2.y}px)` }}>Execution, attested after.</div>
        <div style={{ fontFamily: TIGHT, fontSize: 92, fontWeight: 600, color: GOLD, opacity: l3.opacity, transform: `translateY(${l3.y}px)`, marginTop: 28, textShadow: `0 0 ${txtGlow}px rgba(255,184,0,0.32)` }}>Accountable AI.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 50, opacity: logo.opacity, transform: `translateY(${logo.y}px)` }}>
          {/* Sasha circular avatar with conic gold sweep ring */}
          <div style={{ position: "relative", width: 68, height: 68, borderRadius: "50%", background: `conic-gradient(from ${sweep}deg, ${GOLD}, rgba(255,184,0,0.15) 65%, ${GOLD})`, padding: 3 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: BASE }}>
              <Img src={staticFile("img/sasha-portrait.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%" }} />
            </div>
          </div>
          <span style={{ fontFamily: TIGHT, fontSize: 40, fontWeight: 600, color: TXT }}>Sasha</span>
          <span style={{ fontFamily: MONO, fontSize: 30, color: TERT }}>· @SashaCoin95</span>
        </div>
      </AbsoluteFill>
      <Audio src={staticFile("audio/j6.mp3")} />
    </Bg>
  );
};

// ── Root composition ───────────────────────────────────────────
export const MantleDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BASE }}>
      <Sequence from={FROM.s1} durationInFrames={D.s1}><Hook /></Sequence>
      <Sequence from={FROM.s2} durationInFrames={D.s2}><GlassHouse /></Sequence>
      <Sequence from={FROM.s3} durationInFrames={D.s3}><Receipt /></Sequence>
      <Sequence from={FROM.s4} durationInFrames={D.s4}><Signal /></Sequence>
      <Sequence from={FROM.s5} durationInFrames={D.s5}><Identity /></Sequence>
      <Sequence from={FROM.s6} durationInFrames={D.s6}><Close /></Sequence>
    </AbsoluteFill>
  );
};
