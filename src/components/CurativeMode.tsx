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
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(activeCourse?.currentStepIndex || 0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [showNewCourseSearch, setShowNewCourseSearch] = useState(false);
  const [adaptingNextMessage, setAdaptingNextMessage] = useState<string | null>(null);

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
    try {
      const allExclude = await storageService.getAllEncounteredVideoIds();
      const roadmap = await apiClient.generateRoadmap(
        topicInput,
        calibrationAnswers,
        dna,
        allExclude
      );

      const newPlan: CoursePlan = {
        id: `course-${Date.now()}`,
        topic: topicInput.trim(),
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

      {/* Practical Situational Calibration Questions */}
      {calibrationData && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-md space-y-6 animate-in fade-in">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#003380] bg-blue-50 px-2.5 py-1 rounded-md">
              {calibrationData.category}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
              {calibrationData.suggestedTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Answer these practical situational questions so we can sequence your 6–8 lesson progressive curriculum.
            </p>
          </div>

          <div className="space-y-5">
            {calibrationData.questions.map((q, idx) => {
              const pillarInfo =
                q.pillar === 'baseline'
                  ? { label: 'Pillar 1: Baseline Floor', color: 'bg-blue-50 text-[#003380] border-blue-200' }
                  : q.pillar === 'ceiling'
                  ? { label: 'Pillar 2: Target Ceiling (Where to Stop)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                  : q.pillar === 'duration'
                  ? { label: 'Pillar 3: Lesson Duration Bracket', color: 'bg-purple-50 text-purple-800 border-purple-200' }
                  : { label: 'Pillar 4: Learning Style & Format', color: 'bg-amber-50 text-amber-800 border-amber-200' };

              return (
                <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${pillarInfo.color}`}>
                      {pillarInfo.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Step {idx + 1} of {calibrationData.questions.length}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    {q.question}
                  </p>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {q.options.map((opt) => {
                      const isSelected = calibrationAnswers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setCalibrationAnswers((prev) => ({ ...prev, [q.id]: opt }))
                          }
                          className={`p-3 rounded-xl text-left text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-[#003380] text-white border-[#003380] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCalibrationData(null)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleGenerateCourse}
              disabled={generatingRoadmap}
              className="px-6 py-2.5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors"
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
          </div>
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

            {/* Video Player + Single-Row Feedback Bar */}
            {currentStep && (
              <div className="space-y-3">
                {/* 1. Custom 100% Shielded Nguru Proprietary Learning Player */}
                <NguruVideoPlayer
                  videoId={currentStep.videoId}
                  title={currentStep.videoTitle}
                  conceptTitle={currentStep.conceptTitle || currentStep.title}
                  channelTitle={currentStep.channelTitle}
                  startSeconds={currentStep.startSeconds || 0}
                  onEnded={handleVideoEnded}
                  feedbackBar={
                    <ThreeActionFeedbackBar
                      stepTitle={currentStep.title}
                      existingReview={currentStep.review}
                      onLike={handleLike}
                      onNeutral={handleNeutral}
                      onDislikeAndReroute={handleDislikeAndReroute}
                      isRerouting={isRerouting}
                    />
                  }
                />

                {/* 2. STRICTLY SINGLE-ROW Horizontal Feedback Bar in Page View */}
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
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-xs font-bold text-[#003380] flex items-center gap-2 animate-in fade-in">
                    <Sparkles className="w-4 h-4 animate-spin text-[#003380] shrink-0" />
                    <span>{adaptingNextMessage}</span>
                  </div>
                )}

                {/* 3. School-Grade Prerequisite Lesson Overview Card */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
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
                      Instructor: {currentStep.channelTitle}
                    </p>
                  </div>

                  {/* Prerequisite Ladder Connection */}
                  {currentStep.prerequisiteLink && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 space-y-1">
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
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#003380] shrink-0" />
                      <span><strong>AI Pedagogical Match:</strong> {currentStep.pedagogicalReason}</span>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed space-y-1.5">
                    <p className="font-semibold text-slate-900">
                      Lesson Focus: <span className="font-normal">{currentStep.objective}</span>
                    </p>
                    <p className="font-semibold text-emerald-900">
                      Key Takeaway: <span className="font-normal text-emerald-950">{currentStep.keyTakeaway}</span>
                    </p>
                  </div>

                  {/* Lesson Navigation Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={activeStepIndex === 0}
                      onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous Lesson</span>
                    </button>

                    <button
                      type="button"
                      disabled={activeStepIndex >= activeCourse.steps.length - 1}
                      onClick={() => setActiveStepIndex((prev) => Math.min(activeCourse.steps.length - 1, prev + 1))}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#003380] hover:bg-[#002966] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <span>Next Lesson</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 4. Check Comprehension Quiz Callout */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#003380]">
                      Ready for the Delusion Breaker Quiz?
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Take the 5-question test after working through your lessons to detect blind spots.
                    </p>
                  </div>
                  <button
                    onClick={() => onGoToTest(activeCourse.topic)}
                    className="px-4 py-2 bg-[#003380] hover:bg-[#002966] text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition-colors"
                  >
                    Take Test
                  </button>
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
