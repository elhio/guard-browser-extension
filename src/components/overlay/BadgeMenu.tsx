import { useEffect, useRef, useState } from 'react';

import { t } from '@/lib/i18n';
import type { DetectionCategory } from '@/lib/detection';
import { closeMenu, type OverlayEntry } from '@/lib/overlay/store';
import { resolveTaskView } from '@/lib/overlay/taskView';
import { useMenuSnapshot } from './useMenuSnapshot';
import { TaskTabs } from './TaskTabs';
import { TaskPanel } from './TaskPanel';
import { MenuFooter } from './MenuFooter';

const CATEGORY_ORDER: DetectionCategory[] = ['aiGenerated', 'violent', 'explicit'];
const MENU_WIDTH = 320;
/** Keep the menu open while the pointer is within this many px of it. */
const PROXIMITY_PX = 48;
const CLOSE_GRACE_MS = 300;

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
  const [active, setActive] = useState<DetectionCategory>('aiGenerated');
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const tabs = CATEGORY_ORDER.filter((category) => settings.tasks[category]);
  const src = openTarget?.src ?? null;
  const element = entry?.element ?? null;
  const verifying = entry?.verify.state === 'pending';

  // On open, jump to the task that tripped the badge (render-time state adjust).
  if (src !== prevSrc) {
    setPrevSrc(src);
    setActive(pickDefaultTab(tabs, entry));
  }

  const activeTab = tabs.includes(active) ? active : (tabs[0] ?? 'aiGenerated');

  // Anchor to the image's top-right; reposition on scroll/resize; close if the image is gone.
  useEffect(() => {
    if (!openTarget || !element) return;

    const reposition = () => {
      if (!element.isConnected) {
        closeMenu();
        return;
      }
      const rect = element.getBoundingClientRect();
      const height = menuRef.current?.offsetHeight ?? 240;
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
      let top = rect.top + 32;
      if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
      setPos({ top, left });
    };

    reposition();
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', reposition);
    };
  }, [openTarget, element]);

  // Proximity auto-close (suspended while verifying) + Escape.
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
      if (verifying) {
        clearTimer();
        return;
      }
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      if (Math.hypot(dx, dy) > PROXIMITY_PX) {
        if (!timer) timer = setTimeout(closeMenu, CLOSE_GRACE_MS);
      } else {
        clearTimer();
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
  }, [openTarget, verifying]);

  if (!openTarget || !entry || tabs.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
      className="fixed z-[2147483647] rounded-lg border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
    >
      <TaskTabs tabs={tabs} active={activeTab} onSelect={setActive} onClose={closeMenu} />
      <TaskPanel category={activeTab} entry={entry} />
      {entry.verify.state === 'error' && (
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-red-600 dark:border-gray-700 dark:text-red-400">
          ⚠ {entry.verify.error || t('badge_error_verify')}
        </div>
      )}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <MenuFooter entry={entry} settings={settings} />
      </div>
    </div>
  );
}
