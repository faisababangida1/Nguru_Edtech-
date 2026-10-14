export type Tier = 'free' | 'go' | 'pro';

export type LearningStyle = 
  | 'Visual & 3D Animations'
  | 'One-on-One Lecture & Whiteboard'
  | 'Hands-on Practical / Cooking'
  | 'First-Principles & Intuitive Analogies'
  | 'Code-along & Interactive Demos'
  | 'Concise Fast-Paced Breakdown';

export type PacingPreference = 'bite-sized' | 'balanced' | 'deep-dive';

export interface BlindSpot {
  id: string;
  topic: string;
  concept: string;
  misconception: string;
  status: 'active' | 'resolved';
  detectedAt: string;
  realityCheckVideoId?: string;
  realityCheckTitle?: string;
}

export interface VideoInteraction {
  videoId: string;
  videoTitle: string;
  topic: string;
  stepTitle: string;
  action: 'like' | 'neutral' | 'dislike';
  comment?: string;
  timestamp: string;
  appliedAdjustment?: string;
}

export interface LearnerDNA {
  userId: string;
  preferredStyles: string[];
  pacing: PacingPreference;
  likedTraits: string[];
  dislikedTraits: string[];
  videosWatchedCount: number;
  completedTopicsCount: number;
  totalQuizzesTaken: number;
  comprehensionAverage: number; // 0 - 100
  delusionCalibrationScore: number; // 0 - 100 (100 = perfectly calibrated, 0 = high illusion of competence)
  blindSpots: BlindSpot[];
  interactions: VideoInteraction[];
  evolutionLog: Array<{
    id: string;
    date: string;
    change: string;
    trigger: string;
  }>;
}

export interface CalibrationQuestion {
  id: string;
  question: string;
  type: string;
  pillar?: 'baseline' | 'ceiling' | 'duration' | 'style' | 'experience' | 'goal';
  options: string[];
}

export interface CourseStepReview {
  action: 'like' | 'neutral' | 'dislike' | null;
  note: string;
  timestamp: string;
  adaptiveRerouted?: boolean;
  rerouteReason?: string;
}

export interface CourseStep {
  id: string;
  phase: string;
  stepNumber: number;
  title: string;
  conceptTitle?: string;
  prerequisiteLink?: string;
  targetDifficulty?: string;
  targetDurationMinutes?: number;
  pedagogicalReason?: string;
  objective: string;
  keyTakeaway: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  duration: string;
  startSeconds?: number;
  isCompleted: boolean;
  review?: CourseStepReview;
}

export interface DiagnosticProfile {
  baseline: string;
  ceiling: string;
  durationBracket: string;
  style: string;
}

export interface CoursePlan {
  id: string;
  topic: string;
  description: string;
  category: string;
  status: 'calibrating' | 'ready' | 'in_progress' | 'completed';
  calibrationQuestions: CalibrationQuestion[];
  calibrationAnswers: Record<string, string>;
  diagnosticProfile?: DiagnosticProfile;
  steps: CourseStep[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type ConfidenceLevel = 'guessing' | 'somewhat' | 'confident';

export interface QuizQuestion {
  id: string;
  question: string;
  scenario: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  misconceptionIfWrong?: string;
  selectedOption?: number;
  confidence?: ConfidenceLevel;
}

export interface DelusionAnomaly {
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  confidence: ConfidenceLevel;
  misconception: string;
  dangerLevel: 'mild' | 'moderate' | 'critical';
}

export interface RealityCheckVideo {
  videoId: string;
  title: string;
  channel: string;
  reason: string;
  startSeconds?: number;
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  anomalies: DelusionAnomaly[];
  realityCheckVideo?: RealityCheckVideo;
  completedAt: string;
  calibrationAnalysis: string;
}

export interface SpecificGapResult {
  understood: string;
  missingLink: string;
  conceptualBridge: string;
  bridgeSummary: [string, string, string];
  ahaMoment: string;
  recommendedVideo: {
    videoId: string;
    title: string;
    channel: string;
    startSeconds: number;
    timestampLabel: string;
    whyThisSection: string;
  };
}
