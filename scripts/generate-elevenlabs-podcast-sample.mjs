import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const marketingEnvPath = path.resolve(workspaceRoot, '../marketing/.env');
const outputDir = path.join(workspaceRoot, 'research/audio-samples');
const outputPath = path.join(outputDir, 'token-trends-elevenlabs-sample-2026-05-26.mp3');

function parseEnv(contents) {
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const marketingEnv = parseEnv(await readFile(marketingEnvPath, 'utf8'));
const apiKey = process.env.ELEVENLABS_API_KEY || marketingEnv.ELEVENLABS_API_KEY;

if (!apiKey) {
  throw new Error('ELEVENLABS_API_KEY was not found in the shell or marketing/.env');
}

async function getVoices() {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs voices request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.voices || [];
}

const voices = await getVoices();
if (voices.length < 2) {
  throw new Error(`Need at least 2 ElevenLabs voices; account returned ${voices.length}`);
}

function pickVoice(preferredNames, fallbackIndex) {
  const preferred = voices.find((voice) =>
    preferredNames.some((name) => voice.name?.toLowerCase().includes(name)),
  );
  return preferred || voices[fallbackIndex] || voices[0];
}

const sashaVoice = pickVoice(['nova', 'rachel', 'aria', 'bella', 'sarah'], 0);
const maxVoice = pickVoice(['adam', 'antoni', 'roger', 'george', 'charlie'], 1);

const inputs = [
  {
    voice_id: sashaVoice.voice_id,
    text:
      "[warm, curious] Welcome back to Token Trends. I have been digging through Base liquidity data, and the boring answer is not the right answer this week.",
  },
  {
    voice_id: maxVoice.voice_id,
    text:
      "[lightly skeptical] Let me guess. The headline number says Aerodrome is printing yield again, but the footnote says emissions are doing half the lifting.",
  },
  {
    voice_id: sashaVoice.voice_id,
    text:
      "[pleased] Exactly. Aerodrome Slipstream has the flashier APY, but Uniswap v3 WETH slash USDC is the serious pool here: deep liquidity, roughly forty percent fee APY, and no reward token dependency.",
  },
  {
    voice_id: maxVoice.voice_id,
    text:
      "[thoughtful] So the signal is not just, chase yield. It is, separate organic fees from incentive glitter. Very DeFi. Very annoying. Very useful.",
  },
  {
    voice_id: sashaVoice.voice_id,
    text:
      "[confident] That is the whole game. If Sasha is building a liquidity miner, the first rule is simple: measure the yield source before you automate the position.",
  },
];

const response = await fetch(
  'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
  {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'eleven_v3',
      inputs,
      seed: 420,
    }),
  },
);

if (!response.ok) {
  const body = await response.text();
  throw new Error(`ElevenLabs request failed: ${response.status} ${body}`);
}

const audio = Buffer.from(await response.arrayBuffer());
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, audio);

console.log(`Generated ${outputPath}`);
console.log(`Voices: Sasha=${sashaVoice.name}; Max=${maxVoice.name}`);
