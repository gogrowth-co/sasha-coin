# Motion Brief v2 — Mantle Demo

**Status:** Design direction locked. No composition edits. Motion additions only.
**Target duration:** Under 60s. Trim D.s3 from 428 to ~360 frames (12s). Trim D.s4 from 428 to ~360. Current total 1971f (~65.7s). Target: ~1740f (~58s).

---

## Global rules (apply to every scene)

**Scene transitions:** No hard cuts. Use a shared 12-frame crossfade on the `Sequence` container: fade the outgoing scene to opacity 0 over frames [D-12, D], fade the incoming from 0 over [0, 12]. Both sequences overlap by 12 frames. Do not add motion to what is already fading — just opacity. One global helper: `const xfade = (f, dur) => interpolate(f, [dur-12, dur], [1, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp' })`.

**Timing feel:** `spring({ damping: 18, stiffness: 120 })` for entrance pops. `spring({ damping: 200 })` (the existing useRise config) stays for text lines — it is settled and right. Use the tighter spring only for the new micro-interactions below.

**No parallax layers, no blur-in, no scale-bounce on text.** Motion should read as the system doing its job, not performing.

---

## Scene 1 — Hook

**Current state:** Three lines rise in with `useRise`. Clean. Flat.

**Motion additions:**

1. **Gold underline draw on line 3.** After line 3 reaches full opacity (around frame 80), draw a 3px-high gold bar beneath it: `width: interpolate(f, [80, 108], ['0%', '100%'])`. Position it as a div with `position:'absolute', bottom:-6, left:0, height:3, background:GOLD`. Container for line 3 needs `position:'relative'`. The draw takes 28 frames (under 1 second) and reads as a timestamp being confirmed.

2. **Micro-stagger on H1 word spacing.** Line 1 currently enters as one block. Add `letterSpacing: interpolate(f, [6, 28], [6, 0.5])` so the heading arrives slightly wide and settles to normal tracking. Only on line 1. Do not apply to lines 2 or 3. This is subtle — 0.5px landed vs 6px on entry.

3. **Glow pulse on entry frame.** The existing `<Glow op={0.08}/>` is static. Replace it with `op={interpolate(f, [0, 20, 60], [0, 0.18, 0.08])}`. A brief bloom at frame 20, then it settles back. One gold breath as the scene opens.

**Layout polish:** Left-align is correct. The gap between line 2 ("After the fact.") and line 3 is currently 28px — increase to 44px. The size contrast (70 / 40 / 60) is strong but line 2 at 40px in `SEC` color reads as a footnote. Bump line 2 to 44px so it has its own weight.

---

## Scene 2 — Glass House

**Current state:** Slow zoom on dashboard image, URL chip rises, caption rises. The zoom is the only motion and it reads as a screensaver.

**Motion additions:**

1. **Parallax vertical drift on caption.** The caption currently enters once and stays. Add a continuous slow upward creep: `transform: translateY(${interpolate(f, [28, D.s2], [cap.y, cap.y - 18])}px)`. 18px over the full scene is imperceptible as drift but gives a sense of weight shifting.

2. **URL chip pulse dot.** The green dot in the chip is static. Add a CSS-in-JS pulse ring: second `<div>` behind the dot with `boxShadow: \`0 0 0 \${interpolate(f % 60, [0, 30, 60], [4, 10, 4])}px rgba(52,211,153,0.12)\``. 60-frame cycle. This is the single "live" signal in the scene — the rest stays still.

3. **Bottom vignette intensifies on VO cue.** At frame 150 (the word "attested"), animate the gradient overlay's bottom opacity from 0.85 to 0.95: `interpolate(f, [150, 170], [0.85, 0.95])`. This is barely visible but draws the eye down to the caption just before the scene ends.

**Layout polish:** The caption "My glass house." at 64px sits very close to the bottom edge. Add `bottom: 120px` instead of `bottom: 90px`. The URL chip at `top: 54, left: 70` is well-placed. No change.

---

## Scene 3 — Receipt

**Current state:** Three beats cross-fade (tweet, solscan, attestation). The eyebrow label is gold and uppercase. The cards enter with opacity and translateY. Flat.

**Motion additions:**

1. **Scan-line sweep on attestation card entry (Beat C only).** At frame 285, after the card fades in, run a single scan line: a `<div>` with `height:2, background:'rgba(255,184,0,0.4)', position:'absolute', left:0, right:0, top: interpolate(f, [296, 326], [0, cardHeight])`. Clipped to the card's height via `overflow:'hidden'` on the card wrapper. Runs once, 30 frames, then `opacity: interpolate(f, [326, 330], [1, 0])`. This is the single gold moment in Scene 3. The tweet and solscan cards do not get this treatment.

2. **Beat connector: eyebrow arrows animate.** The eyebrow "Tweet -> Solana LP -> Mantle attestation" is static gold text. Replace with three spans. On Beat A entry, only "Tweet" is at `color: GOLD`, the arrows and subsequent words at `color: TERT`. On Beat B (frame 150), "Solana LP" transitions to `color: GOLD`, "Tweet" drops to `color: TERT`. On Beat C (frame 285), "Mantle attestation" to GOLD. Use `interpolate(f, [beat-8, beat+8], [0,1])` to lerp between the two color values via opacity on an overlay span. This makes the breadcrumb act as a live progress indicator.

3. **Solscan screenshot scale-in refinement.** Currently `bScale` goes from 0.96 to 1 over 30 frames. Extend to 40 frames and add a matching `opacity` that peaks at 1.0 then holds. Also: the badge `<Badge color={POS}>Byreal CLMM · SUCCESS</Badge>` at `right:-10, top:-10` should enter 8 frames after the card with `opacity: fade(f, 158, 10)` instead of inheriting parent opacity. Slight lag reads as the badge confirming the tx rather than appearing with the card.

**Layout polish:** Beat C (attestation card) is centered but feels like it is floating. Add `marginTop: 32` to vertically bias it 32px below true center. The card at 1080px width against 1920px canvas has appropriate breathing room.

---

## Scene 4 — Five-Source Signal

**Current state:** Single `grow` interpolation wipes the full bar from 0% to 100% width. Legend items fade in with 6-frame stagger. Flat, mechanical.

**Motion additions:**

1. **Segments enter as 5 individual spring pops, not one wipe.** Replace the single `grow` interpolation with per-segment springs. Each segment: `const segSpring = spring({ frame: f - (30 + i * 12), fps, config: { damping: 18, stiffness: 120 } })`. Width becomes `\`\${s.w * 100 * segSpring}%\``. Segment 0 starts at frame 30, segment 4 starts at frame 78. The bar builds left-to-right but each segment pops in with its own elastic snap rather than a continuous fill. The spring config should produce a brief 4-6% overshoot — it reads as confidence, not mechanical precision.

2. **Goblin "blacklisted" strike-through animation.** Currently "Goblin 866% APR" is static red text. When the `rejected` spring fires (frame 150), add a strike-through line that draws from left: `<div style={{ position:'absolute', top:'50%', left:0, height:2, background:NEG, width: interpolate(f, [150, 172], ['0%', '100%']) }} />`. Wrap the span in `position:'relative', display:'inline-block'`. 22-frame draw. This is the clearest visual payoff in the scene.

3. **"Verifiable beats lucky" — slight scale entrance.** The verdict line currently uses `useRise`. Add `transform: \`translateY(\${verdict.y}px) scale(\${interpolate(verdict.opacity, [0, 1], [0.96, 1])})\``. 4% scale-up as it enters. Reinforces authority without over-animating.

**Layout polish:** The weight bar at 34px height is thin at 1920x1080. Increase to 44px. The legend wraps to two lines (Polymarket orphans on line 2). Set `gap: 32` and confirm all five fit on one line at this canvas width — they should at 28px font size with gap 32.

---

## Scene 5 — Identity + Treasury

**Current state:** Two cards rise in with staggered useRise (c1 offset 24, c2 offset 50). The #100 has a gold box-shadow. Static after entry.

**Motion additions:**

1. **Gold glow on #100 breathes once.** After the ERC card lands (around frame 60), animate the card's `boxShadow` from the resting value to a brief brighter state and back: `interpolate(f, [60, 80, 120], [0.07, 0.22, 0.07])` on the alpha of the gold glow. One pulse, not a loop. `boxShadow: \`0 0 0 1px rgba(255,184,0,0.16), 0 0 \${interpolate(f, [60,80,120],[26,54,26])}px rgba(255,184,0,\${interpolate(f,[60,80,120],[0.07,0.22,0.07])})\``. This is the single gold accent moment for Scene 5.

2. **mETH value counts up.** The "0.000283" value starts at "0.000000" and increments digit-by-digit from right. Use `(0.000283 * spring({ frame: f - 50, fps, config: { damping: 200 } })).toFixed(6)` as the rendered string. The spring with damping:200 settles cleanly to 0.000283 without overshoot. This makes the treasury feel live rather than a static label.

3. **"self-sustaining" badge flickers once.** At frame 140, apply `opacity: interpolate(f, [140, 142, 144, 146, 148], [1, 0.4, 1, 0.4, 1])`. A two-blink glitch on the green badge. Reads as a system heartbeat. Only this badge, only once.

**Layout polish:** The cards have 40px gap at 1920px. Increase to 52px. The `#100` at font-size 96 has strong presence — no change. The mETH value at 70px MONO is the right scale. The `bottom` section of the right card (self-sustaining badge) is at the bottom of the card content — add `marginTop: 'auto'` with `display:'flex', flexDirection:'column'` on the card interior to pin it.

---

## Scene 6 — Close

**Current state:** Three lines rise in, logo lockup rises. Centered. Gold "Accountable AI." as the payoff. Already the strongest layout in the video.

**Motion additions:**

1. **Lines 1 and 2 de-emphasize into SEC color as line 3 arrives.** Lines 1 and 2 enter correctly. When line 3 (`l3`) reaches opacity > 0.5 (frame ~68), transition lines 1 and 2 from `TXT` to `SEC` color: `color: interpolate(f, [68, 84], [255, 180]) ...`. Implement as an `interpolateColors` or just drop opacity of lines 1 and 2 from 1.0 to 0.65: `opacity: l1.opacity * interpolate(f, [68, 84], [1, 0.65])`. Lines recede as the payoff lands. This is a read-order guide, not decoration.

2. **Logo lockup: "S" avatar has a brief gold border trace.** When the logo enters (frame ~110), animate a conic-gradient border sweep on the avatar div: `background: \`conic-gradient(from \${interpolate(f,[110,150],[0,360])}deg, ${GOLD}, transparent)\``. Applied to a 56px wrapper div (2px larger than the 52px avatar) with `borderRadius:14`. The sweep completes in 40 frames, then holds as a full gold ring fading to the static gold fill. Reads as Sasha's identity being confirmed.

3. **"Accountable AI." — gold glow on final frame hold.** `l3` reaches 1 around frame 68. After frame 90, add `textShadow: \`0 0 \${interpolate(f, [90, 130], [0, 40])}px rgba(255,184,0,0.28)\``. The glow builds slowly over 40 frames. Not an instant bloom — a slow warm. This is the closing gold accent moment.

**Layout polish:** The centered alignment is correct for a close. The gap between lines 1-2 and the "Accountable AI." line is 16px (marginTop). Increase to 28px so the payoff has its own breathing room. Logo lockup at marginTop 50 is correct.

---

## Transition summary

| Transition | Pattern |
|---|---|
| S1 to S2 | 12-frame crossfade. S2 starts with hero image already at opacity 0, fades to 1. |
| S2 to S3 | 12-frame crossfade. The gold eyebrow in S3 is the first element seen, so the crossfade lands cleanly on text. |
| S3 to S4 | 12-frame crossfade. S4's eyebrow and H1 enter over the fade, so there is always something resolving. |
| S4 to S5 | 12-frame crossfade. S5 cards are already rising, so the cards seem to materialize from the signal scene. |
| S5 to S6 | 12-frame crossfade. S6's centered text is visually lighter, so the fade reads as the system going quiet before the final statement. |

All crossfades are opacity-only. No scale, no blur, no slide.

---

## Duration trim to reach under 60s

Remove 3s from D.s3 (428 to 340 frames) by tightening the Beat B hold: reduce the `aOut` and `bOut` crossover windows from 14f to 8f, and reduce the inter-beat holds from ~135f each to ~110f. Remove 3s from D.s4 (428 to 340 frames) by starting the `rejected` spring at frame 120 instead of 150 and `verdict` at frame 240 instead of 300. New total: 221 + 282 + 340 + 340 + 347 + 265 = 1795 frames = 59.8s.
