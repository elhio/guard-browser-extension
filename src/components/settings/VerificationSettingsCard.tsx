import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LuExternalLink } from 'react-icons/lu';
import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { getAppLocale, t } from '@/lib/i18n';
import type { SpacePublic } from '@/types/api';

interface TasksState {
  aiGenerated: boolean;
  violent: boolean;
  explicit: boolean;
}

export function VerificationSettingsCard() {
  const [spaces, setSpaces] = useState<SpacePublic[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TasksState>({ aiGenerated: true, violent: true, explicit: true });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const storage = await browser.storage.local.get(['token', 'selectedSpace', 'tasks']);

        if (storage.selectedSpace) setSelectedSpace(storage.selectedSpace);
        if (storage.tasks) setTasks(storage.tasks);

        const token = storage.token;
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);
        const baseUrl = import.meta.env.VITE_API_URL;
        const currentLang = getAppLocale();

        const userResponse = await fetch(`${baseUrl}/api/v1/users/me?lang=${currentLang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userResponse.ok) throw new Error('Failed to fetch user');
        const userData = await userResponse.json();

        const spacesResponse = await fetch(`${baseUrl}/api/v1/spaces/?user_id=${userData.id}&lang=${currentLang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!spacesResponse.ok) throw new Error('Failed to fetch spaces');
        const spacesJson = await spacesResponse.json();

        setSpaces(spacesJson.data || []);
      } catch (error) {
        console.error('Error fetching spaces:', error);
        setSpaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpaces();
  }, []);

  const handleSelectSpace = async (spaceId: string) => {
    const newSelection = selectedSpace === spaceId ? null : spaceId;
    setSelectedSpace(newSelection);
    await browser.storage.local.set({ selectedSpace: newSelection });
  };

  const generateDynamicDescription = (space: SpacePublic) => {
    const andStr = t('settings_verification_conj_and');
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
      if (m === 'image') return t('settings_verification_media_image');
      if (m === 'video') return t('settings_verification_media_video');
      return m;
    });

    let formattedMedia = '';
    if (mediaMapped.length === 1) formattedMedia = mediaMapped[0];
    else if (mediaMapped.length > 1) {
      const last = mediaMapped[mediaMapped.length - 1];
      const rest = mediaMapped.slice(0, -1);
      formattedMedia = rest.join(', ') + andStr + last;
    }

    const predictor = space.predictor_name || t('settings_verification_fallback_model');
    const template = t('settings_verification_desc_template');

    if (!formattedTasks || !formattedMedia) {
      return space.description || t('settings_verification_no_desc_fallback');
    }

    return template
      .replace('{tasks}', formattedTasks)
      .replace('{media}', formattedMedia)
      .replace('{predictor}', predictor);
  };

  // Adapted eligibility checker using local TasksState structure
  const checkSpaceEligibility = (space: SpacePublic): { eligible: boolean; reason?: string } => {
    if (!space.enabled_media?.includes('image')) {
      return { eligible: false, reason: t('settings_verification_error_media') };
    }

    const enabledTasks = space.enabled_task_names || [];

    if (tasks.aiGenerated && !enabledTasks.some(t => ['AI-Generated', 'AI-Generiert'].includes(t))) {
      return { eligible: false, reason: t('settings_verification_error_task_ai') };
    }
    if (tasks.violent && !enabledTasks.some(t => ['Violent', 'Gewalttätig'].includes(t))) {
      return { eligible: false, reason: t('settings_verification_error_task_violent') };
    }
    if (tasks.explicit && !enabledTasks.some(t => ['Explicit', 'Explizit'].includes(t))) {
      return { eligible: false, reason: t('settings_verification_error_task_explicit') };
    }

    return { eligible: true };
  };

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
          const { eligible, reason } = checkSpaceEligibility(space);

          if (!eligible && selectedSpace === space.id) {
            handleSelectSpace(space.id);
          }

          return (
            <SettingsRow
              key={space.id}
              label={<span className={!eligible ? "opacity-60" : ""}>{space.name}</span>}
              description={<span className={!eligible ? "opacity-60" : ""}>{generateDynamicDescription(space)}</span>}
              value={
                <div className="relative group flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSpace === space.id}
                    onChange={() => handleSelectSpace(space.id)}
                    disabled={!eligible}
                    className={`${baseCheckboxClasses} ${
                      !eligible 
                        ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                        : 'cursor-pointer'
                    }`}
                    aria-label={`${t('settings_verification_select_aria')} ${space.name}`}
                  />

                  {!eligible && reason && (
                    <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-max max-w-[250px] sm:max-w-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded py-1.5 px-3 shadow-lg text-left sm:text-center">
                      {reason}
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