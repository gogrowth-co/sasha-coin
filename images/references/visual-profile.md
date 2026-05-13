# Sasha Coin — Visual Reference Profile
# Used for: image generation prompts, lifestyle post generation, Twitter header images
# Last updated: 2026-05-13
# Source of truth: sasha-character-sheet.png (official character design sheet, 5 body angles + 6 expressions + 4 detail closeups)

## Identity
- Full name: Sasha Coin
- Role: Tech & crypto journalist, host of Token Trends podcast
- Birthday: March 12, 1995

---

## Physical Appearance (consistent across all generations)

### Face
- Young woman, mid-to-late 20s
- Medium warm complexion, light olive/tan skin
- Dark brown eyes
- Warm, wide smile — energetic, approachable, not posed
- High cheekbones, defined features

### Hair
- Dark brown base with warm ombre/highlights toward ends (chestnut-brown tips)
- Long — past shoulders, chest-length
- Loose natural waves, voluminous
- Always worn down

### Signature glasses (ALWAYS present — never generate without these)
- Black thick-framed rectangular glasses
- **RED accent on the temples** — visible from front AND side angles (character sheet detail closeup confirms)
- Slightly oversized, sits high on nose bridge
- This is Sasha's single most important identifying feature. Every prompt must name it.

### Jewelry
- **Gold hoop earrings, medium-large** — visible from front and 3/4 angles (confirmed in detail closeup)
- Minimal other jewelry

### Watch
- **Black Apple Watch** on left wrist — present in all full-body views (added from character sheet)

---

## Signature Outfit (default for generated content)

All 5 body angles in the character sheet confirm this exact outfit:

- **Jacket**: Dark forest green bomber jacket — button-front (not zip), ribbed collar, ribbed cuffs, ribbed hem. Military/forest green (#2D4A2D range).
- **Top**: White fitted crew-neck t-shirt underneath, visible at neckline
- **Pants**: Black slim/skinny jeans, high-waisted
- **Shoes**: **Black and white Vans Old Skool sneakers** — black canvas upper, white midsole/outsole, white laces (added from character sheet — not white sneakers as previously noted)
- **Watch**: Black Apple Watch, left wrist

Color palette: forest green, white, black — matches Token Trends brand colors.

---

## Documented Facial Expressions (from character design sheet)

Use these as mood anchors in prompts:

| Expression | Description | Use for |
|---|---|---|
| **Default smile** | Wide, warm, teeth showing, direct eye contact | Standard posts, announcements |
| **Thoughtful** | Subtle smile, hand near chin or temple, eyes slightly narrowed | Opinion posts, analysis threads |
| **Excited/laughing** | Big open smile, slightly surprised, energetic | Breaking news, big milestones |
| **Confident** | Closed-mouth knowing smile, direct gaze | Data drops, contrarian takes |
| **Playful/curious** | Raised brow, slight head tilt, amused smile | Reactions, quote tweets |
| **Engaged/intense** | Forward lean, focused smile, mid-sentence energy | Podcast clips, video thumbnails |

---

## Body Angles (from character design sheet)

Five confirmed angles for use in generation:

| Angle | Notes |
|---|---|
| Front | Standard. Full outfit visible. Best for product-style reference images. |
| 3/4 front (preferred) | Slightly turned, most natural. Best for Twitter post companions. |
| Side | Profile view. Use for "in conversation" lifestyle images. |
| Back | Hair length most visible. Use sparingly. |
| 3/4 back | Natural candid feel. Good for "walking away" or conference shots. |

Default angle for AI generation: **3/4 front**.

---

## Default Setting / Background

- **Podcast studio** — warm ambient lighting, red/orange tones
- **Neon sign**: "Token Trends" in warm orange-red neon on back wall
- **Props**: Professional condenser microphone on stand (large diaphragm, silver)
- **Room feel**: Acoustic foam panels on walls, cozy but professional

---

## Lifestyle Variations (for Twitter posts / social content)

| Scene | Key elements |
|---|---|
| Working / research | Laptop open, crypto charts visible on screen, coffee mug |
| Talking to camera | Slightly leaning forward, engaged expression, microphone in hand |
| At conference/event | Green jacket, badge/lanyard, crowd or venue background |
| Holding sign | White card with bold short message (crypto / DeFi theme) |
| Relaxed / off-duty | Same outfit, headphones on or book in hand — glasses always present |
| Walking shot | 3/4 or side angle, candid street or venue feel |

---

## Personality in Images

- Always smiling or mid-expression — never neutral or serious-faced
- Gesturing with hands (open palm, pointing, shrugging) — communicative energy
- Makes eye contact with camera — direct, confident
- Peer energy, not celebrity/influencer energy

---

## Image Generation Prompts

### Base prompt (always start with this)
```
Young woman, late 20s, medium warm olive complexion, long dark brown wavy hair with warm 
chestnut highlights at ends, thick black rectangular glasses with distinctive RED temple tips, 
medium-large gold hoop earrings, black Apple Watch on left wrist, warm wide smile, 
dark forest green button-front bomber jacket with ribbed collar and cuffs, white fitted t-shirt, 
black skinny jeans, black and white Vans Old Skool sneakers.
Photorealistic, candid energy, direct eye contact, 3/4 angle.
```

### Studio context (add to base prompt for podcast/content images)
```
Podcast studio background: "Token Trends" orange-red neon sign on wall, 
professional large-diaphragm condenser microphone on stand, acoustic foam panels, 
warm red-orange ambient lighting.
```

### Negative prompt (always append)
```
no sunglasses, no different glasses style, no missing red temple tips, no missing earrings, 
no zip-up jacket, no blue or purple clothing, no neutral expression, no blonde hair, 
no straight hair, no casual hoodie, no heavy makeup, no white sneakers, no heels
```

### Twitter post companion (square)
- Format: 1:1
- Framing: upper body, 3/4 front angle
- Expression: engaged, mid-thought or mid-smile
- Background: studio, slightly blurred

### Full body post (vertical)
- Format: 4:5 or 9:16
- Standing, full outfit visible
- Hands visible (gesturing or resting)
- Sneakers must be visible

---

## Reference Files in This Directory

| File | Content | Use for |
|---|---|---|
| `sasha-character-sheet.png` | Official character design sheet — 5 body angles, 6 expressions, 4 detail closeups | Primary reference. Use this image as input when available. |
| `sasha-ref-01.jpeg` | Reference portrait | Face and hair reference |
| `sasha-coin-400x400.jpg` | Profile photo | Avatar / headshot reference |
| `sasha-test-image.png` | Generated test image | Style calibration reference |

---

## Brand Colors (Token Trends)
- Forest green: #2D4A2D (slightly darker than previously noted — confirmed from jacket)
- White: #FFFFFF
- Black: #1A1A1A
- Red accent: #CC2222 (glasses temples only)
- Gold: #C5A028 (earrings)

---

## What to AVOID in Generation

- Heavily airbrushed / perfect skin (she's real, not a fashion ad)
- Corporate/formal clothing
- Party or nightlife settings
- Revealing outfits
- Sad, angry, or bored expressions
- Missing the glasses — non-negotiable
- Missing the red temple detail on glasses — non-negotiable
- White sneakers (she wears black/white Vans, not plain white sneakers)
- Zip-up jacket (it's button-front)
- Short hair or straight hair
- Missing the Apple Watch
