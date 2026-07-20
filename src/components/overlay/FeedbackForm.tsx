import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { t } from '@/lib/i18n';

const FIELD_CLASS =
  'w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-100';

interface FeedbackFormProps {
  isPositive: boolean;
  taskLabel: string;
  reactions: Record<number, string>;
  onSave: (keyValue: number | null, description: string | null) => void;
  onClose: () => void;
}

/** Post-verification feedback: thank-you + optional expected result + description → Save. */
export function FeedbackForm({ isPositive, taskLabel, reactions, onSave, onClose }: FeedbackFormProps) {
  const [expected, setExpected] = useState('');
  const [description, setDescription] = useState('');

  const prompt = t(isPositive ? 'menu_feedback_prompt_correct' : 'menu_feedback_prompt_incorrect').replace(
    '{task}',
    taskLabel
  );
  const reactionEntries = Object.entries(reactions);

  const handleSave = () => {
    onSave(expected === '' ? null : Number(expected), description.trim() || null);
  };

  return (
    <>
      <div className="flex justify-end px-2 pt-2">
        <button
          type="button"
          aria-label={t('menu_close')}
          onClick={onClose}
          className="cursor-pointer px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <LuX size={16} />
        </button>
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('menu_feedback_thanks')}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{prompt}</p>

        <label className="mt-4 block text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('menu_feedback_expected_label')}
          <select value={expected} onChange={(event) => setExpected(event.target.value)} className={`mt-1 cursor-pointer ${FIELD_CLASS}`}>
            <option value="">—</option>
            {reactionEntries.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('menu_feedback_description_label')}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={`mt-1 resize-none ${FIELD_CLASS}`}
          />
        </label>
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <button
          type="button"
          onClick={handleSave}
          className="w-full cursor-pointer rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none"
        >
          {t('menu_action_save')}
        </button>
      </div>
    </>
  );
}
