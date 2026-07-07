import { useEffect, useState, useCallback } from 'react';
import { LuExternalLink } from 'react-icons/lu';
import { useQuery } from '@tanstack/react-query';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t, type MessageKey } from '@/lib/i18n';
import { settings } from '@/lib/settings';
import type { TasksState } from '@/lib/detection';
import { fetchUserProfile, fetchUserSpaces } from '@/lib/api';
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

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['userProfile', token],
    queryFn: () => fetchUserProfile(token!),
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });

  const { data: spaces = [], isLoading: isSpacesLoading } = useQuery({
    queryKey: ['userSpaces', token, user?.id],
    queryFn: () => fetchUserSpaces(token!, user!.id),
    enabled: !!token && !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  const isAuthenticated = !!token;
  const isLoading = token === undefined || isUserLoading || isSpacesLoading;

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

  const manageSpacesAction = (
    <a
      href={isAuthenticated ? `${import.meta.env.VITE_WEBSITE_URL || ''}/spaces` : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center transition-colors focus:outline-none -mr-0.5 ${
        isAuthenticated 
          ? 'text-gray-500 hover:text-gray-700 cursor-pointer' 
          : 'text-gray-500 pointer-events-none opacity-50'
      }`}
      title={isAuthenticated ? t('settings_verification_manage_title') : t('settings_verification_manage_disabled_title')}
      aria-label={t('settings_verification_manage_aria')}
    >
      <LuExternalLink size={18} />
    </a>
  );

  return (
    <SettingsSection title={t('settings_verification_title')} action={manageSpacesAction}>

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
        <p className="text-sm text-gray-500 py-3">
          {t('settings_verification_login_required')}
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
                    <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-max max-w-62.5 sm:max-w-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded py-1.5 px-3 shadow-lg text-left sm:text-center">
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