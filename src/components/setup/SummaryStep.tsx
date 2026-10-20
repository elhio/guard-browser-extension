import { useQuery } from '@tanstack/react-query';

import { t } from '@/lib/i18n';
import type { TargetsState } from '@/lib/detection';
import type { DetectionAction } from '@/lib/settings';
import { fetchUserProfile, fetchUserSpaces } from '@/lib/api';

interface SummaryStepProps {
  token: string | null | undefined;
  isAuthenticated: boolean;
  targets: TargetsState;
  detectionAction: DetectionAction;
  useDetectorLocalModel: boolean;
  verificatorSpace: string | null;
}

export function SummaryStep({
  token,
  isAuthenticated,
  targets,
  detectionAction,
  useDetectorLocalModel,
  verificatorSpace,
}: SummaryStepProps) {
  const { data: user, isLoading: isUserLoading, isError: isUserError } = useQuery({
    queryKey: ['userProfile', token],
    queryFn: () => fetchUserProfile(),
    enabled: !!token && isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });

  const { data: spaces = [], isLoading: isSpacesLoading } = useQuery({
    queryKey: ['userSpaces', token, user?.id],
    queryFn: () => fetchUserSpaces(user!.id),
    enabled: !!token && !!user?.id && isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });

  const getTargetsString = () => {
    const selected = [];
    if (targets.aiGenerated) selected.push(t('setup_summary_target_ai'));
    if (targets.violent) selected.push(t('setup_summary_target_violent'));
    if (targets.explicit) selected.push(t('setup_summary_target_explicit'));
    return selected.join(', ');
  };

  let userName = '...';
  let spaceName = '...';

  if (!isAuthenticated || !token) {
    userName = t('setup_summary_skipped');
    spaceName = t('setup_summary_skipped');
  } else if (isUserError) {
    userName = t('setup_summary_error');
    spaceName = t('setup_summary_error');
  } else if (!isUserLoading && !isSpacesLoading) {
    userName = user?.full_name || 'User';

    if (!verificatorSpace) {
      spaceName = t('setup_summary_skipped');
    } else {
      const selected = spaces.find((s) => s.id === verificatorSpace);
      spaceName = selected ? selected.name : t('setup_summary_unknown_space');
    }
  }

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
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_targets')}</span>
          <span className="text-sm font-semibold text-gray-900">{getTargetsString()}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">{t('setup_summary_action')}</span>
          <span className="text-sm font-semibold text-gray-900 capitalize">
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