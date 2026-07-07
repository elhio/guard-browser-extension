import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { RadioCard } from '@/components/ui/RadioCard';
import { t } from '@/lib/i18n';
import { fetchUserProfile, fetchUserSpaces, type SpacePublic } from '@/lib/api';
import type { TasksState } from '@/components/setup/TaskSelectionStep';

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

  const generateDynamicDescription = (space: SpacePublic) => {
    const andStr = t('space_conj_and');

    const tasksList = space.enabled_task_names || [];
    let formattedTasks = '';
    if (tasksList.length === 1) formattedTasks = tasksList[0];
    else if (tasksList.length > 1) {
      const last = tasksList[tasksList.length - 1];
      const rest = tasksList.slice(0, -1);
      formattedTasks = rest.join(', ') + andStr + last;
    }

    const mediaList = space.enabled_media || [];
    const mediaMapped = mediaList.map((m) => {
      if (m === 'image') return t('space_media_image');
      if (m === 'video') return t('space_media_video');
      return m;
    });

    let formattedMedia = '';
    if (mediaMapped.length === 1) formattedMedia = mediaMapped[0];
    else if (mediaMapped.length > 1) {
      const last = mediaMapped[mediaMapped.length - 1];
      const rest = mediaMapped.slice(0, -1);
      formattedMedia = rest.join(', ') + andStr + last;
    }

    const predictor = space.predictor_name || t('space_fallback_model');
    const template = t('space_desc_template');

    if (!formattedTasks || !formattedMedia) {
      return space.description || t('setup_verificator_no_desc_fallback');
    }

    return template
      .replace('{tasks}', formattedTasks)
      .replace('{media}', formattedMedia)
      .replace('{predictor}', predictor);
  };

  const checkSpaceEligibility = useCallback((space: SpacePublic): { eligible: boolean; reason?: string } => {
    if (!space.enabled_media?.includes('image')) {
      return { eligible: false, reason: t('setup_verificator_error_media') };
    }

    const enabledTasks = space.enabled_task_names || [];

    if (tasks.aiGenerated && !enabledTasks.some(t => ['AI-Generated', 'AI-Generiert'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_ai') };
    }
    if (tasks.violent && !enabledTasks.some(t => ['Violent', 'Gewalttätig'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_violent') };
    }
    if (tasks.explicit && !enabledTasks.some(t => ['Explicit', 'Explizit'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_explicit') };
    }

    return { eligible: true };
  }, [tasks]);

  useEffect(() => {
    if (selectedSpace && spaces.length > 0) {
      const activeSpace = spaces.find(s => s.id === selectedSpace);
      if (activeSpace) {
        const { eligible } = checkSpaceEligibility(activeSpace);
        if (!eligible) {
          queueMicrotask(() => {
            onSelect('');
          });
        }
      }
    }
  }, [selectedSpace, spaces, checkSpaceEligibility, onSelect]);

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
              const { eligible, reason } = checkSpaceEligibility(space);

              return (
                <RadioCard
                  key={space.id}
                  id={space.id}
                  name="advancedSpace"
                  title={space.name}
                  description={generateDynamicDescription(space)}
                  checked={selectedSpace === space.id}
                  disabled={!eligible}
                  disabledReason={reason}
                  onChange={onSelect}
                />
              );
            })
          ) : isAuthenticated && !isLoading ? (
            <p className="text-sm text-gray-500">{t('setup_verificator_no_workspaces')}</p>
          ) : (
            <>
              <RadioCard
                id="mock1"
                name="mock"
                title={t('setup_verificator_mock_personal_title')}
                description={t('setup_verificator_mock_personal_desc')}
                checked={false}
                onChange={() => {}}
              />
              <RadioCard
                id="mock2"
                name="mock"
                title={t('setup_verificator_mock_team_title')}
                description={t('setup_verificator_mock_team_desc')}
                checked={false}
                onChange={() => {}}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}