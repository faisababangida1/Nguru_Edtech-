/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Brain,
  HelpCircle,
  Lightbulb,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizQuestion, ConfidenceLevel, QuizResult, DelusionAnomaly, LearnerDNA, RealityCheckVideo, CoursePlan } from '../types';
import { apiClient } from '../services/apiClient';
import { storageService } from '../services/storageService';
import { NguruVideoPlayer } from './NguruVideoPlayer';

interface DiagnosticQuizViewProps {
  initialTopic?: string;
  courses: CoursePlan[];
  dna: LearnerDNA;
  onDnaUpdated: (updatedDna: LearnerDNA) => void;
  onGoToLearn: () => void;
}

export const DiagnosticQuizView: React.FC<DiagnosticQuizViewProps> = ({
  initialTopic = 'Technical Analysis',
  courses,
  dna,
  onDnaUpdated,
  onGoToLearn,
}) => {
  const [topic, setTopic] = useState(courses[0]?.topic || initialTopic);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [confidences, setConfidences] = useState<Record<string, ConfidenceLevel>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [correctiveVideo, setCorrectiveVideo] = useState<RealityCheckVideo | null>(null);

  const startQuiz = async (t: string) => {
    setLoading(true);
    setQuizResult(null);
    setCorrectiveVideo(null);
    setAnswers({});
    setConfidences({});
    setCurrentIndex(0);
    setTopic(t);

    try {
      const res = await apiClient.generateDiagnostic(t, [], dna);
      setQuestions(res.questions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startQuiz(topic);
  }, []);

  const handleSelectAnswer = (idx: number) => {
    const q = questions[currentIndex];
    setAnswers((prev) => ({ ...prev, [q.id]: idx }));
    if (!confidences[q.id]) {
      setConfidences((prev) => ({ ...prev, [q.id]: 'somewhat' }));
    }
  };

  const handleSelectConfidence = (lvl: ConfidenceLevel) => {
    const q = questions[currentIndex];
    setConfidences((prev) => ({ ...prev, [q.id]: lvl }));
  };

  const handleSubmitQuiz = async () => {
    let score = 0;
    const anomalies: DelusionAnomaly[] = [];

    questions.forEach((q) => {
      const selected = answers[q.id];
      const conf = confidences[q.id] || 'somewhat';
      const isCorrect = selected === q.correctIndex;

      if (isCorrect) {
        score += 1;
      } else {
        if (conf === 'confident') {
          // 100% confident but WRONG -> Blind spot
          anomalies.push({
            questionId: q.id,
            question: q.question,
            userAnswer: q.options[selected !== undefined ? selected : 0],
            correctAnswer: q.options[q.correctIndex],
            confidence: 'confident',
            misconception: q.misconceptionIfWrong || 'Surface familiarity mistaken for mechanical comprehension.',
            dangerLevel: 'critical',
          });
        }
      }
    });

    const total = questions.length;
    const percentage = Math.round((score / total) * 100);

    const calibrationAnalysis =
      anomalies.length > 0
        ? `Identified ${anomalies.length} blind spot${anomalies.length === 1 ? '' : 's'} where you felt 100% confident but selected an incorrect answer.`
        : percentage >= 80
        ? 'Well calibrated! Your confidence accurately reflects your comprehension.'
        : 'Good awareness: You correctly identified when you were guessing.';

    const result: QuizResult = {
      score,
      total,
      percentage,
      anomalies,
      completedAt: new Date().toISOString(),
      calibrationAnalysis,
    };

    setQuizResult(result);

    const updatedDna = await storageService.recordQuizOutcome(topic, result);
    onDnaUpdated(updatedDna);

    if (anomalies.length > 0) {
      try {
        const presc = await apiClient.prescribeRealityCheck(topic, anomalies);
        setCorrectiveVideo(presc.realityCheckVideo);
        result.realityCheckVideo = presc.realityCheckVideo;
        await storageService.recordQuizOutcome(topic, result);
      } catch (err) {
        console.error(err);
      }
    } else if (percentage >= 80) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }
  };

  const currentQ = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const hasAnsweredCurrent = currentQ && answers[currentQ.id] !== undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#003380] text-xs font-bold border border-blue-200">
          <CheckSquare className="w-3.5 h-3.5 text-[#003380]" />
          <span>Comprehension Check</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#003380] tracking-tight">
          Test Your Actual Understanding
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Watching a video can trick your brain into feeling like you mastered it. This 5-question check highlights any blind spots before you move forward.
        </p>

        {/* Topic Selector */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => startQuiz(c.topic)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                topic === c.topic
                  ? 'bg-[#003380] text-white border-[#003380]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.topic}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <Sparkles className="w-8 h-8 text-[#003380] animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Generating Comprehension Quiz for &ldquo;{topic}&rdquo;...
          </h3>
          <p className="text-xs text-slate-500">
            Formulating practical scenarios to test genuine retention.
          </p>
        </div>
      ) : quizResult ? (
        /* Results View */
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-md space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500">Quiz Completed</span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                Score: {quizResult.score} / {quizResult.total} ({quizResult.percentage}%)
              </h2>
            </div>
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              quizResult.anomalies.length > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {quizResult.anomalies.length > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{quizResult.anomalies.length} Blind Spot Identified</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No False Fluency Detected</span>
                </>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
            {quizResult.calibrationAnalysis}
          </p>

          {/* Blind Spots Cards */}
          {quizResult.anomalies.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Areas Where You Felt 100% Sure but Picked the Wrong Option:</span>
              </h3>

              <div className="space-y-3">
                {quizResult.anomalies.map((a, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
                    <p className="font-bold text-slate-900">Q: {a.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                      <div className="p-2.5 rounded-lg bg-white border border-amber-200">
                        <span className="text-[10px] text-slate-500 block">Your selection:</span>
                        <span className="font-semibold text-rose-700">{a.userAnswer}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-amber-200">
                        <span className="text-[10px] text-slate-500 block">Correct answer:</span>
                        <span className="font-semibold text-emerald-700">{a.correctAnswer}</span>
                      </div>
                    </div>
                    <p className="text-slate-600 text-[11px] pt-1">
                      <strong>The misconception:</strong> {a.misconception}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrective Video Recommendation */}
          {correctiveVideo && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Recommended Corrective Video for This Blind Spot</span>
              </h4>
              <NguruVideoPlayer
                videoId={correctiveVideo.videoId}
                title={correctiveVideo.title}
                channelTitle={correctiveVideo.channel}
                startSeconds={correctiveVideo.startSeconds}
              />
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {correctiveVideo.reason}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => startQuiz(topic)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Test</span>
            </button>
            <button
              onClick={onGoToLearn}
              className="px-5 py-2.5 rounded-xl bg-[#003380] text-white text-xs font-bold hover:bg-[#002966] transition-colors"
            >
              Continue Learning
            </button>
          </div>
        </div>
      ) : currentQ ? (
        /* Question Card */
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-[#003380] uppercase">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-5 h-1.5 rounded-full ${
                    i === currentIndex
                      ? 'bg-[#003380]'
                      : answers[questions[i]?.id] !== undefined
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {currentQ.scenario && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
              <strong>Scenario:</strong> {currentQ.scenario}
            </div>
          )}

          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {currentQ.question}
          </h3>

          {/* Options */}
          <div className="space-y-2">
            {currentQ.options.map((opt, idx) => {
              const isSelected = answers[currentQ.id] === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'bg-blue-50 border-[#003380] text-[#003380] ring-1 ring-[#003380]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-[#003380] text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Confidence Calibration */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>How sure are you?</span>
              <span className="text-[11px] font-normal text-slate-500">
                Helps detect illusions of competence
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'guessing' as ConfidenceLevel, label: 'Guessing', desc: 'Not sure' },
                { id: 'somewhat' as ConfidenceLevel, label: 'Somewhat Sure', desc: 'Likely' },
                { id: 'confident' as ConfidenceLevel, label: '100% Sure', desc: 'Certain' },
              ].map((lvl) => {
                const isSelected = (confidences[currentQ.id] || 'somewhat') === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => handleSelectConfidence(lvl.id)}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isSelected
                        ? lvl.id === 'confident'
                          ? 'bg-blue-100 border-[#003380] text-[#003380] font-bold'
                          : 'bg-white border-[#003380] text-slate-900 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">{lvl.label}</div>
                    <div className="text-[10px] text-slate-400">{lvl.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40"
            >
              Previous
            </button>

            {isLast ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={!hasAnsweredCurrent}
                className="px-6 py-2.5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Submit and View Results
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                disabled={!hasAnsweredCurrent}
                className="px-5 py-2.5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      ) : null}

    </div>
  );
};
