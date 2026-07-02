import { ToggleCard } from '@/components/ui/ToggleCard';
import { t } from '@/lib/i18n';

interface DetectorSelectionStepProps {
  useDetectorLocalModel: boolean;
  onToggle: () => void;
}

export function DetectorSelectionStep({
  useDetectorLocalModel,
  onToggle
}: DetectorSelectionStepProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
        {t('setup_detector_heading')}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {t('setup_detector_subheading')}
      </p>

      <div className="flex flex-col gap-3">
        <ToggleCard
          id="detector_metadata"
          title={t('setup_detector_metadata_title')}
          description={t('setup_detector_metadata_desc')}
          checked={true}
          disabled={true}
          onChange={() => {}}
        />

        <ToggleCard
          id="detector_lens_mobile"
          title={t('setup_detector_lens_title')}
          description={t('setup_detector_lens_desc')}
          checked={useDetectorLocalModel}
          onChange={onToggle}
        />
      </div>
    </div>
  );
}