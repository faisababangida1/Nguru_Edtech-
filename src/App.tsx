/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar, MainTab } from './components/Navbar';
import { CurativeMode } from './components/CurativeMode';
import { SpecificMode } from './components/SpecificMode';
import { DiagnosticQuizView } from './components/DiagnosticQuizView';
import { AccountTab } from './components/AccountTab';
import { TierUpgradeModal } from './components/TierUpgradeModal';
import { storageService } from './services/storageService';
import { LearnerDNA, CoursePlan, Tier } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('learn');
  const [dna, setDna] = useState<LearnerDNA | null>(null);
  const [courses, setCourses] = useState<CoursePlan[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<Tier>('free');
  const [specificUsageToday, setSpecificUsageToday] = useState(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Cross-tab transfer state
  const [testTopic, setTestTopic] = useState('Technical Analysis');

  const loadInitialData = async () => {
    const loadedDna = await storageService.getLearnerDNA();
    const loadedCourses = await storageService.getCourses();
    const loadedActiveId = await storageService.getActiveCourseId();
    const loadedTier = await storageService.getUserTier();
    const usage = await storageService.getSpecificSearchCountToday();

    setDna(loadedDna);
    setCourses(loadedCourses);
    setActiveCourseId(loadedActiveId || loadedCourses[0]?.id || null);
    setCurrentTier(loadedTier);
    setSpecificUsageToday(usage);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSelectTier = async (newTier: Tier) => {
    await storageService.setUserTier(newTier);
    setCurrentTier(newTier);
  };

  const handleIncrementSpecificUsage = async () => {
    const next = await storageService.incrementSpecificSearchCount();
    setSpecificUsageToday(next);
  };

  const handleClearAll = async () => {
    await storageService.clearAllData();
    await loadInitialData();
  };

  const handleGoToTest = (topic: string) => {
    setTestTopic(topic);
    setActiveTab('test');
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0] || null;

  if (!dna) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-500">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-3 border-[#003380] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Loading Nguru EdTech...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#003380] selection:text-white">
      {/* Top Header & Mobile Bottom Nav */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentTier={currentTier}
        onOpenUpgradeModal={() => setUpgradeModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-24 md:pb-12">
        {activeTab === 'learn' && (
          <CurativeMode
            courses={courses}
            activeCourse={activeCourse}
            onSelectCourse={(course) => {
              setActiveCourseId(course.id);
              storageService.setActiveCourseId(course.id);
            }}
            onCourseCreated={(newCourse) => {
              setCourses((prev) => [newCourse, ...prev]);
              setActiveCourseId(newCourse.id);
            }}
            onCourseUpdated={(updatedCourse) => {
              setCourses((prev) =>
                prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
              );
            }}
            onCourseDeleted={async (courseId) => {
              await storageService.deleteCourse(courseId);
              const remaining = courses.filter((c) => c.id !== courseId);
              setCourses(remaining);
              if (activeCourseId === courseId) {
                setActiveCourseId(remaining[0]?.id || null);
              }
            }}
            dna={dna}
            onDnaUpdated={setDna}
            currentTier={currentTier}
            onOpenUpgradeModal={() => setUpgradeModalOpen(true)}
            onGoToTest={handleGoToTest}
          />
        )}

        {activeTab === 'specific' && (
          <SpecificMode
            dna={dna}
            currentTier={currentTier}
            specificUsageToday={specificUsageToday}
            onIncrementUsage={handleIncrementSpecificUsage}
            onOpenUpgradeModal={() => setUpgradeModalOpen(true)}
          />
        )}

        {activeTab === 'test' && (
          <DiagnosticQuizView
            initialTopic={testTopic}
            courses={courses}
            dna={dna}
            onDnaUpdated={setDna}
            onGoToLearn={() => setActiveTab('learn')}
          />
        )}

        {activeTab === 'account' && (
          <AccountTab
            dna={dna}
            currentTier={currentTier}
            onTierUpdated={setCurrentTier}
            onDnaUpdated={setDna}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      {/* Real Subscription Upgrade Modal */}
      <TierUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentTier={currentTier}
        onSelectTier={handleSelectTier}
      />

      {/* Clean Global Footer */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#003380]">Nguru EdTech</span>
            <span>— Learn Anything. Education for All.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Powered by Gemini & Intelligent YouTube Search</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('account')}
              className="hover:text-slate-700 transition-colors"
            >
              Account & Pricing
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
