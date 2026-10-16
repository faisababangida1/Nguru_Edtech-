/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalibrationQuestion,
  CourseStep,
  LearnerDNA,
  QuizQuestion,
  RealityCheckVideo,
  SpecificGapResult,
  DelusionAnomaly,
  CalibrationResponse
} from '../types';

export type { CalibrationResponse };

export interface RoadmapResponse {
  steps: CourseStep[];
  diagnosticProfile?: import('../types').DiagnosticProfile;
}

export interface RerouteResponse {
  adaptiveNote: string;
  newStep: Partial<CourseStep>;
  refinedQuery?: string;
}

export interface DiagnosticResponse {
  questions: QuizQuestion[];
}

export interface RealityCheckResponse {
  realityCheckVideo: RealityCheckVideo;
}

export const apiClient = {
  async calibrateTopic(topic: string, learnerDNA?: LearnerDNA): Promise<CalibrationResponse> {
    const res = await fetch('/api/calibrate-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, learnerDNA }),
    });
    if (!res.ok) throw new Error('Failed to calibrate topic');
    return res.json();
  },

  async generateRoadmap(
    topic: string,
    answers: Record<string, string>,
    learnerDNA?: LearnerDNA,
    excludeIds: string[] = []
  ): Promise<RoadmapResponse> {
    const res = await fetch('/api/generate-roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, answers, learnerDNA, excludeIds }),
    });
    if (!res.ok) throw new Error('Failed to generate roadmap');
    return res.json();
  },

  async adaptVideo(params: {
    topic: string;
    stepTitle: string;
    conceptTitle?: string;
    stepNumber?: number;
    feedbackType: 'dislike' | 'like' | 'comment' | 'next_lesson';
    feedbackNote?: string;
    currentVideoId?: string;
    targetDurationMinutes?: number;
    targetDifficulty?: string;
    excludeIds?: string[];
  }): Promise<RerouteResponse> {
    const res = await fetch('/api/adapt-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to adapt video');
    return res.json();
  },

  async rerouteVideo(
    topic: string,
    stepTitle: string,
    currentVideoId: string,
    dislikeReason: string,
    learnerDNA?: LearnerDNA,
    excludeIds: string[] = []
  ): Promise<RerouteResponse> {
    return this.adaptVideo({
      topic,
      stepTitle,
      feedbackType: 'dislike',
      feedbackNote: dislikeReason,
      currentVideoId,
      excludeIds,
    });
  },

  async runGapFiller(
    understood: string,
    missingLink: string,
    learnerDNA?: LearnerDNA
  ): Promise<SpecificGapResult> {
    const res = await fetch('/api/gap-filler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ understood, missingLink, learnerDNA }),
    });
    if (!res.ok) throw new Error('Failed to run gap filler');
    return res.json();
  },

  async generateDiagnostic(
    topic: string,
    stepsWatched?: string[],
    learnerDNA?: LearnerDNA
  ): Promise<DiagnosticResponse> {
    const res = await fetch('/api/generate-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, stepsWatched, learnerDNA }),
    });
    if (!res.ok) throw new Error('Failed to generate diagnostic');
    return res.json();
  },

  async prescribeRealityCheck(
    topic: string,
    anomalies: DelusionAnomaly[]
  ): Promise<RealityCheckResponse> {
    const res = await fetch('/api/prescribe-reality-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, anomalies }),
    });
    if (!res.ok) throw new Error('Failed to prescribe reality check');
    return res.json();
  },

  async recordLearnRankOutcome(params: {
    videoId: string;
    conceptTitle: string;
    isCorrect: boolean;
    confidence: 'guessing' | 'somewhat' | 'confident';
    archetype?: string;
  }): Promise<{ updatedRecord: import('../types').LearnRankRecord; deltaLR: number; feedbackSummary: string }> {
    const res = await fetch('/api/learnrank/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to record LearnRank outcome');
    return res.json();
  }
};
