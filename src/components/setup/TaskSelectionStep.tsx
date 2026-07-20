import { CheckboxCard } from '@/components/ui/CheckboxCard';
import { t } from '@/lib/i18n';
import type { TasksState } from '@/lib/detection';

interface TaskSelectionStepProps {
  tasks: TasksState;
  onToggle: (taskId: keyof TasksState) => void;
}

export function TaskSelectionStep({ tasks, onToggle }: TaskSelectionStepProps) {
  const availableTasks = [
    {
      id: 'aiGenerated',
      title: t('setup_task_ai_title'),
      desc: t('setup_task_ai_desc')
    },
    {
      id: 'violent',
      title: t('setup_task_violent_title'),
      desc: t('setup_task_violent_desc')
    },
    {
      id: 'explicit',
      title: t('setup_task_explicit_title'),
      desc: t('setup_task_explicit_desc')
    },
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-900">
        {t('setup_tasks_heading')}
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {t('setup_tasks_subheading')}
      </p>

      <div className="flex flex-col gap-3">
        {availableTasks.map((task) => (
          <CheckboxCard
            key={task.id}
            id={task.id}
            title={task.title}
            description={task.desc}
            checked={tasks[task.id]}
            onChange={(id) => onToggle(id as keyof TasksState)}
          />
        ))}
      </div>
    </div>
  );
}