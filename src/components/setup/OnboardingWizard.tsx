import { useState } from 'react';
import { browser } from 'wxt/browser';

import { t } from '@/lib/i18n';
import { LoginForm } from '@/components/auth/LoginForm';
import { TaskSelectionStep, type TasksState } from '@/components/setup/TaskSelectionStep';
import { ActionSelectionStep } from '@/components/setup/ActionSelectionStep';
import { DetectorSelectionStep } from '@/components/setup/DetectorSelectionStep';
import { VerificatorSelectionStep } from '@/components/setup/VerificatorSelectionStep';
import { SummaryStep } from '@/components/setup/SummaryStep';
import Background from '@/assets/images/background.webp';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const [hasSkippedAuth, setHasSkippedAuth] = useState(false);
  const [tasks, setTasks] = useState<TasksState>({ ai: true, violent: true, explicit: true});
  const [detectionAction, setDetectionAction] = useState('indicate');
  const [useDetectorLocalModel, setUseDetectorLocalModel] = useState(false);
  const [verificatorSpace, setVerificatorSpace] = useState<string | null>(null);

  const isStep2Valid = tasks.ai || tasks.violent || tasks.explicit;
  const isAuthenticated = !!token && !hasSkippedAuth;

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handleFinish = async () => {
    await browser.storage.local.set({
      token: isAuthenticated ? token : null,
      isLoggedIn: isAuthenticated,
      tasks,
      detectionAction,
      useDetectorLocalModel,
      verificatorSpace: isAuthenticated ? verificatorSpace : null,
      hasCompletedSetup: true,
    });
    onComplete();
    window.close();
  };

  const toggleTask = (taskId: keyof typeof tasks) => {
    setTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row font-sans text-gray-800 bg-white">

      {/* LEFT SIDE: The Wizard Form */}
      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10 md:p-12">

        {/* Top Progress Bar - Updated math for 6 steps */}
        <div className="absolute left-0 top-0 h-1 w-full bg-gray-100">
          <div
            className="h-full bg-teal-500 transition-all duration-300 ease-in-out"
            style={{ width: `${((step - 1) / 5) * 100}%` }}
          />
        </div>

        <div className="flex w-full max-w-[420px] flex-col">

          {/* Dynamic Step Content */}
          <div className="w-full">

            {/* Step 1: Authentication Form */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                <LoginForm
                  onSuccess={(returnedToken) => {
                    setToken(returnedToken);
                    setHasSkippedAuth(false);
                    handleNext();
                  }}
                  onSkip={() => {
                    setHasSkippedAuth(true);
                    handleNext();
                  }}
                />
              </div>
            )}

            {/* Step 2: Task Selection */}
            {step === 2 && (
              <TaskSelectionStep tasks={tasks} onToggle={toggleTask} />
            )}

            {/* Step 3: Detection Action */}
            {step === 3 && (
              <ActionSelectionStep
                action={detectionAction}
                onSelect={setDetectionAction}
              />
            )}

            {/* Step 4: Default Detector */}
            {step === 4 && (
              <DetectorSelectionStep
                useDetectorLocalModel={useDetectorLocalModel}
                onToggle={() => setUseDetectorLocalModel(!useDetectorLocalModel)}
              />
            )}

            {step === 5 && (
              <VerificatorSelectionStep
                token={token}
                isAuthenticated={isAuthenticated}
                selectedSpace={verificatorSpace}
                tasks={tasks}
                onSelect={setVerificatorSpace}
              />
            )}

            {step === 6 && (
              <SummaryStep
                token={token}
                isAuthenticated={isAuthenticated}
                tasks={tasks}
                detectionAction={detectionAction}
                useDetectorLocalModel={useDetectorLocalModel}
                verificatorSpace={verificatorSpace}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          {step > 1 && (
            <div className="mt-8 flex w-full items-center justify-between shrink-0">
              <button
                onClick={handleBack}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors text-sm"
              >
                {t('setup_wizard_btn_back')}
              </button>

              {step < 6 ? (
                // Logic for Step 5
                step === 5 ? (
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors text-sm shadow-sm"
                  >
                    {/* Dynamically switch text based on whether a space is selected */}
                    {verificatorSpace ? t('setup_wizard_btn_next') : t('setup_wizard_btn_skip')}
                  </button>
                ) : (
                  // Default Weiter button for Steps 2, 3, 4
                  <div className={`relative group inline-flex ${step === 2 && !isStep2Valid ? 'cursor-not-allowed' : ''}`}>
                    <button
                      onClick={handleNext}
                      disabled={step === 2 && !isStep2Valid}
                      className={`px-8 py-3 font-medium rounded-md transition-colors text-sm shadow-sm ${
                        step === 2 && !isStep2Valid
                          ? 'bg-teal-600/50 text-white/90 pointer-events-none' 
                          : 'bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500'
                      }`}
                    >
                      {t('setup_wizard_btn_next')}
                    </button>
                  </div>
                )
              ) : (
                // Step 6: Final Button
                <button
                  onClick={handleFinish}
                  className="px-8 py-3 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors text-sm shadow-sm"
                >
                  {t('setup_wizard_btn_finish')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="hidden md:block flex-1 sticky top-0 h-screen bg-gray-50 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${Background})` }}
      />

    </div>
  );
}