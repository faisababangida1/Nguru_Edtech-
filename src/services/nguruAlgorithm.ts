/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Nguru Cognitive Mastery Algorithm
 * 1. LearnRank (Proof-of-Understanding) Score Engine (0-100)
 * 2. Concept-Atom Timestamp Pinpointing (Auto-Skip Fluff)
 * 3. Cognitive Twin Archetype Matching
 */

import { CognitiveTwinArchetype, LearnRankRecord, LearnerDNA, CourseStep } from '../types';

/**
 * 1. COGNITIVE TWIN ARCHETYPE CLASSIFIER
 * Classifies learner vectors into high-fidelity pedagogical archetypes.
 */
export function classifyCognitiveTwin(dna?: LearnerDNA | null): {
  archetype: CognitiveTwinArchetype;
  confidence: number;
  description: string;
  recommendedPedagogy: string;
} {
  if (!dna) {
    return {
      archetype: 'Visual First-Principles Thinker',
      confidence: 0.85,
      description: 'Learns best through spatial visual diagrams, 3D mental models, and intuitive first principles.',
      recommendedPedagogy: 'Prioritizes 3D animations and visual breakdowns before mathematical notation.',
    };
  }

  const styles = (dna.preferredStyles || []).map((s) => s.toLowerCase());
  const liked = (dna.likedTraits || []).map((t) => t.toLowerCase());
  const pacing = dna.pacing;

  let visualScore = 0;
  let practicalScore = 0;
  let analogyScore = 0;
  let structuredScore = 0;

  // Evaluate Preferred Styles
  for (const s of styles) {
    if (s.includes('animation') || s.includes('3d') || s.includes('visual')) visualScore += 35;
    if (s.includes('practical') || s.includes('code') || s.includes('hands-on') || s.includes('cooking')) practicalScore += 35;
    if (s.includes('analogi') || s.includes('first-principle') || s.includes('intuitive')) analogyScore += 35;
    if (s.includes('whiteboard') || s.includes('lecture') || s.includes('deep-dive')) structuredScore += 35;
  }

  // Evaluate Liked Traits
  for (const t of liked) {
    if (t.includes('visual') || t.includes('breakdown')) visualScore += 20;
    if (t.includes('pace') || t.includes('fast') || t.includes('practical')) practicalScore += 20;
    if (t.includes('analogy') || t.includes('mental model') || t.includes('intuitive')) analogyScore += 20;
    if (t.includes('detailed') || t.includes('depth') || t.includes('structure')) structuredScore += 20;
  }

  // Pacing weight
  if (pacing === 'bite-sized') practicalScore += 15;
  if (pacing === 'deep-dive') structuredScore += 15;

  const scores: Array<{ archetype: CognitiveTwinArchetype; score: number; desc: string; ped: string }> = [
    {
      archetype: 'Visual First-Principles Thinker',
      score: visualScore || 25,
      desc: 'Learns best through spatial visual diagrams, 3D mental models, and clear first principles.',
      ped: 'Visual animations, spatial diagrams, and mechanical first-principles models.',
    },
    {
      archetype: 'Fast Practical Builder',
      score: practicalScore,
      desc: 'Excels with high-velocity, hands-on demonstrations and immediately actionable workflows.',
      ped: 'Concise step-by-step demonstrations without prolonged preamble.',
    },
    {
      archetype: 'Step-by-Step Analogy Learner',
      score: analogyScore,
      desc: 'Translates abstract rules into concrete real-world metaphors and relatable analogies.',
      ped: 'Real-world metaphors and grounded comparisons before formal mechanics.',
    },
    {
      archetype: 'Structured Deep-Dive Analyst',
      score: structuredScore,
      desc: 'Thrives on rigorous whiteboard proofs, complete system architecture, and nuanced edge cases.',
      ped: 'Whiteboard breakdowns, comprehensive system mechanics, and rigorous edge cases.',
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];

  return {
    archetype: top.archetype,
    confidence: Math.min(0.98, Math.max(0.72, top.score / 80)),
    description: top.desc,
    recommendedPedagogy: top.ped,
  };
}

/**
 * 2. INITIAL COLD-START LEARNRANK (LR_0)
 * Evaluates 3 mandatory signals:
 * - Concept-Atom Coverage (0-40)
 * - Analogy & Clarity Density (0-35)
 * - Low Fluff Ratio (0-25)
 */
export function calculateInitialLearnRank(params: {
  title: string;
  channelTitle: string;
  durationMinutes: number;
  conceptTitle: string;
  targetDifficulty?: string;
  archetype?: CognitiveTwinArchetype;
}): {
  learnRank: number;
  conceptAtomScore: number;
  clarityDensityScore: number;
  lowFluffScore: number;
  fluffSkipSeconds: number;
  badgeLabel: string;
} {
  const { title, channelTitle, durationMinutes, conceptTitle, archetype = 'Visual First-Principles Thinker' } = params;
  const titleLower = title.toLowerCase();
  const channelLower = channelTitle.toLowerCase();
  const conceptLower = conceptTitle.toLowerCase();

  // 1. Concept-Atom Coverage (0 - 40 pts)
  const conceptTokens = conceptLower.replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
  let matchedTokens = 0;
  for (const token of conceptTokens) {
    if (titleLower.includes(token)) matchedTokens++;
  }
  const tokenRatio = conceptTokens.length > 0 ? matchedTokens / conceptTokens.length : 1;
  const conceptAtomScore = Math.round(20 + tokenRatio * 20);

  // 2. Analogy & Clarity Density (0 - 35 pts)
  let clarityDensityScore = 20;
  const clarityKeywords = [
    'animation', 'explained', 'visual', 'intuitive', 'simply', 'step by step',
    '3d', 'how it works', 'guide', 'diagram', 'first principles', 'walkthrough'
  ];
  for (const kw of clarityKeywords) {
    if (titleLower.includes(kw)) clarityDensityScore += 3;
  }
  clarityDensityScore = Math.min(35, clarityDensityScore);

  // 3. Low Fluff Ratio (0 - 25 pts)
  let lowFluffScore = 20;
  // Penalize clickbait or rambling durations
  if (titleLower.includes('you won\'t believe') || titleLower.includes('secret tricks') || titleLower.includes('insane')) {
    lowFluffScore -= 10;
  }
  if (durationMinutes < 3 || durationMinutes > 35) {
    lowFluffScore -= 8;
  } else if (durationMinutes >= 5 && durationMinutes <= 15) {
    lowFluffScore += 5; // Ideal concise learning chunk
  }
  lowFluffScore = Math.max(5, Math.min(25, lowFluffScore));

  // High-Pedagogy Channel Boost
  const authoritativeEducators = [
    'khan academy', 'crashcourse', '3blue1brown', 'veritasium', 'ted-ed',
    'ninja nerd', 'bozeman science', 'mit opencourseware', 'statquest',
    'kurzgesagt', 'freecodecamp', 'armando hasudungan', 'amoeba sisters', 'psych explained'
  ];
  const channelBoost = authoritativeEducators.some((c) => channelLower.includes(c)) ? 8 : 0;

  // Cognitive Twin Alignment Boost
  let archetypeBoost = 0;
  if (archetype === 'Visual First-Principles Thinker' && (titleLower.includes('animation') || titleLower.includes('visual') || titleLower.includes('3d'))) {
    archetypeBoost = 6;
  } else if (archetype === 'Fast Practical Builder' && (titleLower.includes('step by step') || titleLower.includes('how to') || durationMinutes <= 12)) {
    archetypeBoost = 6;
  } else if (archetype === 'Step-by-Step Analogy Learner' && (titleLower.includes('intuitive') || titleLower.includes('analogy') || titleLower.includes('simply'))) {
    archetypeBoost = 6;
  } else if (archetype === 'Structured Deep-Dive Analyst' && (titleLower.includes('lecture') || titleLower.includes('whiteboard') || durationMinutes >= 14)) {
    archetypeBoost = 6;
  }

  const rawLR = conceptAtomScore + clarityDensityScore + lowFluffScore + channelBoost + archetypeBoost;
  const learnRank = Math.min(99, Math.max(45, rawLR));

  // Determine introductory fluff skip timestamp (30-90s for long videos, 10-25s for medium)
  let fluffSkipSeconds = 0;
  if (durationMinutes > 15) {
    fluffSkipSeconds = 45;
  } else if (durationMinutes > 8) {
    fluffSkipSeconds = 25;
  } else if (durationMinutes > 4) {
    fluffSkipSeconds = 12;
  }

  const badgeLabel = `LearnRank ${learnRank} • Verified High-Clarity • Matched to ${archetype}`;

  return {
    learnRank,
    conceptAtomScore,
    clarityDensityScore,
    lowFluffScore,
    fluffSkipSeconds,
    badgeLabel,
  };
}

/**
 * 3. DYNAMIC OUTCOME-DRIVEN LEARNRANK UPDATES
 * Outcome feedback from Diagnostic Quiz:
 * - Verified Competence Boost (+8 LR): Answered correctly + confident
 * - Edutainment Delusion Penalty (-15 LR): Answered 100% confident but WRONG (Illusion of Competence)
 */
export function updateLearnRankFromOutcome(
  existingRecord: LearnRankRecord,
  isCorrect: boolean,
  confidence: 'guessing' | 'somewhat' | 'confident',
  userArchetype?: CognitiveTwinArchetype
): {
  updatedRecord: LearnRankRecord;
  deltaLR: number;
  outcomeType: 'verified_competence' | 'delusion_penalty' | 'standard_review';
  feedbackSummary: string;
} {
  let deltaLR = 0;
  let outcomeType: 'verified_competence' | 'delusion_penalty' | 'standard_review' = 'standard_review';
  let verifiedCount = existingRecord.verifiedCompetenceCount;
  let delusionCount = existingRecord.delusionPenaltyCount;

  if (isCorrect && confidence === 'confident') {
    // Verified Competence Boost (+8 LR)
    deltaLR = 8;
    verifiedCount += 1;
    outcomeType = 'verified_competence';
  } else if (!isCorrect && confidence === 'confident') {
    // Edutainment Delusion Penalty (-15 LR)
    // 100% confident but failed the diagnostic question
    deltaLR = -15;
    delusionCount += 1;
    outcomeType = 'delusion_penalty';
  } else if (isCorrect) {
    deltaLR = 3;
    verifiedCount += 1;
  } else {
    deltaLR = -4;
  }

  const newLR = Math.min(100, Math.max(10, existingRecord.learnRank + deltaLR));

  // Update archetype affinities
  const affinities = { ...(existingRecord.archetypeAffinities || {}) };
  if (userArchetype) {
    const currentAffinity = affinities[userArchetype] || 50;
    affinities[userArchetype] = Math.min(100, Math.max(10, currentAffinity + (deltaLR > 0 ? 5 : -10)));
  }

  let badgeLabel = '';
  if (delusionCount > 1 && newLR < 70) {
    badgeLabel = `LearnRank ${newLR} • High Delusion Flagged • Under Pedagogical Review`;
  } else if (verifiedCount >= 2 && newLR >= 88) {
    badgeLabel = `LearnRank ${newLR} • Outcome Verified • Low Delusion • Proven Comprehension`;
  } else {
    badgeLabel = `LearnRank ${newLR} • Pedagogically Calibrated • Matched to ${userArchetype || 'Learner'}`;
  }

  const feedbackSummary =
    outcomeType === 'verified_competence'
      ? `Verified Competence Boost (+8 LR): Learner demonstrated real comprehension.`
      : outcomeType === 'delusion_penalty'
      ? `Edutainment Delusion Penalty (-15 LR): Video created feeling of understanding but failed test.`
      : `LearnRank adjusted by ${deltaLR > 0 ? '+' : ''}${deltaLR} LR based on test outcome.`;

  const updatedRecord: LearnRankRecord = {
    ...existingRecord,
    learnRank: newLR,
    verifiedCompetenceCount: verifiedCount,
    delusionPenaltyCount: delusionCount,
    archetypeAffinities: affinities,
    badgeLabel,
    lastUpdated: new Date().toISOString(),
  };

  return {
    updatedRecord,
    deltaLR,
    outcomeType,
    feedbackSummary,
  };
}

/**
 * 4. IN-MEMORY & LOCAL PERSISTENCE FOR LEARNRANK RECORDS
 */
const LEARNRANK_STORAGE_KEY = 'nguru_learnrank_registry_v1';

export function getStoredLearnRank(videoId: string): LearnRankRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEARNRANK_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, LearnRankRecord> = JSON.parse(raw);
    return map[videoId] || null;
  } catch {
    return null;
  }
}

export function saveStoredLearnRank(record: LearnRankRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LEARNRANK_STORAGE_KEY);
    const map: Record<string, LearnRankRecord> = raw ? JSON.parse(raw) : {};
    map[record.videoId] = record;
    localStorage.setItem(LEARNRANK_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save LearnRank to localStorage:', err);
  }
}

/**
 * Helper to enrich a CourseStep with live LearnRank & Cognitive Twin matching
 */
export function enrichStepWithLearnRank(
  step: CourseStep,
  dna?: LearnerDNA | null
): CourseStep {
  const { archetype } = classifyCognitiveTwin(dna);
  const existingRecord = getStoredLearnRank(step.videoId);

  let lrScore = existingRecord ? existingRecord.learnRank : step.learnRank;
  let badge = existingRecord ? existingRecord.badgeLabel : step.learnRankBadge;
  let startSec = step.startSeconds || (existingRecord ? existingRecord.fluffSkipSeconds : 0);

  if (!lrScore) {
    const initial = calculateInitialLearnRank({
      title: step.videoTitle,
      channelTitle: step.channelTitle,
      durationMinutes: step.targetDurationMinutes || 10,
      conceptTitle: step.conceptTitle || step.title,
      archetype,
    });
    lrScore = initial.learnRank;
    badge = initial.badgeLabel;
    if (startSec === 0) startSec = initial.fluffSkipSeconds;
  }

  return {
    ...step,
    learnRank: lrScore,
    learnRankBadge: badge,
    cognitiveTwinMatch: archetype,
    startSeconds: startSec,
    autoSkippedFluff: startSec > 0,
  };
}
