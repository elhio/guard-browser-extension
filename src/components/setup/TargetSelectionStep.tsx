import { CheckboxCard } from '@/components/ui/CheckboxCard';
import { t } from '@/lib/i18n';
import type { TargetsState } from '@/lib/detection';

interface TargetSelectionStepProps {
  targets: TargetsState;
  onToggle: (targetId: keyof TargetsState) => void;
}

export function TargetSelectionStep({ targets, onToggle }: TargetSelectionStepProps) {
  const availableTargets = [
    {
      id: 'aiGenerated',
      title: t('setup_target_ai_title'),
      desc: t('setup_target_ai_desc')
    },
    {
      id: 'violent',
      title: t('setup_target_violent_title'),
      desc: t('setup_target_violent_desc')
    },
    {
      id: 'explicit',
      title: t('setup_target_explicit_title'),
      desc: t('setup_target_explicit_desc')
    },
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
        {t('setup_targets_heading')}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {t('setup_targets_subheading')}
      </p>

      <div className="flex flex-col gap-3">
        {availableTargets.map((target) => (
          <CheckboxCard
            key={target.id}
            id={target.id}
            title={target.title}
            description={target.desc}
            checked={targets[target.id]}
            onChange={(id) => onToggle(id as keyof TargetsState)}
          />
        ))}
      </div>
    </div>
  );
}