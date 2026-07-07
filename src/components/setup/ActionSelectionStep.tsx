import { RadioCard } from '@/components/ui/RadioCard';
import { t } from '@/lib/i18n';

interface ActionSelectionStepProps {
  action: string;
  onSelect: (action: string) => void;
}

export function ActionSelectionStep({ action, onSelect }: ActionSelectionStepProps) {
  const options = [
    { id: 'mark', title: t('setup_action_mark_title'), desc: t('setup_action_mark_desc') },
    { id: 'blur', title: t('setup_action_blur_title'), desc: t('setup_action_blur_desc') },
    { id: 'hide', title: t('setup_action_hide_title'), desc: t('setup_action_hide_desc') },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
        {t('setup_action_heading')}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {t('setup_action_subheading')}
      </p>

      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <RadioCard
            key={opt.id}
            id={opt.id}
            name="detectionAction"
            title={opt.title}
            description={opt.desc}
            checked={action === opt.id}
            onChange={onSelect}
          />
        ))}
      </div>
    </div>
  );
}