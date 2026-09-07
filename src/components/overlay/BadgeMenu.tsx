import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { t } from '@/lib/i18n';
import type { DetectionCategory } from '@/lib/detection';
import { closeMenu, type OverlayEntry } from '@/lib/overlay/store';
import { resolveTaskView } from '@/lib/overlay/taskView';
import { submitReaction } from '@/lib/messaging/reactionMessages';
import { useMenuSnapshot } from './useMenuSnapshot';
import { TaskTabs } from './TaskTabs';
import { TAB_LABEL_KEYS } from './taskLabels';
import { TaskPanel } from './TaskPanel';
import { MenuFooter } from './MenuFooter';
import { FeedbackForm } from './FeedbackForm';
import { ShareForm } from './ShareForm';

const CATEGORY_ORDER: DetectionCategory[] = ['aiGenerated', 'violent', 'explicit'];
const MENU_WIDTH = 320;
/** Keep the menu open while the pointer is within this many px of it. */
const PROXIMITY_PX = 48;
const CLOSE_GRACE_MS = 300;

type MenuMode = 'result' | 'feedback' | 'share';

interface FeedbackContext {
  isPositive: boolean;
  taskId: string;
  taskLabel: string;
  reactions: Record<number, string>;
  activityId: string;
}

interface ShareContext {
  taskId: string;
  activityId: string;
}

/**
 * On open, default to the highest-scoring task that crossed its threshold (the one that
 * turned the badge red); if none did, fall back to the first tab.
 */
function pickDefaultTab(tabs: DetectionCategory[], entry: OverlayEntry | null): DetectionCategory {
  let best: { category: DetectionCategory; score: number } | null = null;
  for (const category of tabs) {
    const view = resolveTaskView(category, entry);
    if (view.isAlert && (!best || view.score > best.score)) {
      best = { category, score: view.score };
    }
  }
  return best?.category ?? tabs[0] ?? 'aiGenerated';
}

/** The single shared badge menu — renders for whichever image's ring was last clicked. */
export function BadgeMenu() {
  const { openTarget, entry, settings } = useMenuSnapshot();
  const menuRef = useRef<HTMLDivElement>(null);
  const reactedRef = useRef(false);
  const [active, setActive] = useState<DetectionCategory>('aiGenerated');
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mode, setMode] = useState<MenuMode>('result');
  const [feedbackCtx, setFeedbackCtx] = useState<FeedbackContext | null>(null);
  const [shareCtx, setShareCtx] = useState<ShareContext | null>(null);

  const tabs = CATEGORY_ORDER.filter((category) => settings.tasks[category]);
  const src = openTarget?.src ?? null;
  const verifying = entry?.verify.state === 'pending';

  // On open (new image), jump to the tripped tab and reset any in-progress mode.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setActive(pickDefaultTab(tabs, entry));
    setMode('result');
    setFeedbackCtx(null);
    setShareCtx(null);
  }

  const activeTab = tabs.includes(active) ? active : (tabs[0] ?? 'aiGenerated');
  const verifyData = entry?.verify.state === 'done' ? entry.verify.data : undefined;
  const activeItem = verifyData?.results.find((item) => item.category === activeTab);
  const canFeedback = Boolean(verifyData && activeItem);
  const locked = verifying || mode !== 'result';

  const startFeedback = (isPositive: boolean) => {
    if (!verifyData || !activeItem) return;
    reactedRef.current = false;
    setFeedbackCtx({
      isPositive,
      taskId: activeItem.taskId,
      taskLabel: t(TAB_LABEL_KEYS[activeTab]),
      reactions: activeItem.reactions ?? {},
      activityId: verifyData.activityId,
    });
    setMode('feedback');
  };

  const startShare = () => {
    if (!verifyData || !activeItem) return;
    setShareCtx({ taskId: activeItem.taskId, activityId: verifyData.activityId });
    setMode('share');
  };

  const handleSaveFeedback = (keyValue: number | null, description: string | null) => {
    if (feedbackCtx && !reactedRef.current) {
      reactedRef.current = true;
      submitReaction({
        activityId: feedbackCtx.activityId,
        taskId: feedbackCtx.taskId,
        isPositive: feedbackCtx.isPositive,
        keyValue,
        description,
      });
    }
    closeMenu();
  };

  // Guarantee a reaction is submitted once feedback was started, even if the user closes
  // the form without saving (fires on leaving feedback mode / menu close).
  useEffect(() => {
    if (mode !== 'feedback' || !feedbackCtx) return;
    const ctx = feedbackCtx;
    return () => {
      if (!reactedRef.current) {
        reactedRef.current = true;
        submitReaction({ activityId: ctx.activityId, taskId: ctx.taskId, isPositive: ctx.isPositive });
      }
    };
  }, [mode, feedbackCtx]);

  // Anchor to the top-right of the image's *visible* box
  useLayoutEffect(() => {
    const anchor = openTarget?.anchor;
    if (!anchor) return;

    const height = menuRef.current?.offsetHeight ?? 240;
    const left = Math.max(8, Math.min(anchor.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    let top = anchor.top + 32;
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
    setPos({ top, left });
  }, [openTarget?.anchor]);

  // Proximity auto-close (suspended while verifying or in a form) + Escape.
  useEffect(() => {
    if (!openTarget) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const onMove = (event: MouseEvent) => {
      if (locked) {
        clearTimer();
        return;
      }
      const menu = menuRef.current;
      if (!menu) return;

      // Measure the card and (when open) its dropdown, which is absolutely positioned below
      // the card and thus outside its bounding box. querySelector works across the shadow
      // boundary; `event.target` does not (it retargets to the shadow host).
      const rects = [menu.getBoundingClientRect()];
      const dropdown = menu.querySelector('[data-menu-dropdown]');
      if (dropdown) rects.push(dropdown.getBoundingClientRect());

      const near = rects.some((rect) => {
        const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
        const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
        return Math.hypot(dx, dy) <= PROXIMITY_PX;
      });

      if (near) {
        clearTimer();
      } else if (!timer) {
        timer = setTimeout(closeMenu, CLOSE_GRACE_MS);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimer();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('keydown', onKey);
    };
  }, [openTarget, locked]);

  if (!openTarget || !entry || tabs.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
      className="fixed z-[2147483647] rounded-lg border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
    >
      {mode === 'feedback' && feedbackCtx ? (
        <FeedbackForm
          isPositive={feedbackCtx.isPositive}
          taskLabel={feedbackCtx.taskLabel}
          reactions={feedbackCtx.reactions}
          onSave={handleSaveFeedback}
          onClose={closeMenu}
        />
      ) : mode === 'share' && shareCtx ? (
        <ShareForm activityId={shareCtx.activityId} taskId={shareCtx.taskId} onClose={closeMenu} />
      ) : (
        <>
          <TaskTabs tabs={tabs} active={activeTab} onSelect={setActive} onClose={closeMenu} />
          <TaskPanel category={activeTab} entry={entry} />
          {entry.verify.state === 'error' && (
            <div className="border-t border-gray-200 px-4 py-2 text-xs text-red-600 dark:border-gray-700 dark:text-red-400">
              ⚠ {entry.verify.error || t('badge_error_verify')}
            </div>
          )}
          <div className="border-t border-gray-200 p-3 dark:border-gray-700">
            <MenuFooter
              entry={entry}
              settings={settings}
              canFeedback={canFeedback}
              onFeedback={startFeedback}
              onShare={startShare}
            />
          </div>
        </>
      )}
    </div>
  );
}
