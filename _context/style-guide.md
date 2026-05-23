# Style Guide — Sasha Coin

## Visual identity
- **Primary:** `#7B2FBE` (dark purple)
- **Secondary:** `#4A1A8C` (deeper purple — backgrounds, cards)
- **Accent:** `#00D4FF` (bright aqua)
- **Background:** `#0D0D1A` (near-black with purple tint)
- **Headline font:** Montserrat
- **Body font:** Inter

## Aesthetic
Dark, crypto-native. Terminal screens and neon highlights. Matrix-adjacent without being cliche. Purple + aqua on near-black. Sasha should feel alive — dynamic, data-forward, slightly mysterious. No corporate polish.

## Avatar
Use the Sasha character illustration as the primary brand asset. Avatar-first identity — the brand is the character.

## Image generation — character references (mandatory)

Always pass these as input references for every Sasha image, no exceptions:
- `input_image_path_1`: `images/references/sasha-character-sheet-1.png`
- `input_image_path_2`: `images/references/sasha-character-sheet-2.png`
- `input_image_path_3`: most recent approved lifestyle image (for scene consistency)

**Sasha's distinguishing features:**
- Latina woman, late 20s
- Long dark wavy brown hair
- Rectangular glasses with red temple detail
- Gold hoop earrings (always visible)
- Signature: green bomber jacket for street/outdoor; dark/casual sweaters for home

## Image generation — vision QA (mandatory after every generation)

After every `generate_image` call, Read the output file and check before presenting:

- [ ] **Character match** — same face, red-temple glasses, gold hoop earrings, correct hair
- [ ] **Phone/screen direction** — if she's reading a phone, screen faces HER, not the camera
- [ ] **Anatomy** — no extra fingers, normal hands, no distorted limbs
- [ ] **Screen content** — if a screen is legible, are numbers plausible? Not hallucinated garbage?
- [ ] **Staging realism** — does the scene look like something a real person would actually do?
- [ ] **No grotesque or surreal elements**

If the image fails any check: regenerate before presenting. Never show a failed image.

## Image generation prompts (defaults)
- Aspect: 4:5 for feed posts, 1:1 for avatar/profile, 16:9 for header/cover
- Lifestyle style: UGC, iPhone camera feel, natural light, candid, unposed
- Vibe descriptors: "crypto-native", "terminal aesthetic", "neon on near-black", "purple + aqua palette", "data-forward", "slightly mysterious"
- Avoid: corporate stock photo, overpolished render, generic crypto imagery (gold coins, bull/bear, suits), phone screen facing camera

## Tweet formatting
- No hashtags on originals
- No links unless absolutely necessary
- No emojis as decoration
- Line breaks only when they earn the rhythm change
- Max 240 chars on hooks

## Reply formatting
- 1–2 sentences max
- Open with concrete angle, question, or data point
- Never open with a compliment
- Never use @mentions in reply text (the reply chain already handles attribution)