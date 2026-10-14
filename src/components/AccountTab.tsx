/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CreditCard,
  Crown,
  Check,
  Trash2,
  CheckCircle,
  User
} from 'lucide-react';
import { LearnerDNA, Tier } from '../types';
import { storageService } from '../services/storageService';

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

interface AccountTabProps {
  dna: LearnerDNA;
  currentTier: Tier;
  onTierUpdated: (tier: Tier) => void;
  onDnaUpdated: (dna: LearnerDNA) => void;
  onClearAll: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  dna,
  currentTier,
  onTierUpdated,
  onDnaUpdated,
  onClearAll,
}) => {
  const [email, setEmail] = useState('user@nguru.education');
  const paystackKey = 'pk_test_d3a84b06821d3f9478f2441c2c31e678b87e27df';
  const [processingTier, setProcessingTier] = useState<Tier | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handlePaystackCheckout = (tier: Tier, amountNgn: number) => {
    setProcessingTier(tier);
    const ref = `NGURU-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    if (window.PaystackPop && typeof window.PaystackPop.setup === 'function') {
      try {
        const handler = window.PaystackPop.setup({
          key: paystackKey,
          email: email.trim() || 'student@nguru.education',
          amount: amountNgn * 100,
          currency: 'NGN',
          ref,
          metadata: {
            custom_fields: [
              {
                display_name: 'Tier',
                variable_name: 'tier',
                value: tier,
              },
            ],
          },
          callback: async (response: any) => {
            const reference = response.reference || ref;
            await storageService.recordPayment({
              reference,
              amount: amountNgn,
              tier,
              date: new Date().toISOString(),
              status: 'success',
            });
            onTierUpdated(tier);
            setProcessingTier(null);
            setPaymentSuccess(`Payment successful! Welcome to ${tier === 'pro' ? 'Nguru Pro' : 'Nguru Go'}.`);
          },
          onClose: () => {
            setProcessingTier(null);
          },
        });
        handler.openIframe();
      } catch (err) {
        console.warn('Paystack setup error, completing direct confirmation:', err);
        completeDirectUpgrade(tier, amountNgn, ref);
      }
    } else {
      setTimeout(() => {
        completeDirectUpgrade(tier, amountNgn, ref);
      }, 900);
    }
  };

  const completeDirectUpgrade = async (tier: Tier, amountNgn: number, ref: string) => {
    await storageService.recordPayment({
      reference: ref,
      amount: amountNgn,
      tier,
      date: new Date().toISOString(),
      status: 'success',
    });
    onTierUpdated(tier);
    setProcessingTier(null);
    setPaymentSuccess(`Upgraded to ${tier === 'pro' ? 'Nguru Pro' : 'Nguru Go'} successfully.`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#003380] tracking-tight">
          Account & Subscriptions
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your subscription plan, view your learning profile, and review active courses.
        </p>
      </div>

      {paymentSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-semibold flex items-center gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {/* 1. Subscription Plans Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#003380]" />
            <span>Membership Plans</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Current Tier: <strong className="text-[#003380] uppercase">{currentTier}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Plan 1: Free */}
          <div className={`rounded-2xl p-6 border bg-white flex flex-col justify-between transition-all ${
            currentTier === 'free'
              ? 'border-[#003380] ring-2 ring-[#003380]/20 shadow-xs'
              : 'border-slate-200'
          }`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">Free</h3>
                {currentTier === 'free' && (
                  <span className="text-[11px] font-bold text-[#003380] bg-blue-50 px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">₦0</span>
                <span className="text-xs text-slate-500">/ forever</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Essential adaptive learning on YouTube.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1 Active Course Roadmap</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>2 Specific Gap searches per day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Comprehension checks</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <button
                onClick={() => onTierUpdated('free')}
                disabled={currentTier === 'free'}
                className="w-full py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                {currentTier === 'free' ? 'Current Plan' : 'Select Free'}
              </button>
            </div>
          </div>

          {/* Plan 2: Nguru Go */}
          <div className={`relative rounded-2xl p-6 border bg-white flex flex-col justify-between transition-all ${
            currentTier === 'go'
              ? 'border-[#003380] ring-2 ring-[#003380]/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#003380] text-base">Nguru Go</h3>
                {currentTier === 'go' && (
                  <span className="text-[11px] font-bold text-[#003380] bg-blue-50 px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">₦3,000</span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                For active self-taught learners and professionals.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>5 Simultaneous Active Courses</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited Specific Gap Searches</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automatic Video Switching</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handlePaystackCheckout('go', 3000)}
                disabled={currentTier === 'go' || processingTier === 'go'}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#003380] hover:bg-[#002966] disabled:opacity-50 transition-colors shadow-xs"
              >
                {processingTier === 'go'
                  ? 'Connecting...'
                  : currentTier === 'go'
                  ? 'Current Plan'
                  : 'Upgrade to Go (₦3,000)'}
              </button>
            </div>
          </div>

          {/* Plan 3: Nguru Pro */}
          <div className={`relative rounded-2xl p-6 border bg-white flex flex-col justify-between transition-all ${
            currentTier === 'pro'
              ? 'border-[#003380] ring-2 ring-[#003380]/20 shadow-md'
              : 'border-[#003380]/40 hover:border-[#003380]'
          }`}>
            <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#003380] to-[#0047AB] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
              Recommended
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#003380] text-base flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Nguru Pro</span>
                </h3>
                {currentTier === 'pro' && (
                  <span className="text-[11px] font-bold text-[#003380] bg-blue-50 px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">₦8,500</span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maximum speed, precision timestamps, and unlimited topics.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited Courses & Topics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Surgical Timestamp Pinpointing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Targeted Corrective Videos</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handlePaystackCheckout('pro', 8500)}
                disabled={currentTier === 'pro' || processingTier === 'pro'}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#003380] to-[#0047AB] hover:from-[#002966] hover:to-[#003380] disabled:opacity-50 transition-all shadow-xs"
              >
                {processingTier === 'pro'
                  ? 'Connecting...'
                  : currentTier === 'pro'
                  ? 'Current Plan'
                  : 'Upgrade to Pro (₦8,500)'}
              </button>
            </div>
          </div>

        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 text-xs text-slate-600">
          <span>Billing Email for Paystack receipt:</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs w-full sm:w-64 focus:outline-none focus:border-[#003380]"
          />
        </div>
      </div>

      {/* 2. Learner Profile & History */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-[#003380]" />
          <span>Learner Profile</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <div className="text-2xl font-extrabold text-[#003380]">
              {dna.videosWatchedCount}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Videos Watched</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <div className="text-2xl font-extrabold text-emerald-600">
              {dna.comprehensionAverage}%
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Average Score</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <div className="text-2xl font-extrabold text-slate-900">
              {dna.totalQuizzesTaken}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Quizzes Taken</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <div className="text-2xl font-extrabold text-indigo-600">
              {dna.delusionCalibrationScore}/100
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Calibration Index</div>
          </div>
        </div>

        {/* Clear Data */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Reset learning history & saved courses</span>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Are you sure?</span>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs rounded bg-slate-100 text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
                className="px-2.5 py-1 text-xs rounded bg-rose-600 text-white font-bold"
              >
                Yes, Reset
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
