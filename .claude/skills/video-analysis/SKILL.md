---
name: video-analysis
description: Use when the user shares a YouTube URL or local video file and wants to analyze, transcribe, summarize, or extract content from it for repurposing, research, or review.
version: "1.0"
status: active
owner: content-writer
propagate_to_template: false
vps_runtimes: []
---

# Video Analysis

Analyze video content via Gemini on **Vertex AI Express**. Gemini watches the actual video (frames **and** audio), so output is a true scene-by-scene visual breakdown — what's on screen, on-screen text, graphics, cuts, demos — not just a transcript summary. Supports YouTube/public URLs (native, no download) and local video files (inline base64). Returns: summary, scene breakdown, key moments, optional transcript and repurpose angles.

## Auth (read this first)

- **Use `GOOGLE_AGENT_PLATFORM_API_KEY`** (Vertex AI Express). Always.
- **Do NOT use `GEMINI_API_KEY`** (AI Studio) — its prepay credits are depleted (returns `429 RESOURCE_EXHAUSTED`). Confirmed 2026-06-05.
- The Vertex key has three requirements that differ from the AI Studio API:
  1. Host: `https://aiplatform.googleapis.com/v1/publishers/google/models/<model>:generateContent`
  2. `contents` must include `role:"user"`
  3. `fileData`/`inlineData` must include a `mimeType` (use `"video/*"` for URLs)
- Header is `x-goog-api-key: <key>`.

## How to run (always use the bundled script)

Run the script — never paste an inline curl with the key in it (the secret-guard hook will block any command string containing the key variable):

```bash
bash .claude/skills/video-analysis/scripts/analyze-video.sh "<youtube-url-or-local-file>" ["<optional custom prompt>"]
```

- Auto-detects URL vs local file. For URLs it passes `fileUri` straight to Vertex (no download). For local files it inlines the bytes as base64 (keep clips small, ~<20MB request cap; for big local files, downsample first or upload to GCS and pass a `gs://` URI).
- Finds the nearest `.env` up the directory tree, so it works from any project workspace that has `GOOGLE_AGENT_PLATFORM_API_KEY` set.
- Override the model with `VIDEO_ANALYSIS_MODEL=gemini-2.5-pro` for harder reasoning; default is `gemini-2.5-flash`.
- Long videos run 30–90s+ — launch it with `run_in_background: true` and read the output file when it completes.
- Confirm it actually ingested video by checking the printed `promptTokensDetails` for a `"modality":"VIDEO"` entry. If you only see TEXT/AUDIO, it fell back to transcript-only and the scene breakdown is unreliable.

## Standard Prompt

The script's default prompt asks for the scene-by-scene visual breakdown. To override (e.g. "extract transcript only", "find clip-worthy moments", or add repurpose angles), pass a custom prompt as the second argument:

```
Analyze this video and provide:
1. A 2-3 sentence summary of the main topic and key argument
2. A full transcript with approximate timestamps (every 30-60 seconds)
3. A scene/section breakdown — group content into logical segments with start timestamps and 1-sentence descriptions
4. Key moments — list 5-10 specific timestamps worth clipping or quoting
5. Repurpose angles — suggest 3 LinkedIn post angles, 2 thread hook options, and 1 newsletter section idea based on the content
```

## Output Format

Structure the Gemini response into this markdown block before returning to the user:

```markdown
## Video Analysis: [URL or filename]
**Source:** [YouTube URL or file path]
**Analyzed:** [today's date]

### Summary
[2-3 sentences]

### Transcript
[Timestamped paragraphs — group by topic, not line-by-line]

### Scene Breakdown
| Timestamp | Section | Description |
|---|---|---|
| 0:00 | [name] | [1 sentence] |

### Key Moments
- **[HH:MM]** — [what happens / why it's notable]

### Repurpose Angles
**LinkedIn post angles:**
1. [angle + hook concept]

**Thread hook options:**
1. [hook]

**Newsletter section:**
[brief description of what section would cover + suggested placement]
```

## Routing

After analysis, if the user wants to act on the repurpose angles:
- LinkedIn post → route to content-writer with the angle + transcript excerpt as brief
- Thread → route to content-writer with `web3-twitter-thread-writer` skill
- Newsletter section → route to content-writer with SOP-11 context

## MIME Type Reference

| Extension | MIME type |
|---|---|
| `.mp4` | `video/mp4` |
| `.mov` | `video/quicktime` |
| `.avi` | `video/x-msvideo` |
| `.webm` | `video/webm` |
| `.mkv` | `video/x-matroska` |

## Limits

- YouTube/public URLs: long videos work (the 8-min test ingested ~130k VIDEO tokens). Very long videos cost a lot of input tokens — use `gemini-2.5-flash` (default) and consider trimming the prompt.
- Local files: inlined as base64, so practically capped by the request size (~<20MB of video). For larger local files, downsample/clip first, or upload to a GCS bucket and pass a `gs://` URI to the script.
- The Vertex Express key **cannot** use the AI Studio File API (`generativelanguage.googleapis.com/upload/...`) — that's why local files use inline base64, not a resumable upload.
- If the video is private or age-restricted, the URL path will fail — download with `yt-dlp` and pass the local file instead, or fall back to manual transcript paste.
