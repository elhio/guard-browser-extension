import { t } from '@/lib/i18n';
import type { DetectionCategory } from '@/lib/detection';
import { resolveTaskView } from '@/lib/overlay/taskView';
import type { OverlayEntry } from '@/lib/overlay/store';
import { ProgressRing } from './ProgressRing';

interface TaskPanelProps {
  category: DetectionCategory;
  entry: OverlayEntry | null;
}

/** The body of the active tab: progress ring + label + (verified) description, with loading/error states. */
export function TaskPanel({ category, entry }: TaskPanelProps) {
  const status = entry?.status ?? 'processing';

  if (status === 'processing') {
    return (
      <div className="flex items-start gap-3 p-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 flex-1 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ⚠ {entry?.errorMessage || t('badge_error_analyze')}
        </p>
      </div>
    );
  }

  const view = resolveTaskView(category, entry);
  const pending = view.pending;

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <ProgressRing score={pending ? 0 : view.score} alert={!pending && view.isAlert} spinning={pending} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {pending ? t('menu_action_verifying') : view.label}
          </p>
        </div>
      </div>

      {!pending && view.description && (
        <p className="mt-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{view.description}</p>
      )}
    </div>
  );
}
