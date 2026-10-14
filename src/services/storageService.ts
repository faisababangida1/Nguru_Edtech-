/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LearnerDNA, CoursePlan, Tier, QuizResult, VideoInteraction, BlindSpot } from '../types';

const STORAGE_KEYS = {
  LEARNER_DNA: 'nguru_storage_v3_learner_dna',
  COURSES: 'nguru_storage_v3_courses',
  ACTIVE_COURSE_ID: 'nguru_storage_v3_active_course_id',
  USER_TIER: 'nguru_storage_v3_user_tier',
  YOUTUBE_API_KEY: 'nguru_storage_v3_youtube_api_key',
  SPECIFIC_USAGE: 'nguru_storage_v3_specific_usage',
  PAYMENT_HISTORY: 'nguru_storage_v3_payment_history',
};

const INITIAL_LEARNER_DNA: LearnerDNA = {
  userId: 'user_nguru',
  preferredStyles: ['Visual Breakdowns', 'Practical Demonstrations'],
  pacing: 'balanced',
  likedTraits: [],
  dislikedTraits: [],
  videosWatchedCount: 0,
  completedTopicsCount: 0,
  totalQuizzesTaken: 0,
  comprehensionAverage: 0,
  delusionCalibrationScore: 100,
  blindSpots: [],
  interactions: [],
  evolutionLog: [
    {
      id: 'init-1',
      date: new Date().toISOString().split('T')[0],
      change: 'Learner profile initialized',
      trigger: 'Welcome to Nguru EdTech',
    },
  ],
};

class StorageService {
  /**
   * Retrieves the current Learner DNA profile
   */
  async getLearnerDNA(): Promise<LearnerDNA> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEARNER_DNA);
      if (!raw) {
        await this.saveLearnerDNA(INITIAL_LEARNER_DNA);
        return INITIAL_LEARNER_DNA;
      }
      return JSON.parse(raw) as LearnerDNA;
    } catch {
      return INITIAL_LEARNER_DNA;
    }
  }

  /**
   * Saves the Learner DNA profile
   */
  async saveLearnerDNA(dna: LearnerDNA): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.LEARNER_DNA, JSON.stringify(dna));
  }

  /**
   * Records feedback from the 3-button feedback row
   */
  async recordVideoFeedback(params: {
    videoId: string;
    videoTitle: string;
    topic: string;
    stepTitle: string;
    action: 'like' | 'neutral' | 'dislike';
    note?: string;
  }): Promise<LearnerDNA> {
    const dna = await this.getLearnerDNA();
    dna.videosWatchedCount += 1;

    let appliedAdjustment = '';

    if (params.action === 'like') {
      const positiveNote = params.note?.trim() || 'Helpful pacing & explanation';
      appliedAdjustment = `Reinforced preference: "${positiveNote}"`;
      if (params.note && !dna.likedTraits.includes(params.note)) {
        dna.likedTraits.unshift(params.note);
        if (dna.likedTraits.length > 8) dna.likedTraits.pop();
      }
      dna.evolutionLog.unshift({
        id: `evo-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        change: `Preferred style updated: ${positiveNote.slice(0, 40)}`,
        trigger: `Marked helpful: ${params.stepTitle}`,
      });
    } else if (params.action === 'dislike') {
      const negativeNote = params.note?.trim() || 'Did not fit learning style';
      appliedAdjustment = `Avoided format: "${negativeNote}"`;
      if (params.note && !dna.dislikedTraits.includes(params.note)) {
        dna.dislikedTraits.unshift(params.note);
        if (dna.dislikedTraits.length > 8) dna.dislikedTraits.pop();
      }
      dna.evolutionLog.unshift({
        id: `evo-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        change: `Preference note: ${negativeNote.slice(0, 40)}`,
        trigger: `Switched video: ${params.stepTitle}`,
      });
    } else {
      const nuance = params.note?.trim() || 'Feedback recorded';
      appliedAdjustment = `Note noted: "${nuance}"`;
    }

    const interaction: VideoInteraction = {
      videoId: params.videoId,
      videoTitle: params.videoTitle,
      topic: params.topic,
      stepTitle: params.stepTitle,
      action: params.action,
      comment: params.note,
      timestamp: new Date().toISOString(),
      appliedAdjustment,
    };

    dna.interactions.unshift(interaction);
    if (dna.interactions.length > 50) dna.interactions.pop();

    await this.saveLearnerDNA(dna);
    return dna;
  }

  /**
   * Updates DNA on quiz completion
   */
  async recordQuizOutcome(topic: string, result: QuizResult): Promise<LearnerDNA> {
    const dna = await this.getLearnerDNA();
    dna.totalQuizzesTaken += 1;

    // Moving average of comprehension
    dna.comprehensionAverage = Math.round(
      (dna.comprehensionAverage * (dna.totalQuizzesTaken - 1) + result.percentage) /
        dna.totalQuizzesTaken
    );

    const criticalAnomalies = result.anomalies.filter((a) => a.dangerLevel === 'critical').length;
    const penalty = criticalAnomalies * 15;
    dna.delusionCalibrationScore = Math.max(
      30,
      Math.min(100, dna.delusionCalibrationScore - penalty + (result.anomalies.length === 0 ? 5 : 0))
    );

    for (const anomaly of result.anomalies) {
      const existing = dna.blindSpots.find((b) => b.misconception === anomaly.misconception);
      if (!existing) {
        const spot: BlindSpot = {
          id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          topic,
          concept: anomaly.question,
          misconception: anomaly.misconception,
          status: 'active',
          detectedAt: new Date().toISOString(),
          realityCheckTitle: result.realityCheckVideo?.title,
          realityCheckVideoId: result.realityCheckVideo?.videoId,
        };
        dna.blindSpots.unshift(spot);
      }
    }

    dna.evolutionLog.unshift({
      id: `evo-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      change: `Quiz completed: ${result.score}/${result.total} (${result.anomalies.length} blind spot${result.anomalies.length === 1 ? '' : 's'})`,
      trigger: `Comprehension Quiz on "${topic}"`,
    });

    await this.saveLearnerDNA(dna);
    return dna;
  }

  /**
   * Resolve a blind spot
   */
  async resolveBlindSpot(spotId: string): Promise<LearnerDNA> {
    const dna = await this.getLearnerDNA();
    const target = dna.blindSpots.find((b) => b.id === spotId);
    if (target) {
      target.status = 'resolved';
      dna.delusionCalibrationScore = Math.min(100, dna.delusionCalibrationScore + 10);
      dna.evolutionLog.unshift({
        id: `evo-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        change: `Blind spot resolved: "${target.concept.slice(0, 35)}..."`,
        trigger: 'Corrective lesson reviewed',
      });
      await this.saveLearnerDNA(dna);
    }
    return dna;
  }

  /**
   * Courses
   */
  async getCourses(): Promise<CoursePlan[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.COURSES);
      if (!raw) return [];
      return JSON.parse(raw) as CoursePlan[];
    } catch {
      return [];
    }
  }

  async saveCourses(courses: CoursePlan[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  }

  async getCourse(id: string): Promise<CoursePlan | null> {
    const courses = await this.getCourses();
    return courses.find((c) => c.id === id) || null;
  }

  async saveCourse(course: CoursePlan): Promise<void> {
    const courses = await this.getCourses();
    const idx = courses.findIndex((c) => c.id === course.id);
    if (idx >= 0) {
      courses[idx] = course;
    } else {
      courses.unshift(course);
    }
    await this.saveCourses(courses);
  }

  async deleteCourse(id: string): Promise<void> {
    const courses = await this.getCourses();
    const filtered = courses.filter((c) => c.id !== id);
    await this.saveCourses(filtered);
  }

  async getActiveCourseId(): Promise<string | null> {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_COURSE_ID) || null;
  }

  async setActiveCourseId(id: string): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COURSE_ID, id);
  }

  /**
   * User tier
   */
  async getUserTier(): Promise<Tier> {
    const tier = localStorage.getItem(STORAGE_KEYS.USER_TIER) as Tier | null;
    return tier || 'free';
  }

  async setUserTier(tier: Tier): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.USER_TIER, tier);
  }

  /**
   * Specific search count
   */
  async getSpecificSearchCountToday(): Promise<number> {
    const key = `${STORAGE_KEYS.SPECIFIC_USAGE}_${new Date().toISOString().split('T')[0]}`;
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  }

  async incrementSpecificSearchCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `${STORAGE_KEYS.SPECIFIC_USAGE}_${today}`;
    const current = await this.getSpecificSearchCountToday();
    const next = current + 1;
    localStorage.setItem(key, next.toString());
    return next;
  }

  /**
   * YouTube API Key
   */
  async getYouTubeApiKey(): Promise<string> {
    return localStorage.getItem(STORAGE_KEYS.YOUTUBE_API_KEY) || '';
  }

  async saveYouTubeApiKey(key: string): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.YOUTUBE_API_KEY, key.trim());
  }

  /**
   * Payment history
   */
  async recordPayment(payment: {
    reference: string;
    amount: number;
    tier: Tier;
    date: string;
    status: string;
  }): Promise<void> {
    const existingRaw = localStorage.getItem(STORAGE_KEYS.PAYMENT_HISTORY);
    const list = existingRaw ? JSON.parse(existingRaw) : [];
    list.unshift(payment);
    localStorage.setItem(STORAGE_KEYS.PAYMENT_HISTORY, JSON.stringify(list));
    await this.setUserTier(payment.tier);
  }

  async getPaymentHistory(): Promise<any[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENT_HISTORY);
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Returns all video IDs that have been watched, added to courses, or reviewed
   */
  async getAllEncounteredVideoIds(): Promise<string[]> {
    const ids = new Set<string>();
    const dna = await this.getLearnerDNA();
    dna.interactions?.forEach((i) => {
      if (i.videoId) ids.add(i.videoId);
    });
    const courses = await this.getCourses();
    courses.forEach((c) => {
      c.steps?.forEach((s) => {
        if (s.videoId) ids.add(s.videoId);
      });
    });
    return Array.from(ids);
  }

  /**
   * Clear all app state
   */
  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.COURSES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_COURSE_ID);
    localStorage.removeItem(STORAGE_KEYS.LEARNER_DNA);
    localStorage.removeItem(STORAGE_KEYS.SPECIFIC_USAGE);
  }
}

export const storageService = new StorageService();
