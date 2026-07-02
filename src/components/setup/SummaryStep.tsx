import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { t } from '@/lib/i18n';
import type { TasksState } from '@/components/setup/TaskSelectionStep';
import type { SpacePublic } from '@/types/api';

interface SummaryStepProps {
  token: string | null;
  isAuthenticated: boolean;
  tasks: TasksState;
  detectionAction: string;
  useDetectorLocalModel: boolean;
  verificatorSpace: string | null;
}

export function SummaryStep({
  token,
  isAuthenticated,
  tasks,
  detectionAction,
  useDetectorLocalModel,
  verificatorSpace,
}: SummaryStepProps) {
  const [userName, setUserName] = useState<string>('...');
  const [spaceName, setSpaceName] = useState<string>('...');

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setUserName(t('setup_summary_skipped'));
      setSpaceName(t('setup_summary_skipped'));
      return;
    }

    const fetchDetails = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL;
        const currentLang = browser.i18n.getUILanguage().split('-')[0].toLowerCase();

        const userResponse = await fetch(`${baseUrl}/api/v1/users/me?lang=${currentLang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserName(userData.full_name || userData.name || userData.email || 'Benutzer');

          const spacesResponse = await fetch(`${baseUrl}/api/v1/spaces/?user_id=${userData.id}&lang=${currentLang}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (spacesResponse.ok) {
            const spacesJson = await spacesResponse.json();
            const selected = spacesJson.data?.find((s: SpacePublic) => s.id === verificatorSpace);
            setSpaceName(selected ? selected.name : t('setup_summary_unknown_space'));
          }
        }
      } catch (error) {
        console.error('Error fetching summary details:', error);
        setUserName(t('setup_summary_error'));
        setSpaceName(t('setup_summary_error'));
      }
    };

    fetchDetails();
  }, [token, isAuthenticated, verificatorSpace]);

  const getTasksString = () => {
    const selected = [];
    if (tasks.ai) selected.push(t('setup_summary_task_ai'));
    if (tasks.violent) selected.push(t('setup_summary_task_violent'));
    if (tasks.explicit) selected.push(t('setup_summary_task_explicit'));
    return selected.join(', ');
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
        {t('setup_summary_heading')}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {t('setup_summary_subheading')}
      </p>

      <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-5">

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_account')}</span>
          <span className="text-sm font-semibold text-gray-900">{userName}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_tasks')}</span>
          <span className="text-sm font-semibold text-gray-900">{getTasksString()}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_action')}</span>
          <span className="text-sm font-semibold text-gray-900 capitalize">
            {/* You can add a translation map here later if you have more actions than 'indicate' */}
            {detectionAction}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_default_detection')}</span>
          <span className="text-sm font-semibold text-gray-900">
            {useDetectorLocalModel
              ? t('setup_summary_metadata_lens')
              : t('setup_summary_metadata_only')}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_advanced_verification')}</span>
          <span className="text-sm font-semibold text-gray-900">{spaceName}</span>
        </div>

      </div>
    </div>
  );
}