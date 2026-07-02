import { useEffect, useState } from 'react';
import { RadioCard } from '@/components/ui/RadioCard';
import { t, getAppLocale } from '@/lib/i18n';
import type { SpacePublic } from '@/types/api';
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
  const [spaces, setSpaces] = useState<SpacePublic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If the user skipped, completely abort the fetch even if a token exists
    if (!isAuthenticated || !token) return;

    const fetchSpaces = async () => {
      setIsLoading(true);
      try {
        const baseUrl = import.meta.env.VITE_API_URL;
        const currentLang = getAppLocale();

        const userResponse = await fetch(`${baseUrl}/api/v1/users/me?lang=${currentLang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userResponse.ok) {
          throw new Error(`Failed to fetch user: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        const spacesResponse = await fetch(`${baseUrl}/api/v1/spaces/?user_id=${userId}&lang=${currentLang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!spacesResponse.ok) {
          throw new Error(`Failed to fetch spaces: ${spacesResponse.status}`);
        }

        const spacesJson = await spacesResponse.json();
        setSpaces(spacesJson.data || []);
      } catch (error) {
        console.error('Error fetching spaces:', error);
        // If the fetch fails, you might want to clear the spaces to trigger the empty state safely
        setSpaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpaces();
  }, [token, isAuthenticated]);

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

  const checkSpaceEligibility = (space: SpacePublic): { eligible: boolean; reason?: string } => {
    if (!space.enabled_media?.includes('image')) {
      return { eligible: false, reason: t('setup_verificator_error_media') };
    }

    const enabledTasks = space.enabled_task_names || [];

    if (tasks.ai && !enabledTasks.some(t => ['AI-Generated', 'AI-Generiert'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_ai') };
    }
    if (tasks.violent && !enabledTasks.some(t => ['Violent', 'Gewalttätig'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_violent') };
    }
    if (tasks.explicit && !enabledTasks.some(t => ['Explicit', 'Explizit'].includes(t))) {
      return { eligible: false, reason: t('setup_verificator_error_task_explicit') };
    }

    return { eligible: true };
  };

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

              if (!eligible && selectedSpace === space.id) {
                setTimeout(() => onSelect(''), 0);
              }

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