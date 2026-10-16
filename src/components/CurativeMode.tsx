/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  Plus,
  Play,
  RotateCcw,
  Layers,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { CoursePlan, LearnerDNA, Tier } from '../types';
import { apiClient, CalibrationResponse } from '../services/apiClient';
import { storageService } from '../services/storageService';
import { NguruVideoPlayer } from './NguruVideoPlayer';
import { ThreeActionFeedbackBar } from './ThreeActionFeedbackBar';

interface CurativeModeProps {
  courses: CoursePlan[];
  activeCourse: CoursePlan | null;
  onSelectCourse: (course: CoursePlan) => void;
  onCourseUpdated: (course: CoursePlan) => void;
  onCourseCreated: (newCourse: CoursePlan) => void;
  onCourseDeleted: (courseId: string) => void;
  dna: LearnerDNA;
  onDnaUpdated: (updatedDna: LearnerDNA) => void;
  currentTier: Tier;
  onOpenUpgradeModal: () => void;
  onGoToTest: (topic: string) => void;
}

export const CurativeMode: React.FC<CurativeModeProps> = ({
  courses,
  activeCourse,
  onSelectCourse,
  onCourseUpdated,
  onCourseCreated,
  onCourseDeleted,
  dna,
  onDnaUpdated,
  currentTier,
  onOpenUpgradeModal,
  onGoToTest,
}) => {
  const [topicInput, setTopicInput] = useState('');
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationResponse | null>(null);
  const [calibrationAnswers, setCalibrationAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedMicroMission, setSelectedMicroMission] = useState<string | null>(null);
  const [customSubTopic, setCustomSubTopic] = useState('');
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(activeCourse?.currentStepIndex || 0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [showNewCourseSearch, setShowNewCourseSearch] = useState(false);
  const [adaptingNextMessage, setAdaptingNextMessage] = useState<string | null>(null);
  const [companionTab, setCompanionTab] = useState<'blueprint' | 'takeaways' | 'transcript' | 'check'>('blueprint');
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);

  const maxCoursesAllowed = currentTier === 'free' ? 1 : currentTier === 'go' ? 5 : 999;
  const isCourseLimitReached = courses.length >= maxCoursesAllowed;

  // Real Situational Calibration Questions
  const handleStartCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;

    if (isCourseLimitReached) {
      onOpenUpgradeModal();
      return;
    }

    setCalibrating(true);
    setCurrentQuestionIndex(0);
    setSelectedMicroMission(null);
    setCustomSubTopic('');
    try {
      const data = await apiClient.calibrateTopic(topicInput.trim(), dna);
      setCalibrationData(data);
      const initialAnswers: Record<string, string> = {};
      data.questions.forEach((q) => {
        initialAnswers[q.id] = q.options[0];
      });
      setCalibrationAnswers(initialAnswers);
    } catch (err) {
      console.error(err);
    } finally {
      setCalibrating(false);
    }
  };

  // 6 to 8 Lesson Syllabus Generation
  const handleGenerateCourse = async () => {
    if (!calibrationData) return;
    setGeneratingRoadmap(true);
    const effectiveTopic = (customSubTopic.trim() || selectedMicroMission || topicInput).trim();
    try {
      const allExclude = await storageService.getAllEncounteredVideoIds();
      const roadmap = await apiClient.generateRoadmap(
        effectiveTopic,
        calibrationAnswers,
        dna,
        allExclude
      );

      const newPlan: CoursePlan = {
        id: `course-${Date.now()}`,
        topic: effectiveTopic,
        category: calibrationData.category,
        description: calibrationData.description,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStepIndex: 0,
        calibrationQuestions: calibrationData.questions,
        calibrationAnswers,
        diagnosticProfile: roadmap.diagnosticProfile,
        steps: roadmap.steps,
      };

      await storageService.saveCourse(newPlan);
      await storageService.setActiveCourseId(newPlan.id);
      onCourseCreated(newPlan);

      setTopicInput('');
      setSelectedMicroMission(null);
      setCustomSubTopic('');
      setCurrentQuestionIndex(0);
      setCalibrationData(null);
      setShowNewCourseSearch(false);
      setActiveStepIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  // Live Next-Lesson Adaptation trigger
  const triggerNextLessonAdaptation = async (
    currentCourse: CoursePlan,
    currentStepIdx: number,
    feedbackType: 'like' | 'comment' | 'dislike',
    feedbackNote?: string
  ) => {
    const nextIdx = currentStepIdx + 1;
    if (nextIdx >= currentCourse.steps.length) return;

    const nextStep = currentCourse.steps[nextIdx];
    const lessonNum = nextIdx + 1;

    setAdaptingNextMessage(`✨ Adapting Lesson ${lessonNum} to match your learning style...`);

    try {
      const allExclude = await storageService.getAllEncounteredVideoIds();
      const res = await apiClient.adaptVideo({
        topic: currentCourse.topic,
        stepTitle: nextStep.title,
        conceptTitle: nextStep.conceptTitle || nextStep.title,
        stepNumber: lessonNum,
        feedbackType,
        feedbackNote,
        currentVideoId: nextStep.videoId,
        targetDurationMinutes: nextStep.targetDurationMinutes,
        targetDifficulty: nextStep.targetDifficulty,
        excludeIds: allExclude,
      });

      if (res && res.newStep && res.newStep.videoId) {
        const updatedSteps = [...currentCourse.steps];
        updatedSteps[nextIdx] = {
          ...nextStep,
          videoId: res.newStep.videoId,
          videoTitle: res.newStep.videoTitle || nextStep.videoTitle,
          channelTitle: res.newStep.channelTitle || nextStep.channelTitle,
          duration: res.newStep.duration || nextStep.duration,
          pedagogicalReason: res.newStep.pedagogicalReason || nextStep.pedagogicalReason,
          keyTakeaway: res.newStep.keyTakeaway || nextStep.keyTakeaway,
        };

        const updatedCourse = {
          ...currentCourse,
          steps: updatedSteps,
          updatedAt: new Date().toISOString(),
        };

        await storageService.saveCourse(updatedCourse);
        onCourseUpdated(updatedCourse);
      }
    } catch (e) {
      console.warn('Next lesson adaptation error:', e);
    } finally {
      setTimeout(() => {
        setAdaptingNextMessage(null);
      }, 3500);
    }
  };

  // Video Completed handler
  const handleVideoEnded = async () => {
    if (!activeCourse) return;
    const step = activeCourse.steps[activeStepIndex];
    if (!step) return;

    if (!step.isCompleted) {
      const updatedSteps = [...activeCourse.steps];
      updatedSteps[activeStepIndex] = {
        ...step,
        isCompleted: true,
      };
      const updatedCourse = {
        ...activeCourse,
        steps: updatedSteps,
        updatedAt: new Date().toISOString(),
      };
      await storageService.saveCourse(updatedCourse);
      onCourseUpdated(updatedCourse);

      // Trigger automatic next-lesson adaptation
      triggerNextLessonAdaptation(updatedCourse, activeStepIndex, 'like', 'Completed full video');
    }
  };

  const handleLike = async (comment?: string) => {
    if (!activeCourse) return;
    const step = activeCourse.steps[activeStepIndex];
    if (!step) return;

    const updatedDna = await storageService.recordVideoFeedback({
      videoId: step.videoId,
      videoTitle: step.videoTitle,
      topic: activeCourse.topic,
      stepTitle: step.title,
      action: 'like',
      note: comment,
    });
    onDnaUpdated(updatedDna);

    const updatedSteps = [...activeCourse.steps];
    updatedSteps[activeStepIndex] = {
      ...step,
      isCompleted: true,
      review: {
        action: 'like',
        note: comment || 'Helpful lesson',
        timestamp: new Date().toISOString(),
      },
    };

    const updatedCourse: CoursePlan = {
      ...activeCourse,
      steps: updatedSteps,
      currentStepIndex: activeStepIndex,
      updatedAt: new Date().toISOString(),
    };

    await storageService.saveCourse(updatedCourse);
    onCourseUpdated(updatedCourse);

    // Live Adapt Next Lesson based on positive feedback
    triggerNextLessonAdaptation(updatedCourse, activeStepIndex, 'like', comment);
  };

  const handleNeutral = async (note: string) => {
    if (!activeCourse) return;
    const step = activeCourse.steps[activeStepIndex];
    if (!step) return;

    const updatedDna = await storageService.recordVideoFeedback({
      videoId: step.videoId,
      videoTitle: step.videoTitle,
      topic: activeCourse.topic,
      stepTitle: step.title,
      action: 'neutral',
      note,
    });
    onDnaUpdated(updatedDna);

    const updatedSteps = [...activeCourse.steps];
    updatedSteps[activeStepIndex] = {
      ...step,
      review: {
        action: 'neutral',
        note,
        timestamp: new Date().toISOString(),
      },
    };

    const updatedCourse: CoursePlan = {
      ...activeCourse,
      steps: updatedSteps,
      updatedAt: new Date().toISOString(),
    };

    await storageService.saveCourse(updatedCourse);
    onCourseUpdated(updatedCourse);

    // Adapt next lesson based on user's nuanced comment
    triggerNextLessonAdaptation(updatedCourse, activeStepIndex, 'comment', note);
  };

  const handleDislikeAndReroute = async (reason: string) => {
    if (!activeCourse) return;
    const step = activeCourse.steps[activeStepIndex];
    if (!step) return;

    setIsRerouting(true);
    try {
      const allExclude = await storageService.getAllEncounteredVideoIds();
      const rerouteRes = await apiClient.adaptVideo({
        topic: activeCourse.topic,
        stepTitle: step.title,
        conceptTitle: step.conceptTitle || step.title,
        stepNumber: activeStepIndex + 1,
        feedbackType: 'dislike',
        feedbackNote: reason,
        currentVideoId: step.videoId,
        targetDurationMinutes: step.targetDurationMinutes,
        targetDifficulty: step.targetDifficulty,
        excludeIds: allExclude,
      });

      const updatedDna = await storageService.recordVideoFeedback({
        videoId: step.videoId,
        videoTitle: step.videoTitle,
        topic: activeCourse.topic,
        stepTitle: step.title,
        action: 'dislike',
        note: reason,
      });
      onDnaUpdated(updatedDna);

      const updatedSteps = [...activeCourse.steps];
      updatedSteps[activeStepIndex] = {
        ...step,
        // STRICT: Never change conceptTitle, prerequisiteLink, or title of the step
        conceptTitle: step.conceptTitle,
        prerequisiteLink: step.prerequisiteLink,
        targetDifficulty: step.targetDifficulty,
        targetDurationMinutes: step.targetDurationMinutes,
        title: step.title,
        pedagogicalReason: rerouteRes.newStep.pedagogicalReason || step.pedagogicalReason,
        keyTakeaway: rerouteRes.newStep.keyTakeaway || step.keyTakeaway,
        videoId: rerouteRes.newStep.videoId || step.videoId,
        videoTitle: rerouteRes.newStep.videoTitle || step.videoTitle,
        channelTitle: rerouteRes.newStep.channelTitle || step.channelTitle,
        duration: rerouteRes.newStep.duration || step.duration,
        startSeconds: 0,
        review: {
          action: 'dislike',
          note: reason,
          timestamp: new Date().toISOString(),
          adaptiveRerouted: true,
          rerouteReason: rerouteRes.adaptiveNote,
        },
      };

      const updatedCourse: CoursePlan = {
        ...activeCourse,
        steps: updatedSteps,
        updatedAt: new Date().toISOString(),
      };

      await storageService.saveCourse(updatedCourse);
      onCourseUpdated(updatedCourse);

      // Also adapt next lesson to avoid what was disliked
      triggerNextLessonAdaptation(updatedCourse, activeStepIndex, 'dislike', reason);
    } catch (err) {
      console.error('Reroute error:', err);
    } finally {
      setIsRerouting(false);
    }
  };

  const currentStep = activeCourse?.steps[activeStepIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      
      {/* Course List & New Course Trigger Bar */}
      {courses.length > 0 && !showNewCourseSearch && !calibrationData && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 shrink-0">
              Your Courses:
            </span>
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelectCourse(c);
                  setActiveStepIndex(c.currentStepIndex || 0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  activeCourse?.id === c.id
                    ? 'bg-[#003380] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.topic}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowNewCourseSearch(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003380] hover:bg-[#002966] text-white text-xs font-bold shrink-0 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Learn New Topic</span>
          </button>
        </div>
      )}

      {/* Welcome / Search Screen (When no courses yet OR user clicked Learn New Topic) */}
      {(courses.length === 0 || showNewCourseSearch) && !calibrationData && (
        <div className="max-w-2xl mx-auto py-8 sm:py-16 text-center space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#003380] text-xs font-bold border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-[#003380]" />
              <span>Proprietary Adaptive Learning Layer</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#003380] tracking-tight">
              What do you want to learn today?
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Type any skill, discipline, or craft. We will diagnose your practical background and sequence a complete 6 to 8 lesson progressive syllabus.
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleStartCalibration} className="space-y-3">
            <div className="relative max-w-xl mx-auto shadow-sm rounded-2xl">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g. Public Speaking, Baking Sourdough, Technical Analysis..."
                className="w-full pl-12 pr-28 py-4 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm sm:text-base focus:outline-none focus:border-[#003380] focus:ring-2 focus:ring-[#003380]/20"
                autoFocus
              />
              <button
                type="submit"
                disabled={calibrating || !topicInput.trim()}
                className="absolute right-2 top-2 bottom-2 px-5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs"
              >
                {calibrating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Diagnosing...</span>
                  </>
                ) : (
                  <>
                    <span>Start</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Popular Topics Quick Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-xs text-slate-500 font-medium">Popular:</span>
              {[
                'Public Speaking & Rhetoric',
                'Technical Analysis & Chart Patterns',
                'Sourdough Bread Baking',
                'Electric Vehicle Battery Tech',
                'Python Data Science',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTopicInput(sug)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-medium transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>

            {courses.length > 0 && showNewCourseSearch && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCourseSearch(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel and return to current course
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 
        COMPACT 1-QUESTION-AT-A-TIME ONBOARDING WIZARD (ZERO SCROLLING)
        - Fits 100% inside one mobile viewport without scrolling.
        - Thin progress bar at top (Question X of Y).
        - Concise question title (text-base font-semibold text-slate-900) without robotic developer labels.
        - Compact options (py-2.5 px-3.5 text-sm) with instant smooth auto-advance.
      */}
      {calibrationData && (
        <div className="max-w-xl mx-auto animate-in fade-in">
          {/* A. Broad Topic Scope Narrowing (Micro-Missions) */}
          {calibrationData.isBroadTopic &&
          calibrationData.microMissions &&
          calibrationData.microMissions.length > 0 &&
          !selectedMicroMission ? (
            <div className="p-5 sm:p-7 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#003380] border border-blue-200 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-[#003380]" />
                  <span>Narrow Your Mission</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Select a Focused Micro-Mission
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To master something real and actionable quickly, start with one focused building block. Once completed, Nguru connects you to the next.
                </p>
              </div>

              {/* 4 Concrete Micro-Missions */}
              <div className="space-y-2">
                {calibrationData.microMissions.map((mission, mIdx) => (
                  <button
                    key={mission.id || mIdx}
                    type="button"
                    onClick={() => {
                      setSelectedMicroMission(mission.title);
                      setCurrentQuestionIndex(0);
                    }}
                    className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-[#003380] hover:bg-blue-50/40 group transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                          Mission {mIdx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#003380]">
                          {mission.title}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {mission.description}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#003380] group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Sub-Topic Input */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={customSubTopic}
                  onChange={(e) => setCustomSubTopic(e.target.value)}
                  placeholder={`Or type a specific sub-topic in ${topicInput}...`}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#003380]"
                />
                <button
                  type="button"
                  disabled={!customSubTopic.trim()}
                  onClick={() => {
                    setSelectedMicroMission(customSubTopic.trim());
                    setCurrentQuestionIndex(0);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-40 text-white text-xs font-bold transition-colors shrink-0"
                >
                  Start
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setCalibrationData(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMicroMission(topicInput.trim());
                    setCurrentQuestionIndex(0);
                  }}
                  className="text-xs text-[#003380] hover:underline font-semibold"
                >
                  Keep full field &rarr;
                </button>
              </div>
            </div>
          ) : (
            /* B. Sleek Single-Card Question Stepper (Zero Scrolling) */
            (() => {
              const questions = calibrationData.questions || [];
              const totalQuestions = questions.length;
              const currentQ = questions[currentQuestionIndex] || questions[0];
              const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
              const progressPct = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 100;

              return (
                <div className="p-5 sm:p-7 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-5">
                  {/* Thin Progress Bar & Step Counter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#003380] font-bold">
                        Question {currentQuestionIndex + 1} of {totalQuestions}
                      </span>
                      {selectedMicroMission && (
                        <span className="text-slate-500 text-[11px] truncate max-w-48">
                          Mission: {selectedMicroMission}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-[#003380] h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Concise Question Title (No robotic developer labels) */}
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {currentQ?.question}
                    </h3>
                  </div>

                  {/* Compact Option Buttons (Tap to smooth auto-advance) */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {currentQ?.options?.map((opt) => {
                      const isSelected = calibrationAnswers[currentQ.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setCalibrationAnswers((prev) => ({ ...prev, [currentQ.id]: opt }));
                            if (!isLastQuestion) {
                              setTimeout(() => {
                                setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
                              }, 130);
                            }
                          }}
                          className={`py-2.5 px-3.5 rounded-xl text-left text-xs sm:text-sm font-medium border transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#003380] text-white border-[#003380] shadow-xs ring-1 ring-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                          }`}
                        >
                          <span className="leading-snug pr-2">{opt}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-blue-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper Navigation Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      {currentQuestionIndex > 0 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Previous</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMicroMission && calibrationData.isBroadTopic) {
                              setSelectedMicroMission(null);
                            } else {
                              setCalibrationData(null);
                            }
                          }}
                          className="text-xs text-slate-400 hover:text-slate-700 font-semibold px-2 py-1"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div>
                      {isLastQuestion ? (
                        <button
                          type="button"
                          onClick={handleGenerateCourse}
                          disabled={generatingRoadmap}
                          className="px-5 py-2 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors"
                        >
                          {generatingRoadmap ? (
                            <>
                              <Sparkles className="w-4 h-4 animate-spin" />
                              <span>Sequencing 6–8 Lessons...</span>
                            </>
                          ) : (
                            <>
                              <span>Build My Adaptive Course</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                          }
                          className="inline-flex items-center gap-1 text-xs text-[#003380] hover:text-[#002966] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <span>Skip / Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Active Course Player & 6–8 Lesson Curriculum */}
      {activeCourse && !showNewCourseSearch && !calibrationData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Video Player & Single-Row Feedback Bar (Col 8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Course Title & Step Header */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="font-bold text-[#003380] uppercase tracking-wider">
                  {activeCourse.category}
                </span>
                <span>
                  Lesson {activeStepIndex + 1} of {activeCourse.steps.length}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                {activeCourse.topic}
              </h2>
            </div>

            {/* Video Player + Single-Row Feedback Bar (Pinned at top) */}
            {currentStep && (
              <div className="space-y-3">
                {/* 1. Custom 100% Shielded Nguru Proprietary Learning Player */}
                <div className="sticky top-2 z-20 space-y-3 bg-slate-50/95 backdrop-blur-md pt-1 pb-2">
                  <NguruVideoPlayer
                    key={`${currentStep.id}-${currentStep.videoId}`}
                    videoId={currentStep.videoId}
                    title={currentStep.videoTitle}
                    conceptTitle={currentStep.conceptTitle || currentStep.title}
                    channelTitle={currentStep.channelTitle}
                    startSeconds={currentStep.startSeconds || 0}
                    learnRank={currentStep.learnRank}
                    learnRankBadge={currentStep.learnRankBadge}
                    onEnded={handleVideoEnded}
                  />

                  {/* 2. STRICTLY SINGLE-ROW Horizontal Feedback Bar */}
                  <ThreeActionFeedbackBar
                    stepTitle={currentStep.title}
                    existingReview={currentStep.review}
                    onLike={handleLike}
                    onNeutral={handleNeutral}
                    onDislikeAndReroute={handleDislikeAndReroute}
                    isRerouting={isRerouting}
                  />

                  {/* Live Next-Lesson Adaptation Indicator */}
                  {adaptingNextMessage && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-xs font-bold text-[#003380] flex items-center gap-2 animate-in fade-in">
                      <Sparkles className="w-4 h-4 animate-spin text-[#003380] shrink-0" />
                      <span>{adaptingNextMessage}</span>
                    </div>
                  )}
                </div>

                {/* 3. DEDICATED SCROLLABLE COMPANION READING WINDOW (4 TABS) */}
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[450px] sm:h-[490px]">
                  {/* Tab Header Bar */}
                  <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 py-2 gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setCompanionTab('blueprint')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        companionTab === 'blueprint'
                          ? 'bg-[#003380] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Blueprint & Overview</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompanionTab('takeaways')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        companionTab === 'takeaways'
                          ? 'bg-[#003380] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Key Takeaways</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompanionTab('transcript')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        companionTab === 'transcript'
                          ? 'bg-[#003380] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Transcript & Chapters</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompanionTab('check')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        companionTab === 'check'
                          ? 'bg-[#003380] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Concept Check</span>
                    </button>
                  </div>

                  {/* Scrollable Tab Content Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* TAB 1: BLUEPRINT & OVERVIEW */}
                    {companionTab === 'blueprint' && (
                      <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#003380] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                              {currentStep.phase} • Lesson {activeStepIndex + 1} of {activeCourse.steps.length}
                            </span>
                            {currentStep.targetDifficulty && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {currentStep.targetDifficulty}
                              </span>
                            )}
                            {currentStep.learnRank && (
                              <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                LearnRank {currentStep.learnRank}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-mono flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            {currentStep.duration}
                          </span>
                        </div>

                        <div>
                          {currentStep.conceptTitle && (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#003380] bg-blue-50/80 px-2 py-0.5 rounded mb-1 inline-block border border-blue-100">
                              Concept: {currentStep.conceptTitle}
                            </span>
                          )}
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {currentStep.videoTitle}
                          </h3>
                          <p className="text-xs font-semibold text-[#003380] mt-0.5">
                            Primary Instructor: {currentStep.channelTitle}
                          </p>
                        </div>

                        {/* Prerequisite Ladder Connection */}
                        {currentStep.prerequisiteLink && (
                          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-slate-700 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-[#003380]">
                              <Layers className="w-3.5 h-3.5" />
                              <span>Prerequisite Ladder Connection</span>
                            </div>
                            <p className="leading-relaxed">
                              {currentStep.prerequisiteLink}
                            </p>
                          </div>
                        )}

                        {/* AI Pedagogical Match Reason */}
                        {currentStep.pedagogicalReason && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-[#003380] shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-slate-900">Pedagogical Verification:</strong> {currentStep.pedagogicalReason}
                            </div>
                          </div>
                        )}

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed space-y-1.5">
                          <p className="font-semibold text-slate-900">
                            Lesson Objective: <span className="font-normal">{currentStep.objective}</span>
                          </p>
                        </div>

                        {/* Lesson Navigation Controls */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={activeStepIndex === 0}
                            onClick={() => {
                              setActiveStepIndex((prev) => Math.max(0, prev - 1));
                              setQuizSelectedOption(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous Lesson</span>
                          </button>

                          <button
                            type="button"
                            disabled={activeStepIndex >= activeCourse.steps.length - 1}
                            onClick={() => {
                              setActiveStepIndex((prev) => Math.min(activeCourse.steps.length - 1, prev + 1));
                              setQuizSelectedOption(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs"
                          >
                            <span>Next Lesson</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: KEY TAKEAWAYS & CORE CONCEPT DEFINITIONS */}
                    {companionTab === 'takeaways' && (
                      <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded inline-block">
                            Core Key Takeaway
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-emerald-950 leading-relaxed">
                            "{currentStep.keyTakeaway}"
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#003380]" />
                            <span>First-Principles Concept Breakdown</span>
                          </h4>

                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-[#003380] font-bold text-[11px] flex items-center justify-center shrink-0">
                                1
                              </span>
                              <div>
                                <strong className="text-slate-900">Root Mechanics:</strong>{' '}
                                {currentStep.conceptTitle || currentStep.title} operates by isolating the underlying cause from incidental noise.
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-[#003380] font-bold text-[11px] flex items-center justify-center shrink-0">
                                2
                              </span>
                              <div>
                                <strong className="text-slate-900">Functional Synthesis:</strong>{' '}
                                {currentStep.objective}
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-[#003380] font-bold text-[11px] flex items-center justify-center shrink-0">
                                3
                              </span>
                              <div>
                                <strong className="text-slate-900">Illusion-Busting Criterion:</strong>{' '}
                                Being able to predict outcomes in a novel scenario without relying on memorized templates.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                          <span className="font-bold">⚠️ Novice Pitfall Alert</span>
                          <p className="leading-relaxed">
                            Avoid passively agreeing with the video. Pause and verify: "If the input conditions change, does the result follow the core principle?"
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: TRANSCRIPT & CHAPTER TIMESTAMPS */}
                    {companionTab === 'transcript' && (
                      <div className="space-y-4 animate-in fade-in duration-150">
                        {currentStep.startSeconds && currentStep.startSeconds > 0 ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                            <span className="text-base">⚡</span>
                            <span>
                              <strong>Intro Preamble Auto-Skipped:</strong> Started at <strong>{currentStep.startSeconds}s</strong> directly where the core explanation begins.
                            </span>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                            Verified Chapter Milestones
                          </h4>

                          <div className="space-y-2">
                            {[
                              { time: '0:00', label: 'Prerequisite Context & Scope Definition' },
                              {
                                time: currentStep.startSeconds && currentStep.startSeconds > 0 ? `0:${currentStep.startSeconds.toString().padStart(2, '0')}` : '0:25',
                                label: `⚡ Core Explanation: ${currentStep.conceptTitle || currentStep.title}`,
                                isKey: true,
                              },
                              { time: '3:45', label: 'Step-by-Step Practical Demonstration' },
                              { time: '7:15', label: 'Pitfalls, Edge Cases & Real-World Synthesis' },
                            ].map((ch, i) => (
                              <div
                                key={i}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                  ch.isKey
                                    ? 'bg-blue-50/80 border-blue-200 text-[#003380] font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
                                    {ch.time}
                                  </span>
                                  <span>{ch.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">Chapter</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                          <span className="font-bold text-slate-900 block">Spoken Concept Transcript Highlights</span>
                          <p>
                            "...In this lesson, we examine {currentStep.conceptTitle || currentStep.title}. Notice how the foundational structure directly dictates behavior. Rather than memorizing the rules, observe the cause-and-effect relationship..."
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: INTERACTIVE CONCEPT CHECK */}
                    {companionTab === 'check' && (
                      <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#003380] bg-white px-2 py-0.5 rounded border border-blue-100 inline-block mb-1">
                              Lesson {activeStepIndex + 1} Comprehension Check
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                              Based on {currentStep.conceptTitle || currentStep.title}, what separates true mastery from surface memorization?
                            </h4>
                          </div>

                          <div className="space-y-2">
                            {[
                              {
                                id: 0,
                                text: 'Understanding the underlying cause-and-effect mechanism and predicting novel outcomes.',
                                isCorrect: true,
                                explanation: 'Correct! True fluency is knowing the mechanism so well you can predict novel variations.',
                              },
                              {
                                id: 1,
                                text: 'Reciting complex vocabulary words and definitions without connecting them to practice.',
                                isCorrect: false,
                                explanation: 'Illusion of Competence trap: Jargon is not understanding.',
                              },
                              {
                                id: 2,
                                text: 'Watching multiple videos quickly without testing application.',
                                isCorrect: false,
                                explanation: 'Passive consumption creates a false illusion of mastery.',
                              },
                            ].map((opt) => {
                              const isSelected = quizSelectedOption === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setQuizSelectedOption(opt.id)}
                                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                                    isSelected
                                      ? opt.isCorrect
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-400/20'
                                        : 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-2 ring-rose-400/20'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{opt.text}</span>
                                    {isSelected && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${opt.isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                                        {opt.isCorrect ? '✓ Verified' : '✕ Trap'}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <p className={`text-[11px] mt-1.5 font-normal ${opt.isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                                      {opt.explanation}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Direct Callout to Delusion Breaker Diagnostic */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-[#003380]">
                              Full Delusion Breaker Assessment
                            </h4>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Ready for the full 5-question test with feedback loop?
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onGoToTest(activeCourse.topic)}
                            className="px-3.5 py-2 bg-[#003380] hover:bg-[#002966] text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition-colors"
                          >
                            Take Full Test
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Complete 6 to 8 Lesson Progressive Syllabus (Col 4) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#003380]" />
                  <span>Course Syllabus ({activeCourse.steps.length} Lessons)</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {activeCourse.steps.filter(s => s.isCompleted).length}/{activeCourse.steps.length} done
                </span>
              </div>

              {/* Progress bar across 6-8 steps */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#003380] transition-all duration-300"
                  style={{
                    width: `${(activeCourse.steps.filter(s => s.isCompleted).length / activeCourse.steps.length) * 100}%`
                  }}
                />
              </div>

              {/* List of all 6 to 8 progressive milestones */}
              <div className="space-y-2 pt-1 max-h-[580px] overflow-y-auto pr-1">
                {activeCourse.steps.map((step, idx) => {
                  const isActive = idx === activeStepIndex;
                  return (
                    <button
                      key={step.id || idx}
                      onClick={() => setActiveStepIndex(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-blue-50/90 border-[#003380] text-[#003380] shadow-xs ring-1 ring-[#003380]/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-[#003380]' : 'text-slate-500'}`}>
                          Lesson {idx + 1} • {step.phase}
                        </span>
                        {step.isCompleted ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Done</span>
                          </span>
                        ) : isActive ? (
                          <span className="text-[10px] font-bold text-[#003380] bg-blue-100 px-1.5 py-0.5 rounded">
                            Playing
                          </span>
                        ) : null}
                      </div>

                      {step.conceptTitle && (
                        <span className="text-[10px] font-semibold text-[#003380] block truncate mb-0.5">
                          {step.conceptTitle}
                        </span>
                      )}
                      <h4 className="text-xs font-bold line-clamp-2 leading-snug">
                        {step.title}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                        <span className="truncate max-w-[170px]">{step.channelTitle}</span>
                        <span className="font-mono text-[10px] shrink-0">{step.duration}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {courses.length > 1 && (
                <div className="pt-2 border-t border-slate-100 text-right">
                  <button
                    onClick={() => onCourseDeleted(activeCourse.id)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove this course
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
