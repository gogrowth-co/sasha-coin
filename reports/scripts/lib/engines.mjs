// Shared utilities for AEO citation runners (cross-icp weekly + 6-icp monthly).
// Per-engine API callers + brand-citation detection + result normalization.

export function detectBrandInResponse(text, domain) {
  if (!text || !domain) return false;
  return text.toLowerCase().includes(domain.toLowerCase());
}

export function detectBrandInCitations(citations, domain) {
  if (!Array.isArray(citations) || !domain) return false;
  return citations.some(c => (c.url || '').toLowerCase().includes(domain.toLowerCase()));
}

export function normalizePromptResult(raw, domain) {
  const text = raw.text_response || raw.text || '';
  const citations = raw.citations || [];
  return {
    brand_in_text: detectBrandInResponse(text, domain),
    brand_in_citations: detectBrandInCitations(citations, domain),
    text_length: text.length,
    text_response: text,
    citation_count: citations.length,
    citations,
  };
}

// Engine call wrappers. Each takes a prompt string and returns
// { text_response, citations[] }.

export async function callChatGpt(prompt, opts = {}) {
  const key = opts.apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-4o-search-preview',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`ChatGPT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  // Extract markdown links from the response text as citations
  const text = msg.content || '';
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const citations = [];
  let m; while ((m = linkRe.exec(text))) citations.push({ title: m[1], url: m[2] });
  return { text_response: text, citations };
}

export async function callPerplexity(prompt, opts = {}) {
  const key = opts.apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'perplexity/sonar-pro',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const citations = (data.citations || data.choices?.[0]?.message?.citations || []).map(c => typeof c === 'string' ? { url: c } : c);
  return { text_response: text, citations };
}

export async function callGemini(prompt, opts = {}) {
  const key = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const cand = data.candidates?.[0] || {};
  const text = cand.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
  const grounding = cand.groundingMetadata?.groundingChunks || [];
  const citations = grounding.map(g => ({ title: g.web?.title, url: g.web?.uri })).filter(c => c.url);
  return { text_response: text, citations };
}

export const ENGINES = {
  chatgpt: { call: callChatGpt, costPerCall: 0.04 },
  perplexity: { call: callPerplexity, costPerCall: 0.014 },
  gemini: { call: callGemini, costPerCall: 0 },
};
