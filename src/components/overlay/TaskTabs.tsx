import { useEffect, useRef, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';

import { t, type MessageKey } from '@/lib/i18n';
import type { DetectionCategory } from '@/lib/detection';

const TAB_LABEL_KEYS: Record<DetectionCategory, MessageKey> = {
  aiGenerated: 'badge_category_ai',
  violent: 'badge_category_violent',
  explicit: 'badge_category_explicit',
};

interface TaskTabsProps {
  tabs: DetectionCategory[];
  active: DetectionCategory;
  onSelect: (category: DetectionCategory) => void;
  onClose: () => void;
}

/** The menu header: scrollable task tabs (with overflow arrows) + a close button. */
export function TaskTabs({ tabs, active, onSelect, onClose }: TaskTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setOverflow({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [tabs]);

  const scrollByDir = (direction: number) =>
    scrollRef.current?.scrollBy({ left: direction * 100, behavior: 'smooth' });

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
      {overflow.left && (
        <button
          type="button"
          aria-label={t('menu_scroll_left')}
          onClick={() => scrollByDir(-1)}
          className="shrink-0 px-1.5 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <LuChevronLeft size={16} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex flex-1 gap-1 overflow-x-auto px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onSelect(tab)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs text-gray-600 transition-colors dark:text-gray-300 ${
                isActive ? 'border-current font-bold' : 'border-transparent font-medium'
              }`}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
          );
        })}
      </div>

      {overflow.right && (
        <button
          type="button"
          aria-label={t('menu_scroll_right')}
          onClick={() => scrollByDir(1)}
          className="shrink-0 px-1.5 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <LuChevronRight size={16} />
        </button>
      )}

      <button
        type="button"
        aria-label={t('menu_close')}
        onClick={onClose}
        className="shrink-0 px-2 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <LuX size={16} />
      </button>
    </div>
  );
}
