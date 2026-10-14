/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google GenAI with official SDK and telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Resilient Gemini caller prioritizing gemini-3.8-flash and gemini-3.5-flash-lite
 * (strictly no deprecated models, handles 503 spikes seamlessly).
 */
async function callGemini(contents: string, isJson: boolean = true): Promise<string> {
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(isJson ? { config: { responseMimeType: 'application/json' } } : {}),
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${model} error:`, err.message || err);
    }
  }

  throw lastError || new Error('Unable to reach Gemini API');
}

function parseGeminiJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export interface CandidateVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  duration: string;
  durationMinutes: number;
  snippet?: string;
}

export interface DiagnosticProfile {
  baseline: string;
  ceiling: string;
  durationBracket: string;
  style: string;
}

/**
 * Converts YouTube duration text (e.g. "12:34", "1:05:20", "0:45") into decimal minutes.
 */
function parseDurationToMinutes(durationStr: string): number {
  if (!durationStr) return 10;
  const parts = durationStr.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.some(isNaN)) return 10;
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  } else if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  } else if (parts.length === 1) {
    return parts[0] / 60;
  }
  return 10;
}

/**
 * Hard Duration Filter:
 * Discards YouTube Shorts (< 3 minutes) and marathon videos (> 30 minutes unless requested).
 * Prioritizes the user's duration bracket (concise: 4–15m, standard: 10–28m).
 */
function applyDurationFilter(
  videos: CandidateVideo[],
  durationBracket: 'concise' | 'standard' | 'any' = 'any'
): CandidateVideo[] {
  // Hard Filter: reject Shorts (< 3 mins) and marathon videos (> 30 mins)
  const validLength = videos.filter((v) => v.durationMinutes >= 3.0 && v.durationMinutes <= 32.0);
  const pool = validLength.length >= 2 ? validLength : videos.filter((v) => v.durationMinutes >= 2.5);

  if (durationBracket === 'concise') {
    const concise = pool.filter((v) => v.durationMinutes >= 3.5 && v.durationMinutes <= 14.0);
    return concise.length >= 2 ? concise : pool;
  } else if (durationBracket === 'standard') {
    const standard = pool.filter((v) => v.durationMinutes >= 8.0 && v.durationMinutes <= 28.0);
    return standard.length >= 2 ? standard : pool;
  }

  return pool;
}

// In-memory cache for fast search responses (stores up to 25 videos per query)
const youtubeSearchCache = new Map<string, CandidateVideo[]>();

/**
 * Direct Backend YouTube Search Parser
 * Extracts up to 25 unique videoRenderers directly from YouTube HTML via Node fetch.
 * Uses robust brace-counting for ytInitialData + description snippet extraction.
 */
async function fetchYouTubeSearchResults(query: string, limit = 25): Promise<CandidateVideo[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = cleanQuery.toLowerCase();
  const cached = youtubeSearchCache.get(cacheKey);
  if (cached && cached.length >= limit) {
    return cached.slice(0, limit);
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}&sp=EgIQAQ%253D%253D`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`YouTube fetch returned status: ${res.status}`);
      return cached || [];
    }

    const html = await res.text();
    const videos: CandidateVideo[] = [];
    const seen = new Set<string>();

    // 1. Parse ytInitialData with balanced brace counter
    let jsonStart = html.indexOf('var ytInitialData = ');
    if (jsonStart === -1) jsonStart = html.indexOf('ytInitialData = ');

    if (jsonStart !== -1) {
      const start = html.indexOf('{', jsonStart);
      let depth = 0;
      let end = -1;
      let inString = false;
      let escape = false;

      for (let i = start; i < html.length && i < start + 3500000; i++) {
        const char = html[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        try {
          const parsed = JSON.parse(html.slice(start, end + 1));

          function findVR(obj: any) {
            if (!obj || typeof obj !== 'object' || seen.size >= limit) return;
            if (obj.videoRenderer) {
              const vr = obj.videoRenderer;
              const videoId = vr.videoId;
              const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || '';
              const channelTitle =
                vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'YouTube Creator';
              const duration = vr.lengthText?.simpleText || '10:00';
              const snippet =
                vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
                vr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') ||
                '';
              const durationMinutes = parseDurationToMinutes(duration);

              if (
                videoId &&
                typeof videoId === 'string' &&
                videoId.length === 11 &&
                title &&
                !seen.has(videoId)
              ) {
                seen.add(videoId);
                videos.push({
                  videoId,
                  title,
                  channelTitle,
                  duration,
                  durationMinutes,
                  snippet,
                });
              }
            }
            for (const key of Object.keys(obj)) {
              findVR(obj[key]);
            }
          }

          findVR(parsed);
        } catch (parseErr) {
          console.warn('ytInitialData JSON parse error:', parseErr);
        }
      }
    }

    // 2. Secondary fallback regex scan directly over HTML videoRenderer blocks
    if (videos.length === 0) {
      const vrRegex = /"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}/g;
      let match;
      while ((match = vrRegex.exec(html)) !== null && seen.size < limit) {
        const videoId = match[1];
        const title = match[2];
        if (!seen.has(videoId) && videoId.length === 11) {
          seen.add(videoId);
          videos.push({
            videoId,
            title,
            channelTitle: 'YouTube Educator',
            duration: '10:00',
            durationMinutes: 10,
          });
        }
      }
    }

    if (videos.length > 0) {
      youtubeSearchCache.set(cacheKey, videos);
    }
    return videos;
  } catch (err: any) {
    console.error('Error in fetchYouTubeSearchResults:', err.message || err);
    return cached || [];
  }
}

/**
 * AI Pedagogical Video Selector:
 * Evaluates candidate videos against the lesson's conceptTitle, targetDifficulty,
 * user's ceiling, and preferred style. Strictly rejects exam-prep videos (NEET PG/USMLE)
 * when user is a general learner.
 */
async function selectPedagogicalVideo(params: {
  conceptTitle: string;
  targetDifficulty: string;
  diagnosticProfile?: DiagnosticProfile;
  candidateVideos: CandidateVideo[];
  excludeIds: Set<string>;
}): Promise<{ video: CandidateVideo; pedagogicalReason: string }> {
  const { conceptTitle, targetDifficulty, diagnosticProfile, candidateVideos, excludeIds } = params;

  // Filter out any video in excludeIds
  const available = candidateVideos.filter((v) => !excludeIds.has(v.videoId));
  const pool = available.length > 0 ? available : candidateVideos;

  if (pool.length === 0) {
    return {
      video: {
        videoId: 'MXKkXXYUxBc',
        title: conceptTitle,
        channelTitle: 'Nguru Educator',
        duration: '10:00',
        durationMinutes: 10,
      },
      pedagogicalReason: 'Foundational concept explainer.',
    };
  }

  if (pool.length === 1) {
    return {
      video: pool[0],
      pedagogicalReason: `Best matched video for ${conceptTitle}.`,
    };
  }

  const prompt = `You are the lead pedagogical curator for Nguru EdTech.
We need to assign the single best video for this specific lesson:
- Exact Concept to Teach: "${conceptTitle}"
- Target Learner Difficulty: "${targetDifficulty}"
- Baseline Experience Floor: "${diagnosticProfile?.baseline || 'Novice to Intermediate'}"
- Ceiling Destination (Stop Here): "${diagnosticProfile?.ceiling || 'Core practical concepts'}"
- Preferred Teaching Style: "${diagnosticProfile?.style || 'Visual explanations and clear analogies'}"

Candidate Videos:
${pool
  .slice(0, 10)
  .map(
    (v, i) =>
      `${i + 1}. [ID: ${v.videoId}] "${v.title}" by ${v.channelTitle} (${v.duration}) - Snippet: ${
        v.snippet || 'N/A'
      }`
  )
  .join('\n')}

PEDAGOGICAL RANKING RULES:
1. MUST teach the EXACT concept: "${conceptTitle}". Reject tangentially related videos or completely different subtopics.
2. STRICT DIFFICULTY CEILING: If the learner's ceiling is NOT postgraduate medical/licensing exams, STRICTLY REJECT exam-prep videos (like NEET PG, USMLE, NCLEX, residency boards). Choose clean, intuitive educational explainers.
3. PREFER the user's chosen teaching style: ${diagnosticProfile?.style || 'Visual/Practical'}.
4. Return strict JSON:
{
  "selectedVideoId": "11-character videoId from the candidate list",
  "pedagogicalReason": "1 concise sentence explaining why this video best teaches ${conceptTitle} at this difficulty"
}`;

  try {
    const text = await callGemini(prompt, true);
    const parsed = parseGeminiJson<{ selectedVideoId: string; pedagogicalReason: string }>(text, {
      selectedVideoId: pool[0].videoId,
      pedagogicalReason: `Directly teaches ${conceptTitle}.`,
    });
    const match = pool.find((v) => v.videoId === parsed.selectedVideoId);
    if (match) {
      return {
        video: match,
        pedagogicalReason: parsed.pedagogicalReason || `Directly teaches ${conceptTitle}.`,
      };
    }
  } catch (err) {
    console.warn('Pedagogical ranker AI fallback:', err);
  }

  return {
    video: pool[0],
    pedagogicalReason: `Foundational tutorial covering ${conceptTitle}.`,
  };
}

// -------------------------------------------------------------
// ENDPOINT: Direct YouTube Search for Frontend & Lesson Resolvers
// -------------------------------------------------------------
app.get('/api/youtube-search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const excludeRaw = (req.query.excludeIds as string) || '';
  const excludeIds = excludeRaw
    ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (!query.trim()) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const allVideos = await fetchYouTubeSearchResults(query.trim(), 25);
  const filtered =
    excludeIds.length > 0 ? allVideos.filter((v) => !excludeIds.includes(v.videoId)) : allVideos;

  res.json({ videos: filtered.length > 0 ? filtered : allVideos });
});

// -------------------------------------------------------------
// 1. TOPIC CALIBRATION: 5 to 6 Targeted Diagnostic Questions
// Establishing 4 Mandatory Pillars:
// 1. Baseline Floor
// 2. Ceiling / Destination (Where to Stop)
// 3. Duration Bracket
// 4. Learning Style & Format
// -------------------------------------------------------------
app.post('/api/calibrate-topic', async (req: Request, res: Response) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: 'Topic is required' });
    return;
  }

  const cleanTopic = topic.trim();

  try {
    const prompt = `You are the lead diagnostic engine for Nguru EdTech.
The user wants to learn: "${cleanTopic}".

Generate exactly 5 to 6 targeted diagnostic questions establishing 4 MANDATORY PILLARS:
1. PILLAR: "baseline" (2 questions) - Concrete, situational questions testing what the user already knows or has done in ${cleanTopic} (the foundational floor). NEVER ask generic "Are you beginner/advanced?". Ask about specific tools, concepts, or physical scenarios in ${cleanTopic}.
2. PILLAR: "ceiling" (1 question) - Target Destination / Ceiling: Ask WHY they are learning this and what exact outcome they want to achieve (e.g. "Foundational Clarity: grasp core principles without jargon", "Practical Execution: apply it at work/home", "Academic/Exam Mastery: deep comprehensive fluency"). This locks the strict difficulty ceiling so learners are never overwhelmed.
3. PILLAR: "duration" (1 question) - Lesson Pacing & Duration Bracket: Ask their preferred video length per lesson ("Concise 5–12 min lessons" vs "Standard 12–25 min deep-dives").
4. PILLAR: "style" (1-2 questions) - Learning Style & Format: Ask which teaching format helps them learn best ("Visual 3D animations and diagrams", "Step-by-step practical demonstrations", "Intuitive real-world analogies", "Whiteboard / structured lectures").

Format output as strict JSON:
{
  "category": "Discipline category for ${cleanTopic}",
  "suggestedTitle": "Catchy, action-oriented curriculum title for ${cleanTopic}",
  "description": "Specific 1-2 sentence overview of what the learner will master in ${cleanTopic}.",
  "questions": [
    {
      "id": "q1",
      "pillar": "baseline",
      "question": "Concrete question testing prior experience or knowledge floor in ${cleanTopic}",
      "type": "situational",
      "options": ["Realistic option A", "Realistic option B", "Realistic option C"]
    },
    {
      "id": "q2",
      "pillar": "baseline",
      "question": "Second situational question diagnosing sticking points or exposure in ${cleanTopic}",
      "type": "situational",
      "options": ["Realistic option A", "Realistic option B", "Realistic option C"]
    },
    {
      "id": "q3",
      "pillar": "ceiling",
      "question": "What is your target destination and difficulty ceiling for ${cleanTopic}?",
      "type": "ceiling",
      "options": [
        "Foundational Clarity: Understand core concepts clearly without complex jargon",
        "Practical Execution: Confidently apply and practice this in real scenarios",
        "Comprehensive Mastery: Deep academic or professional-grade fluency"
      ]
    },
    {
      "id": "q4",
      "pillar": "duration",
      "question": "What is your ideal lesson length and study pace?",
      "type": "duration",
      "options": [
        "Concise & Focused (5–12 minutes per lesson)",
        "Standard Deep-Dive (12–25 minutes per lesson)"
      ]
    },
    {
      "id": "q5",
      "pillar": "style",
      "question": "Which teaching format helps concepts click fastest for you?",
      "type": "style",
      "options": [
        "Visual 3D animations and diagrams",
        "Step-by-step practical execution and walkthroughs",
        "Intuitive real-world analogies and mental models",
        "Whiteboard / lecture-style structured breakdowns"
      ]
    }
  ]
}`;

    const text = await callGemini(prompt, true);

    const defaultFallback = {
      category: 'Practical Mastery',
      suggestedTitle: `Mastering ${cleanTopic}`,
      description: `A school-grade, progressive prerequisite curriculum tailored to your practical goals in ${cleanTopic}.`,
      questions: [
        {
          id: 'q1',
          pillar: 'baseline',
          question: `In real life, what has been your hands-on experience with ${cleanTopic}?`,
          type: 'situational',
          options: [
            `Complete beginner — never attempted ${cleanTopic} hands-on`,
            `Casual exposure — know basic vocabulary but hit roadblocks`,
            `Active practitioner — looking to systematically remove blind spots`,
          ],
        },
        {
          id: 'q2',
          pillar: 'baseline',
          question: `What specific challenge usually confuses you most in ${cleanTopic}?`,
          type: 'situational',
          options: [
            `Understanding the first-principles mental model without confusion`,
            `Connecting theory into concrete practical execution`,
            `Diagnosing mistakes and troubleshooting unexpected errors`,
          ],
        },
        {
          id: 'q3',
          pillar: 'ceiling',
          question: `What is your target outcome and difficulty ceiling for ${cleanTopic}?`,
          type: 'ceiling',
          options: [
            `Foundational Clarity: Grasp core principles clearly without overwhelming jargon`,
            `Practical Execution: Confidently apply and build projects in real life`,
            `Academic / Professional Mastery: Complete end-to-end technical fluency`,
          ],
        },
        {
          id: 'q4',
          pillar: 'duration',
          question: `What is your preferred video lesson duration?`,
          type: 'duration',
          options: [
            `Concise & Focused (5–12 minutes per lesson)`,
            `Standard Deep-Dive (12–25 minutes per lesson)`,
          ],
        },
        {
          id: 'q5',
          pillar: 'style',
          question: `Which learning format works best for your brain?`,
          type: 'style',
          options: [
            `Visual 3D animations and visual diagrams`,
            `Step-by-step practical demonstrations`,
            `Intuitive real-world analogies and mental models`,
            `Whiteboard / structured lecture breakdowns`,
          ],
        },
      ],
    };

    const parsed = parseGeminiJson(text, defaultFallback);
    res.json(parsed);
  } catch (err: any) {
    console.error('Calibration error:', err.message || err);
    res.json({
      category: 'Practical Mastery',
      suggestedTitle: `Mastering ${cleanTopic}`,
      description: `A school-grade prerequisite curriculum for ${cleanTopic}.`,
      questions: [
        {
          id: 'q1',
          pillar: 'baseline',
          question: `What is your current hands-on background in ${cleanTopic}?`,
          type: 'situational',
          options: [
            `Starting from scratch with zero prior background`,
            `Have tried the basics but lack structured confidence`,
            `Familiar with fundamentals, seeking refined mastery`,
          ],
        },
        {
          id: 'q2',
          pillar: 'baseline',
          question: `When engaging with ${cleanTopic}, where do you get stuck?`,
          type: 'situational',
          options: [
            `Grasping the underlying mechanisms and definitions`,
            `Knowing what to do step by step in practice`,
            `Handling complex edge cases and real-world nuance`,
          ],
        },
        {
          id: 'q3',
          pillar: 'ceiling',
          question: `What is your target destination (where should the course stop)?`,
          type: 'ceiling',
          options: [
            `Foundational Clarity: Clear conceptual understanding without postgraduate jargon`,
            `Practical Execution: Real-world ability to execute successfully`,
            `Advanced Fluency: Deep comprehensive mastery`,
          ],
        },
        {
          id: 'q4',
          pillar: 'duration',
          question: `What is your preferred lesson pacing?`,
          type: 'duration',
          options: [
            `Concise & Focused (5–12 minutes per lesson)`,
            `Standard Deep-Dive (12–25 minutes per lesson)`,
          ],
        },
        {
          id: 'q5',
          pillar: 'style',
          question: `What teaching format helps you absorb concepts fastest?`,
          type: 'style',
          options: [
            `Visual 3D animations and diagrams`,
            `Practical step-by-step demonstrations`,
            `Intuitive mental models and analogies`,
            `Whiteboard lectures and clean breakdowns`,
          ],
        },
      ],
    });
  }
});

// -------------------------------------------------------------
// 2. GENERATE ROADMAP: School-Grade Prerequisite Ladder (6-8 Steps)
// With AI Pedagogical Video Ranker (No Random Matching)
// -------------------------------------------------------------
app.post('/api/generate-roadmap', async (req: Request, res: Response) => {
  const { topic, answers = {}, excludeIds = [] } = req.body;
  const cleanTopic = (topic || 'New Skill').trim();

  // Extract Diagnostic Profile from answers
  let baseline = 'Novice to Intermediate';
  let ceiling = 'Core practical concepts';
  let durationBracket: 'concise' | 'standard' | 'any' = 'concise';
  let style = 'Visual animations and practical examples';

  const ansValues = Object.values(answers).join(' ');
  if (ansValues.includes('12–25') || ansValues.toLowerCase().includes('deep-dive')) {
    durationBracket = 'standard';
  } else if (ansValues.includes('5–12') || ansValues.toLowerCase().includes('concise')) {
    durationBracket = 'concise';
  }

  if (ansValues.toLowerCase().includes('foundational clarity') || ansValues.toLowerCase().includes('without complex jargon')) {
    ceiling = 'Beginner to Intermediate Foundations (Strictly avoid postgrad exam prep)';
  } else if (ansValues.toLowerCase().includes('practical execution')) {
    ceiling = 'Real-world Practical Application';
  } else if (ansValues.toLowerCase().includes('academic') || ansValues.toLowerCase().includes('mastery')) {
    ceiling = 'Comprehensive In-Depth Mastery';
  }

  if (ansValues.toLowerCase().includes('animation')) {
    style = 'Visual 3D animations and diagrams';
  } else if (ansValues.toLowerCase().includes('whiteboard')) {
    style = 'Whiteboard and structured concept breakdown';
  } else if (ansValues.toLowerCase().includes('demonstration') || ansValues.toLowerCase().includes('practical')) {
    style = 'Step-by-step practical demonstration';
  } else if (ansValues.toLowerCase().includes('analogi')) {
    style = 'Intuitive real-world analogies and mental models';
  }

  const diagnosticProfile: DiagnosticProfile = {
    baseline,
    ceiling,
    durationBracket,
    style,
  };

  try {
    const syllabusPrompt = `You are the lead academic curriculum architect for Nguru EdTech.
Topic: "${cleanTopic}"
Learner Diagnostic Profile:
- Baseline Experience: "${diagnosticProfile.baseline}"
- Target Destination / Ceiling: "${diagnosticProfile.ceiling}"
- Duration Bracket: "${durationBracket === 'concise' ? '5–12 minutes' : '12–25 minutes'}"
- Preferred Learning Format: "${diagnosticProfile.style}"

Design a school-grade 6 to 8 lesson syllabus as a STRICT PREREQUISITE LADDER where Lesson N+1 directly builds on Lesson N:
- Lessons 1–2 (Foundations): Core definitions, first principles, big-picture mental model.
- Lessons 3–4 (Core Building Blocks): How the fundamental mechanisms work step by step.
- Lessons 5–6 (Connected Systems & Practical Examples): How the building blocks interact in real life.
- Lessons 7–8 (Target Goal Mastery): Reaching the exact destination the user chose (${diagnosticProfile.ceiling})—WITHOUT exceeding their difficulty ceiling.

CRITICAL RULES:
1. For EACH lesson, specify an exact "conceptTitle" (e.g. "How a Single Neuron Fires: Action Potentials").
2. For EACH lesson, write a "prerequisiteLink" (1 sentence explaining how this builds directly on the previous lesson).
3. "targetDifficulty": Strictly matched to the user's ceiling ("Beginner", "Intermediate", or "Advanced"). NEVER assign postgraduate medical exam prep (like NEET PG/USMLE) if user ceiling is general.
4. "searchQuery": Write a high-precision YouTube search query (4 to 7 words) combining the exact concept and teaching style.

Format output as strict JSON:
{
  "steps": [
    {
      "stepNumber": 1,
      "phase": "Foundations",
      "title": "Clear Lesson Title",
      "conceptTitle": "Exact Concept Being Taught",
      "prerequisiteLink": "Foundational starting point establishing first principles.",
      "targetDifficulty": "Beginner",
      "targetDurationMinutes": ${durationBracket === 'concise' ? 8 : 16},
      "searchQuery": "targeted youtube search query",
      "objective": "What the learner will master in this lesson",
      "keyTakeaway": "1 memorable takeaway sentence"
    },
    ... (6 to 8 steps total)
  ]
}`;

    const text = await callGemini(syllabusPrompt, true);
    const parsed = parseGeminiJson(text, { steps: [] as any[] });
    let rawSteps: any[] = parsed.steps || [];

    if (!Array.isArray(rawSteps) || rawSteps.length < 6) {
      rawSteps = [
        {
          stepNumber: 1,
          phase: 'Foundations',
          title: `Core Principles & Mental Models of ${cleanTopic}`,
          conceptTitle: `First Principles & Essential Definitions of ${cleanTopic}`,
          prerequisiteLink: `Foundational starting point establishing the big-picture mental model.`,
          targetDifficulty: 'Beginner',
          targetDurationMinutes: durationBracket === 'concise' ? 8 : 15,
          searchQuery: `${cleanTopic} basics introduction visual explainer`,
          objective: `Understand the foundational mental model and primary mechanics of ${cleanTopic}.`,
          keyTakeaway: `Mastering the foundational model removes 80% of downstream confusion.`,
        },
        {
          stepNumber: 2,
          phase: 'Foundations',
          title: `Essential Terminology & Key Mechanism Breakdown`,
          conceptTitle: `Core Terminology & Primary Mechanism of ${cleanTopic}`,
          prerequisiteLink: `Builds directly on Lesson 1's mental model by defining the primary working parts.`,
          targetDifficulty: 'Beginner',
          targetDurationMinutes: durationBracket === 'concise' ? 9 : 16,
          searchQuery: `${cleanTopic} how it works mechanism explanation`,
          objective: `Learn the essential moving parts and vocabulary without ambiguity.`,
          keyTakeaway: `Precision in definitions makes complex concepts effortless to navigate.`,
        },
        {
          stepNumber: 3,
          phase: 'Core Building Blocks',
          title: `Step-by-Step Practical Mechanics in Action`,
          conceptTitle: `Executing the Core Process of ${cleanTopic}`,
          prerequisiteLink: `Now that terms and mechanisms are clear, we walk through the core process step by step.`,
          targetDifficulty: 'Intermediate',
          targetDurationMinutes: durationBracket === 'concise' ? 10 : 18,
          searchQuery: `${cleanTopic} step by step walkthrough tutorial`,
          objective: `Follow an end-to-end practical walkthrough of the central process.`,
          keyTakeaway: `Walking through the full cycle demystifies the entire workflow.`,
        },
        {
          stepNumber: 4,
          phase: 'Core Building Blocks',
          title: `Common Failure Points & Self-Correction Techniques`,
          conceptTitle: `Diagnosing Pitfalls & Mistakes in ${cleanTopic}`,
          prerequisiteLink: `Deepens Lesson 3 by examining what happens when things go wrong and how to fix them.`,
          targetDifficulty: 'Intermediate',
          targetDurationMinutes: durationBracket === 'concise' ? 8 : 15,
          searchQuery: `${cleanTopic} common mistakes and how to fix them`,
          objective: `Identify top beginner pitfalls and learn proactive self-correction cues.`,
          keyTakeaway: `Learning to detect errors in real time separates novices from competent practitioners.`,
        },
        {
          stepNumber: 5,
          phase: 'Connected Systems',
          title: `Real-World Application & Dynamic Scenarios`,
          conceptTitle: `Applying ${cleanTopic} in Live Real-World Conditions`,
          prerequisiteLink: `Applies the core mechanics from Lessons 3-4 to realistic, unpredictable scenarios.`,
          targetDifficulty: 'Intermediate',
          targetDurationMinutes: durationBracket === 'concise' ? 11 : 18,
          searchQuery: `${cleanTopic} real world practical application demonstration`,
          objective: `Apply your knowledge to dynamic scenarios under real-world constraints.`,
          keyTakeaway: `Real-world execution requires adapting core rules to dynamic constraints.`,
        },
        {
          stepNumber: 6,
          phase: 'Target Goal Mastery',
          title: `Target Goal Fluency & Nuanced Execution`,
          conceptTitle: `Commanding Nuance, Speed & Fluency in ${cleanTopic}`,
          prerequisiteLink: `Synthesizes all previous lessons to reach your target mastery outcome.`,
          targetDifficulty: 'Target Goal',
          targetDurationMinutes: durationBracket === 'concise' ? 10 : 20,
          searchQuery: `${cleanTopic} advanced fluency tips best practices`,
          objective: `Achieve effortless execution and deep intuitive command of ${cleanTopic}.`,
          keyTakeaway: `True mastery is fluid execution without hesitation.`,
        },
      ];
    }

    // AI Pedagogical Video Ranker:
    // Process each lesson through YouTube search + Hard Duration Filter + Gemini Pedagogical Selection
    const usedVideoIds = new Set<string>(excludeIds);

    const enrichedSteps = await Promise.all(
      rawSteps.map(async (step: any, index: number) => {
        const stepNum = index + 1;
        const concept = step.conceptTitle || step.title;
        const query = step.searchQuery || `${cleanTopic} ${concept}`;

        // 1. Search YouTube for candidate pool
        let candidates = await fetchYouTubeSearchResults(query, 20);

        // 2. Hard Duration Filter (reject Shorts <3m and marathons >30m)
        let filtered = applyDurationFilter(candidates, durationBracket);

        // Fallback search with broader concept if empty
        if (filtered.length === 0) {
          const fallbackCandidates = await fetchYouTubeSearchResults(`${cleanTopic} ${concept} tutorial`, 20);
          filtered = applyDurationFilter(fallbackCandidates, durationBracket);
        }

        if (filtered.length === 0) {
          const topicCandidates = await fetchYouTubeSearchResults(`${cleanTopic} tutorial`, 20);
          filtered = applyDurationFilter(topicCandidates, durationBracket);
        }

        // 3. AI Pedagogical Selection
        const { video, pedagogicalReason } = await selectPedagogicalVideo({
          conceptTitle: concept,
          targetDifficulty: step.targetDifficulty || 'Intermediate',
          diagnosticProfile,
          candidateVideos: filtered,
          excludeIds: usedVideoIds,
        });

        usedVideoIds.add(video.videoId);

        return {
          id: `step-${stepNum}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          stepNumber: stepNum,
          phase:
            step.phase ||
            (stepNum <= 2 ? 'Foundations' : stepNum <= 4 ? 'Core Building Blocks' : stepNum <= 6 ? 'Connected Systems' : 'Mastery'),
          title: step.title,
          conceptTitle: concept,
          prerequisiteLink:
            step.prerequisiteLink ||
            (stepNum === 1
              ? 'Foundational starting point establishing first principles.'
              : `Builds directly on Lesson ${stepNum - 1}.`),
          targetDifficulty: step.targetDifficulty || 'Intermediate',
          targetDurationMinutes: step.targetDurationMinutes || (durationBracket === 'concise' ? 8 : 16),
          pedagogicalReason,
          objective: step.objective,
          keyTakeaway: step.keyTakeaway,
          videoId: video.videoId,
          videoTitle: video.title || `${step.title} | ${cleanTopic}`,
          channelTitle: video.channelTitle || 'YouTube Educator',
          duration: video.duration || '10:00',
          startSeconds: 0,
          isCompleted: false,
        };
      })
    );

    res.json({
      steps: enrichedSteps,
      diagnosticProfile,
    });
  } catch (err: any) {
    console.error('Roadmap generation error:', err.message || err);
    res.status(500).json({ error: 'Failed to generate curriculum roadmap' });
  }
});

// -------------------------------------------------------------
// 3. SMART "SAME-CONCEPT, BETTER-TEACHER" DISLIKE & REVIEW SWAP
// NEVER changes the conceptTitle or scrambles the syllabus.
// Finds an alternative teacher for that exact same concept.
// -------------------------------------------------------------
app.post('/api/adapt-video', async (req: Request, res: Response) => {
  const {
    topic,
    stepTitle,
    conceptTitle,
    stepNumber,
    feedbackType, // 'dislike' | 'like' | 'comment'
    feedbackNote,
    currentVideoId,
    targetDurationMinutes,
    targetDifficulty = 'Intermediate',
    excludeIds = [],
  } = req.body;

  const cleanTopic = (topic || '').trim();
  const targetConcept = (conceptTitle || stepTitle || '').trim();
  const note = (feedbackNote || '').trim();
  const excludeSet = new Set<string>(Array.isArray(excludeIds) ? excludeIds : []);
  if (currentVideoId) excludeSet.add(currentVideoId);

  try {
    // Gemini synthesizes a refined query for the EXACT SAME concept addressing the complaint
    const queryPrompt = `You are the adaptive video curator for Nguru EdTech.
Topic: "${cleanTopic}"
Exact Concept: "${targetConcept}" (Lesson ${stepNumber || 1})
User Feedback / Complaint: "${note || 'Need an alternative presentation'}"

CRITICAL RULE: The video MUST teach the EXACT concept: "${targetConcept}". Do not change the topic.
Write a refined YouTube search query (4 to 7 words) that finds an alternative instructor explaining "${targetConcept}" in a format that directly addresses the user's feedback (e.g. if too complex, search for "intuitive simple visual explanation ${targetConcept}"; if too slow, search for "concise fast breakdown ${targetConcept}").
Return ONLY the search query string, nothing else.`;

    let refinedQuery = '';
    try {
      const qRes = await callGemini(queryPrompt, false);
      refinedQuery = qRes.replace(/["\n\r]/g, '').trim();
    } catch {
      refinedQuery = `${targetConcept} visual explanation tutorial`;
    }

    if (!refinedQuery) {
      refinedQuery = `${targetConcept} intuitive guide`;
    }

    // 1. Search YouTube
    const searchResults = await fetchYouTubeSearchResults(refinedQuery, 20);

    // 2. Hard Duration Filter (reject Shorts <3m & marathons >30m)
    const durationBracket = targetDurationMinutes && targetDurationMinutes <= 12 ? 'concise' : 'standard';
    let filtered = applyDurationFilter(searchResults, durationBracket);

    // Fallback if empty
    if (filtered.length === 0) {
      const broad = await fetchYouTubeSearchResults(`${targetConcept} explainer`, 20);
      filtered = applyDurationFilter(broad, durationBracket);
    }

    // 3. AI Pedagogical Selection for the alternative instructor
    const { video: selectedVideo, pedagogicalReason } = await selectPedagogicalVideo({
      conceptTitle: targetConcept,
      targetDifficulty,
      candidateVideos: filtered,
      excludeIds: excludeSet,
    });

    const adaptiveNote =
      feedbackType === 'dislike'
        ? note
          ? `Swapped instructor to address: "${note}". Still covering ${targetConcept}.`
          : `Alternative instructor loaded for ${targetConcept}.`
        : `Adapted presentation for ${targetConcept} based on your feedback.`;

    res.json({
      adaptiveNote,
      refinedQuery,
      newStep: {
        title: stepTitle,
        conceptTitle: targetConcept,
        keyTakeaway: `Alternative presentation of ${targetConcept}.`,
        pedagogicalReason,
        videoId: selectedVideo.videoId,
        videoTitle: selectedVideo.title,
        channelTitle: selectedVideo.channelTitle,
        duration: selectedVideo.duration,
        startSeconds: 0,
      },
    });
  } catch (err: any) {
    console.error('Adapt video error:', err.message || err);
    res.status(500).json({ error: 'Failed to adapt video' });
  }
});

// -------------------------------------------------------------
// 4. PRECISION GAP-FILLER
// -------------------------------------------------------------
app.post('/api/gap-filler', async (req: Request, res: Response) => {
  const { understood, missingLink } = req.body;
  if (!understood || !missingLink) {
    res.status(400).json({ error: 'understood and missingLink are required' });
    return;
  }

  try {
    const prompt = `You are the precision conceptual bridge teacher for Nguru EdTech.
The user understands: "${understood}"
The exact point of confusion / missing link: "${missingLink}"

Provide:
1. "ahaMoment": A punchy 1-sentence revelation that dissolves the illusion of magic.
2. "conceptualBridge": A 3-sentence plain-English mechanical bridge that links what they already understand directly to the missing link.
3. "bridgeSummary": An array of exactly 3 numbered progressive steps [step 1, step 2, step 3].
4. "videoSearchQuery": A high-precision 4 to 6 word YouTube search query to find a video demonstrating this exact bridge.
5. "whyThisSection": Why this specific demonstration solves the puzzle.

Format output as strict JSON:
{
  "ahaMoment": "...",
  "conceptualBridge": "...",
  "bridgeSummary": ["...", "...", "..."],
  "videoSearchQuery": "...",
  "whyThisSection": "..."
}`;

    const text = await callGemini(prompt, true);
    const parsed = parseGeminiJson(text, {
      ahaMoment: `The missing link is the transition between ${understood} and ${missingLink}.`,
      conceptualBridge: `When you connect your baseline knowledge with the underlying mechanism, the paradox disappears.`,
      bridgeSummary: [
        'Recognize the baseline state before the change occurs.',
        'Observe the primary trigger that alters the system.',
        'Follow the mechanical chain reaction to the final outcome.',
      ],
      videoSearchQuery: `${missingLink} mechanical explanation`,
      whyThisSection: `Shows the exact transitional trigger between the two states.`,
    });

    const videos = await fetchYouTubeSearchResults(parsed.videoSearchQuery, 15);
    const filtered = applyDurationFilter(videos, 'concise');
    const chosen = filtered[0] || videos[0] || {
      videoId: 'MXKkXXYUxBc',
      title: `${missingLink} Explained`,
      channelTitle: 'Nguru Educator',
      duration: '10:00',
      durationMinutes: 10,
    };

    res.json({
      understood,
      missingLink,
      ahaMoment: parsed.ahaMoment,
      conceptualBridge: parsed.conceptualBridge,
      bridgeSummary: parsed.bridgeSummary,
      recommendedVideo: {
        videoId: chosen.videoId,
        title: chosen.title,
        channel: chosen.channelTitle,
        startSeconds: 0,
        timestampLabel: '0:00',
        whyThisSection: parsed.whyThisSection,
      },
    });
  } catch (err: any) {
    console.error('Gap filler error:', err.message || err);
    res.status(500).json({ error: 'Failed to run gap filler' });
  }
});

// -------------------------------------------------------------
// 5. COMPREHENSION & DELUSION BREAKER DIAGNOSTIC
// -------------------------------------------------------------
app.post('/api/generate-diagnostic', async (req: Request, res: Response) => {
  const { topic, stepsWatched = [] } = req.body;
  const cleanTopic = (topic || 'General Knowledge').trim();

  try {
    const prompt = `You are the Delusion Breaker Diagnostic engine for Nguru EdTech.
Topic: "${cleanTopic}"
Lessons watched: ${JSON.stringify(stepsWatched)}

Generate 5 high-yield multiple-choice assessment questions that specifically expose the "Illusion of Competence":
Questions must test transfer of knowledge to novel, realistic scenarios—not superficial rote memorization.
Each question must include:
- "id": "q1" to "q5"
- "scenario": Realistic practical situation
- "question": Direct question
- "options": Exactly 4 options
- "correctIndex": 0 to 3
- "explanation": Why the correct answer works
- "misconceptionIfWrong": The specific cognitive trap someone falls into if they pick the intuitive wrong answer

Format output as strict JSON:
{
  "questions": [
    {
      "id": "q1",
      "scenario": "...",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "misconceptionIfWrong": "..."
    }
  ]
}`;

    const text = await callGemini(prompt, true);
    const parsed = parseGeminiJson(text, { questions: [] });
    res.json(parsed);
  } catch (err: any) {
    console.error('Diagnostic error:', err.message || err);
    res.status(500).json({ error: 'Failed to generate diagnostic' });
  }
});

// -------------------------------------------------------------
// 6. REALITY CHECK VIDEO RESOLVER
// -------------------------------------------------------------
app.post('/api/reality-check-video', async (req: Request, res: Response) => {
  const { topic, misconception } = req.body;
  const cleanTopic = (topic || 'Concepts').trim();
  const cleanMisconception = (misconception || 'Common error').trim();

  try {
    const query = `${cleanTopic} ${cleanMisconception} debunked mistake tutorial`;
    const videos = await fetchYouTubeSearchResults(query, 10);
    const filtered = applyDurationFilter(videos, 'concise');
    const chosen = filtered[0] || videos[0] || {
      videoId: 'MXKkXXYUxBc',
      title: `${cleanTopic} Reality Check`,
      channelTitle: 'Nguru Educator',
      duration: '08:00',
      durationMinutes: 8,
    };

    res.json({
      realityCheckVideo: {
        videoId: chosen.videoId,
        title: chosen.title,
        channel: chosen.channelTitle,
        reason: `Directly debunks: "${cleanMisconception}" with clear visual proof.`,
        startSeconds: 0,
      },
    });
  } catch (err: any) {
    console.error('Reality check video error:', err.message || err);
    res.status(500).json({ error: 'Failed to resolve reality check video' });
  }
});

// -------------------------------------------------------------
// VITE DEV MIDDLEWARE / STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nguru EdTech server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
