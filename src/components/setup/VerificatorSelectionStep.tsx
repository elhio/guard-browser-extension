import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { RadioCard } from '@/components/ui/RadioCard';
import { t, type MessageKey } from '@/lib/i18n';
import { fetchUserProfile, fetchUserSpaces } from '@/lib/api';
import type { TasksState } from '@/lib/detection';
import {
  checkSpaceEligibility,
  formatSpaceDescription,
  type EligibilityReason,
} from '@/lib/verification/eligibility';

const REASON_KEYS: Record<EligibilityReason, MessageKey> = {
  media: 'setup_verificator_error_media',
  aiGenerated: 'setup_verificator_error_task_ai',
  violent: 'setup_verificator_error_task_violent',
  explicit: 'setup_verificator_error_task_explicit',
};

interface VerificatorSelectionStepProps {
  token: string | null;
  isAuthenticated: boolean;
  selectedSpace: string | null;
  tasks: TasksState;
  onSelect: (spaceId: string) => void;
}

export function VerificatorSelectionStep({
  token,
  isAuthenticated,
  selectedSpace,
  tasks,
  onSelect
}: VerificatorSelectionStepProps) {
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['userProfile', token],
    queryFn: () => fetchUserProfile(token!),
    enabled: !!token && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const { data: spaces = [], isLoading: isSpacesLoading } = useQuery({
    queryKey: ['userSpaces', token, user?.id],
    queryFn: () => fetchUserSpaces(token!, user!.id),
    enabled: !!token && !!user?.id && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isUserLoading || isSpacesLoading;

  const descriptionLabels = {
    and: t('space_conj_and'),
    mediaImage: t('space_media_image'),
    mediaVideo: t('space_media_video'),
    fallbackModel: t('space_fallback_model'),
    template: t('space_desc_template'),
    noDescFallback: t('setup_verificator_no_desc_fallback'),
  };

  useEffect(() => {
    if (selectedSpace && spaces.length > 0) {
      const activeSpace = spaces.find(s => s.id === selectedSpace);
      if (activeSpace) {
        const { eligible } = checkSpaceEligibility(activeSpace, tasks);
        if (!eligible) {
          queueMicrotask(() => {
            onSelect('');
          });
        }
      }
    }
  }, [selectedSpace, spaces, tasks, onSelect]);

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <div className={`transition-all duration-300 ${!isAuthenticated ? 'pointer-events-none opacity-40 grayscale' : ''}`}>
        <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
          {t('setup_verificator_heading')}
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {t('setup_verificator_subheading')}
        </p>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600" />
            </div>
          ) : spaces.length > 0 ? (
            spaces.map((space) => {
              const { eligible, reason } = checkSpaceEligibility(space, tasks);

              return (
                <RadioCard
                  key={space.id}
                  id={space.id}
                  name="advancedSpace"
                  title={space.name}
                  description={formatSpaceDescription(space, descriptionLabels)}
                  checked={selectedSpace === space.id}
                  disabled={!eligible}
                  disabledReason={reason ? t(REASON_KEYS[reason]) : undefined}
                  onChange={onSelect}
                />
              );
            })
          ) : isAuthenticated ? (
            <p className="text-sm text-gray-500">{t('setup_verificator_no_workspaces')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}