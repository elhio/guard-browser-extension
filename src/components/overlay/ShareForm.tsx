import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { t } from '@/lib/i18n';
import { requestShare } from '@/lib/messaging/shareMessages';

const FIELD_CLASS =
  'w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-100';

interface ShareFormProps {
  activityId: string;
  taskId: string;
  onClose: () => void;
}

/** Share flow: pick a validity, create a link, then copy it. */
export function ShareForm({ activityId, taskId, onClose }: ShareFormProps) {
  const [expiresIn, setExpiresIn] = useState(7);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    const response = await requestShare({ activityId, taskId, expiresIn });
    if (response.success) {
      setShareUrl(response.shareUrl);
    } else {
      setError(response.error);
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the URL is shown for manual copy */
    }
  };

  const primaryLabel = shareUrl
    ? copied
      ? t('menu_action_copied')
      : t('menu_action_copy')
    : t('menu_action_create');

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
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('menu_share_title')}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          {shareUrl ? t('menu_share_ready_prompt') : t('menu_share_prompt')}
        </p>

        {shareUrl ? (
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.target.select()}
            className={`mt-3 ${FIELD_CLASS}`}
          />
        ) : (
          <label className="mt-4 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('menu_share_valid_label')}
            <select
              value={expiresIn}
              onChange={(event) => setExpiresIn(Number(event.target.value))}
              disabled={creating}
              className={`mt-1 cursor-pointer disabled:cursor-not-allowed ${FIELD_CLASS}`}
            >
              <option value={1}>{t('menu_share_valid_24h')}</option>
              <option value={3}>{t('menu_share_valid_3d')}</option>
              <option value={7}>{t('menu_share_valid_7d')}</option>
            </select>
          </label>
        )}

        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">⚠ {error}</p>}
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <button
          type="button"
          onClick={shareUrl ? handleCopy : handleCreate}
          disabled={creating && !shareUrl}
          className="w-full cursor-pointer rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors enabled:hover:bg-teal-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {primaryLabel}
        </button>
      </div>
    </>
  );
}
