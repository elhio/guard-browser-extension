import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t, type MessageKey } from '@/lib/i18n';
import { settings, isTokenExpired } from '@/lib/settings';
import type { TasksState } from '@/lib/detection';
import { fetchUserProfile, fetchUserSpaces, isSessionRejected } from '@/lib/api';
import {
  checkSpaceEligibility,
  formatSpaceDescription,
  type EligibilityReason,
} from '@/lib/verification/eligibility';

const REASON_KEYS: Record<EligibilityReason, MessageKey> = {
  media: 'settings_verification_error_media',
  aiGenerated: 'settings_verification_error_task_ai',
  violent: 'settings_verification_error_task_violent',
  explicit: 'settings_verification_error_task_explicit',
};

export function VerificationSettingsCard() {
  const [verificatorSpace, setVerificatorSpace] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TasksState>({ aiGenerated: true, violent: true, explicit: true });
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    settings.getValue().then((res) => {
      if (!isMounted) return;
      setVerificatorSpace(res.verificatorSpace);
      setTasks(res.tasks);
      setToken(res.token);
    });

    const unwatch = settings.watch((newSettings) => {
      if (!newSettings || !isMounted) return;
      setVerificatorSpace(newSettings.verificatorSpace);
      setTasks(newSettings.tasks);
      setToken(newSettings.token);
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  const isTokenUsable = !!token && !isTokenExpired(token);

  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useQuery({
    queryKey: ['userProfile', token],
    queryFn: () => fetchUserProfile(token!),
    enabled: isTokenUsable,
    staleTime: 1000 * 60 * 10,
  });

  const { data: spaces = [], isLoading: isSpacesLoading, isError: isSpacesError } = useQuery({
    queryKey: ['userSpaces', token, user?.id],
    queryFn: () => fetchUserSpaces(token!, user!.id),
    enabled: isTokenUsable && !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  // Same split as the account card: only a refused token means the session is over. See
  // `isSessionRejected`
  const isAuthenticated = isTokenUsable && !(isUserError && isSessionRejected(userError));

  // Without the profile there is no id to list spaces with, so the spaces query never runs and the
  // render fell through to "no workspaces found"
  const isUnavailable = isAuthenticated && (isUserError || isSpacesError);

  const isLoading = token === undefined || (isTokenUsable && (isUserLoading || isSpacesLoading));

  const handleSelectSpace = useCallback(async (spaceId: string) => {
    const currentSettings = await settings.getValue();
    const newSelection = currentSettings.verificatorSpace === spaceId ? null : spaceId;

    setVerificatorSpace(newSelection);
    await settings.setValue({ ...currentSettings, verificatorSpace: newSelection });
  }, []);

  const descriptionLabels = {
    and: t('settings_verification_conj_and'),
    mediaImage: t('settings_verification_media_image'),
    mediaVideo: t('settings_verification_media_video'),
    fallbackModel: t('settings_verification_fallback_model'),
    template: t('settings_verification_desc_template'),
    noDescFallback: t('settings_verification_no_desc_fallback'),
  };

  useEffect(() => {
    if (verificatorSpace && spaces.length > 0) {
      const activeSpace = spaces.find(s => s.id === verificatorSpace);
      if (activeSpace) {
        const { eligible } = checkSpaceEligibility(activeSpace, tasks);
        if (!eligible) {
          queueMicrotask(() => {
            handleSelectSpace(activeSpace.id);
          });
        }
      }
    }
  }, [spaces, verificatorSpace, tasks, handleSelectSpace]);

  const baseCheckboxClasses = "h-4 w-4 shrink-0 rounded border-gray-300 text-teal-600 accent-teal-500 focus:outline-none transition-all";

  return (
    <SettingsSection title={t('settings_verification_title')}>

      {isLoading ? (
        <div className="flex flex-col animate-pulse">
          {[1, 2, 3].map((i) => (
            <SettingsRow
              key={`skeleton-${i}`}
              label={<div className="h-4 w-32 bg-gray-200 rounded" />}
              description={<div className="h-3 w-48 bg-gray-100 rounded mt-1" />}
              value={<div className="h-4 w-4 bg-gray-200 rounded" />}
            />
          ))}
        </div>
      ) : !isAuthenticated ? (
        <p className="text-sm text-gray-500 py-3" data-testid="verification-login-required">
          {t('settings_verification_login_required')}
        </p>
      ) : isUnavailable ? (
        <p className="text-sm text-gray-500 py-3" data-testid="verification-unavailable">
          {t('settings_verification_unavailable')}
        </p>
      ) : spaces.length === 0 ? (
        <p className="text-sm text-gray-500 py-3">
          {t('settings_verification_no_workspaces')}
        </p>
      ) : (
        spaces.map((space) => {
          const { eligible, reason } = checkSpaceEligibility(space, tasks);
          const reasonText = reason ? t(REASON_KEYS[reason]) : undefined;

          return (
            <SettingsRow
              key={space.id}
              label={<span className={!eligible ? "opacity-60" : ""}>{space.name}</span>}
              description={<span className={!eligible ? "opacity-60" : ""}>{formatSpaceDescription(space, descriptionLabels)}</span>}
              value={
                <div className="relative group flex items-center">
                  <input
                    type="checkbox"
                    checked={verificatorSpace === space.id}
                    onChange={() => handleSelectSpace(space.id)}
                    disabled={!eligible}
                    className={`${baseCheckboxClasses} ${
                      !eligible 
                        ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                        : 'cursor-pointer'
                    }`}
                    aria-label={`${t('settings_verification_select_aria')} ${space.name}`}
                  />

                  {!eligible && reasonText && (
                    <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-max max-w-62.5 sm:max-w-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[#1f2937] text-white text-xs rounded py-1.5 px-3 shadow-lg text-left sm:text-center">
                      {reasonText}
                      <div className="absolute top-full right-1.5 -mt-px border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              }
            />
          );
        })
      )}

    </SettingsSection>
  );
}