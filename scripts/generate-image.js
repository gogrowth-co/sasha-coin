#!/usr/bin/env node
// generate-image.js — HEADLESS image generator for Sasha Coin (terminal / CI use)
// Use this when running outside a Claude Code session (terminal, shell scripts, etc).
//
// PREFERRED PATH (Claude Code session): use nanobanana MCP directly —
//   mcp__nanobanana__generate_image with input_image_path_1=images/references/sasha-character-sheet.png
//   and input_image_path_2=images/references/sasha-character-sheet-2.png for subject consistency.
//   nanobanana can also accept the negative_prompt param and output_path for routing.
//
// THIS SCRIPT: calls Gemini Imagen 4 directly via REST. Prompt-only (no reference images).
// Best for: VPS-style offline generation, quick terminal tests, piping output to Buffer.
//
// Usage:
//   node scripts/generate-image.js --context "tweet text here" [--style creator-on-the-go]
//   node scripts/generate-image.js --style podcast --output /tmp/custom-out.png
//
// Styles: podcast | creator-on-the-go | coffee-content | community-event | meeting-mode | creative-day
//
// Env: GEMINI_API_KEY (from .env in project root or parent)
//
// Output: prints JSON to stdout: { status, path, style, prompt }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env from project root
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
}
loadEnv();

// ── Visual profile ────────────────────────────────────────────────────────────

const PROFILE_PATH = path.join(PROJECT_ROOT, 'images/references/visual-profile.md');

// Canonical base — pulled from visual-profile.md character spec
const BASE_APPEARANCE = [
  'Young woman, late 20s, medium warm olive complexion, light olive/tan skin,',
  'dark brown eyes, high cheekbones, defined features.',
  'Long dark brown hair with warm ombre/chestnut highlights toward ends, chest-length,',
  'loose natural waves, voluminous, worn down.',
  'ESSENTIAL: thick black rectangular glasses with RED accent on the temples (visible from front and side),',
  'slightly oversized, sits high on nose bridge.',
  'Medium-large gold hoop earrings.',
  'Black Apple Watch on left wrist.',
].join(' ');

// Gemini-optimized negative prompt — no "no" prefix (comma-separated exclusions work better than negated phrases)
const NEGATIVE_PROMPT = [
  'plastic skin, waxy skin, poreless skin, airbrushed skin, beauty filter, facetune, mannequin skin,',
  'softbox studio background, seamless backdrop, perfectly even lighting, multiple conflicting light sources,',
  'CGI, 3D render, digital art, cartoon, anime, illustration, unrealistic,',
  'HDR overprocessing, oversaturated, Instagram filter, heavy vignette,',
  'sunglasses, different glasses style, missing red temple tips, missing earrings,',
  'blonde hair, straight hair, short hair, heavy makeup, heels, formal suit, missing Apple Watch.',
].join(' ');

// Wardrobe library — keyed by mood slug
const WARDROBE = {
  podcast: [
    'Dark forest green button-front bomber jacket, ribbed collar and cuffs, white fitted t-shirt,',
    'black skinny jeans, white low-top sneakers.',
    'Podcast studio background: "Token Trends" orange-red neon sign on back wall,',
    'professional large-diaphragm condenser microphone on stand, acoustic foam wall panels,',
    'warm red-orange ambient lighting.',
  ].join(' '),

  'creator-on-the-go': [
    'Tan camel blazer open over white fitted tank top, light wash blue jeans, white low-top sneakers,',
    'large tote bag over shoulder, to-go coffee cup in hand (green sleeve).',
    'Urban street or indoor cafe background, natural daylight, casual confident energy.',
  ].join(' '),

  'coffee-content': [
    'Black crewneck sweatshirt, black pants, white low-top sneakers,',
    'hair in relaxed bun (acceptable only in this context), to-go coffee cup in hand (green sleeve).',
    'Home office or cafe background, laptop visible nearby, warm working-mode energy.',
  ].join(' '),

  'community-event': [
    'Black t-shirt with "CRYPTO IS FOR EVERYONE" text in white lettering,',
    'light wash blue jeans, white low-top sneakers.',
    'Event venue or conference background, approachable and energetic crowd energy.',
  ].join(' '),

  'meeting-mode': [
    'Tan/beige fitted monochrome t-shirt, high-waisted black pants, dark loafers.',
    'Clean minimal background, professional and confident posture, no bag, hands visible.',
  ].join(' '),

  'creative-day': [
    'Beige/cream oversized overshirt or light jacket, olive/khaki cargo pants, white low-top sneakers,',
    'phone in hand (optional).',
    'Relaxed creative workspace or bright outdoor setting.',
  ].join(' '),
};

function pickWardrobe(tweetText) {
  const t = (tweetText || '').toLowerCase();
  if (t.includes('podcast') || t.includes('episode') || t.includes('interview') || t.includes('token trends')) return 'podcast';
  if (t.includes('community') || t.includes('everyone') || t.includes('inclusive') || t.includes('education') || t.includes('learning')) return 'community-event';
  if (t.includes('meeting') || t.includes('client') || t.includes('professional')) return 'meeting-mode';
  if (t.includes('coffee') || t.includes('deep work') || t.includes('work') || t.includes('writing') || t.includes('research')) return 'coffee-content';
  if (t.includes('creative') || t.includes('building') || t.includes('idea') || t.includes('design')) return 'creative-day';
  return 'creator-on-the-go';
}

// All canonical reference images — loaded in priority order.
// character-sheet-1/2: multi-angle photorealistic sheets (primary subject consistency)
// bio-sheet: podcast/lifestyle context panels
// avatar-profile: face + glasses + style guide closeups
// ref-01: portrait reference
const REF_IMAGES = [
  'sasha-character-sheet-1.png',
  'sasha-character-sheet-2.png',
  'sasha-bio-sheet.png',
  'sasha-avatar-profile.png',
  'sasha-ref-01.jpeg',
].map(f => path.join(PROJECT_ROOT, 'images/references', f));

function readRefImage(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  return {
    inline_data: {
      mime_type: mimeMap[ext] || 'image/jpeg',
      data: fs.readFileSync(filePath).toString('base64'),
    },
  };
}

function buildPrompt(style, context) {
  const wardrobe = WARDROBE[style] || WARDROBE['creator-on-the-go'];

  // Camera + shot spec anchors photorealism signal in the model
  const shotSpec = style === 'podcast'
    ? 'Shot on Sony A7C, 50mm f/2.0, eye-level, slight 3/4 turn, studio ambient.'
    : 'Candid iPhone photo, 50mm equivalent, f/1.8, handheld, slight natural camera tilt.';

  // Directional lighting beats generic "good lighting"
  const lightingSpec = style === 'podcast'
    ? 'Warm red-orange practical lighting from neon sign, slight key light at camera-left, natural shadows.'
    : 'Soft window light from camera-left, warm 4500K, subtle rim light from right, natural shadow under chin, no fill flash.';

  // Expression
  const expression = context?.length > 0
    ? `Expression: engaged mid-smile, direct eye contact, slight eyebrow raise — energy of: "${context.slice(0, 80)}". Not posed.`
    : 'Expression: warm natural smile, slight squint from light, direct eye contact. Candid moment.';

  // Explicit imperfection layer fights Gemini's default polish
  const realism = 'Visible pores on nose and cheeks, natural skin texture, slight asymmetry, no airbrushing. Subtle film grain.';

  return [
    'Photorealistic lifestyle photo of the woman in the reference images. Match her face, glasses (BLACK frames, RED temple tips — non-negotiable), hair, and earrings EXACTLY.',
    BASE_APPEARANCE,
    wardrobe,
    shotSpec,
    lightingSpec,
    expression,
    realism,
    'Documentary style. Unstaged composition. Real person energy, not influencer-posed.',
    'No text overlays, logos, watermarks.',
    `Avoid: ${NEGATIVE_PROMPT}`,
  ].join(' ');
}

// ── Gemini 3.1 Flash Image via generateContent (with reference images) ────────

async function generateImage(prompt, outputPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const parts = [];
  const loadedRefs = REF_IMAGES.map(f => ({ file: path.basename(f), img: readRefImage(f) }));
  loadedRefs.forEach(({ file, img }) => {
    if (img) parts.push(img);
    process.stderr.write(`Ref: ${file} ${img ? '✓' : '✗'}\n`);
  });
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generation_config: { response_modalities: ['IMAGE', 'TEXT'] },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText.slice(0, 400)}`);
  }

  const data = await resp.json();
  const imagePart = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData ?? p.inline_data);
  if (!imagePart) throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 300)}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from((imagePart.inlineData ?? imagePart.inline_data).data, 'base64'));
  return outputPath;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag) { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; }

const contextText = getArg('--context') || '';
const explicitStyle = getArg('--style');
const style = explicitStyle || pickWardrobe(contextText);
const timestamp = Date.now();
const defaultOutput = path.join(PROJECT_ROOT, 'images/generated', `sasha-${style}-${timestamp}.png`);
const outputPath = getArg('--output') || defaultOutput;

const prompt = buildPrompt(style, contextText);

process.stderr.write(`Style: ${style}\n`);
process.stderr.write(`Output: ${outputPath}\n`);
process.stderr.write(`Prompt (preview): ${prompt.slice(0, 140)}...\n`);

generateImage(prompt, outputPath)
  .then(savedPath => {
    console.log(JSON.stringify({ status: 'ok', path: savedPath, style, prompt }));
  })
  .catch(err => {
    console.log(JSON.stringify({ status: 'error', error: err.message }));
    process.exit(1);
  });
