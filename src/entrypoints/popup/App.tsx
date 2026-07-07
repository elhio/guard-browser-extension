import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LuListPlus, LuSettings } from 'react-icons/lu';

import GuardLogo from '@/assets/guard.svg?react';
import { settings } from '@/lib/settings/store';
import { formatNumber, t } from '@/lib/i18n';
import type { TasksState } from '@/components/setup/TaskSelectionStep';

function App() {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<TasksState>({ aiGenerated: true, violent: true, explicit: true });
  const [detectionAction, setDetectionAction] = useState('blur');
  const [useDetectorLocalModel, setUseDetectorLocalModel] = useState(false);
  const [exceptionSites, setExceptionSites] = useState<string[]>([]);

  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isHandlingOpen, setIsHandlingOpen] = useState(false);
  const [isDetectionOpen, setIsDetectionOpen] = useState(false);
  const [currentHost, setCurrentHost] = useState<string | null>(null);
  const [version] = useState(() => browser.runtime.getManifest().version);

  useEffect(() => {
    let isMounted = true;

    settings.getValue().then((res) => {
      if (!isMounted) return;
      setIsActive(res.isActive);
      setTasks(res.tasks);
      setDetectionAction(res.detectionAction || 'mark');
      setUseDetectorLocalModel(res.useDetectorLocalModel || false);
      setExceptionSites(res.exceptionSites || []);
    });

    const unwatch = settings.watch((newSettings) => {
      if (!newSettings || !isMounted) return;
      setIsActive(newSettings.isActive);
      setTasks(newSettings.tasks);
      setDetectionAction(newSettings.detectionAction || 'mark');
      setUseDetectorLocalModel(newSettings.useDetectorLocalModel || false);
      setExceptionSites(newSettings.exceptionSites || []);
    });

    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        try {
          const urlObj = new URL(tab.url);
          // Only whitelist actual web pages (ignore chrome://, about:, etc.)
          if (['http:', 'https:'].includes(urlObj.protocol)) {
            setCurrentHost(urlObj.hostname);
          }
        } catch {
          setCurrentHost(null);
        }
      }
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  const handleToggleStatus = async () => {
    if (isActive === null) return;
    const next = !isActive;
    setIsActive(next);
    const current = await settings.getValue();
    await settings.setValue({ ...current, isActive: next });
  };

  const handleToggleTask = async (taskId: keyof TasksState) => {
    const nextTasks = { ...tasks, [taskId]: !tasks[taskId] };
    setTasks(nextTasks);
    const current = await settings.getValue();
    await settings.setValue({ ...current, tasks: nextTasks });
  };

  const handleSetAction = async (action: string) => {
    setDetectionAction(action);
    setIsHandlingOpen(false);
    const current = await settings.getValue();
    await settings.setValue({ ...current, detectionAction: action });
  };

  const handleToggleLocalModel = async (useLocal: boolean) => {
    setUseDetectorLocalModel(useLocal);
    const current = await settings.getValue();
    await settings.setValue({ ...current, useDetectorLocalModel: useLocal });
  };

  const handleAddHost = async () => {
    if (!currentHost || exceptionSites.includes(currentHost)) return;
    const nextSites = [...exceptionSites, currentHost];
    setExceptionSites(nextSites);
    const current = await settings.getValue();
    await settings.setValue({ ...current, exceptionSites: nextSites });
  };

  const taskOptions: { id: keyof TasksState; label: string }[] = [
    { id: 'aiGenerated', label: t('popover_task_ai') },
    { id: 'violent', label: t('popover_task_violent') },
    { id: 'explicit', label: t('popover_task_nsfw') }
  ];

  const handlingOptions = [
    { id: 'mark', label: t('settings_action_mark_label') || 'Mark' },
    { id: 'blur', label: t('popover_handling_blur') },
    { id: 'hide', label: t('popover_handling_hide') }
  ];

  const detectionOptions = [
    { id: 'metadata', label: t('popover_detection_metadata'), desc: '' },
    { id: 'lens', label: 'Lens Mobile', desc: t('popover_detection_lens_desc') }
  ];

  // Helper for Tasks Summary text
  const getTaskSummary = () => {
    const activeTasks = taskOptions.filter(tObj => tasks[tObj.id]);
    if (activeTasks.length === 0) return t('popover_tasks_none');
    return activeTasks.length > 1
      ? `${activeTasks[0].label} +${activeTasks.length - 1} ${t('popover_more')}`
      : activeTasks[0].label;
  };

  const currentHostWhitelisted = currentHost !== null && exceptionSites.includes(currentHost);
  const currentHandlingLabel = handlingOptions.find(h => h.id === detectionAction)?.label || detectionAction;
  const activeTaskCount = Object.values(tasks).filter(Boolean).length;

  return (
    <div className="w-90 p-6 bg-white text-gray-800 font-sans shadow-lg">

      {/* Header Section */}
      <div className="flex flex-col items-center mb-6">
        <GuardLogo className="w-16 h-16 text-teal-500 mb-3" title={t('popover_logo_title')} />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-none mb-1">Guard</h1>
        <span className="text-xs text-gray-400 mt-1 font-mono">v{version}</span>
      </div>

      {/* 1. Status Toggle */}
      <div className="mb-2">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_status_label')}</label>
        </div>
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={isActive === null}
          className={`w-full flex justify-between items-center p-2 bg-gray-50 border rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive ? 'border-teal-500' : 'border-gray-200'
          }`}
        >
          <span className="font-medium text-sm text-gray-700">
            {isActive === null ? t('popover_status_loading') : isActive ? t('popover_status_active') : t('popover_status_disabled')}
          </span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? 'bg-teal-500' : 'bg-gray-400'}`} />
          </div>
        </button>
      </div>

      {/* 2. Tasks Dropdown */}
      <div className="mb-2">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_tasks_label')}</label>
        </div>
        <details className="relative" onToggle={(e) => setIsTasksOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="list-none cursor-pointer flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors">
            <span>{getTaskSummary()}</span>
            <span className="text-gray-400 text-xs">{isTasksOpen ? '▲' : '▼'}</span>
          </summary>
          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
            {taskOptions.map(task => (
              <label key={task.id} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={tasks[task.id]}
                  disabled={activeTaskCount === 1 && tasks[task.id]} // Prevent unchecking the last option
                  onChange={() => handleToggleTask(task.id)}
                  className="accent-teal-500"
                />
                <span className="text-sm text-gray-700">{task.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* 3. Handling (Action) Dropdown */}
      <div className="mb-2">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_handling_label')}</label>
        </div>
        <details className="relative" open={isHandlingOpen}>
          <summary
            className="list-none cursor-pointer flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setIsHandlingOpen(!isHandlingOpen);
            }}
          >
            <span>{currentHandlingLabel}</span>
            <span className="text-gray-400 text-xs">{isHandlingOpen ? '▲' : '▼'}</span>
          </summary>
          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
            {handlingOptions.map(option => (
              <label key={option.id} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-gray-50 rounded">
                <input
                  type="radio"
                  name="action-selection"
                  checked={detectionAction === option.id}
                  onChange={() => handleSetAction(option.id)}
                  className="accent-teal-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* Default detection */}
      <div className="mb-6">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_detection_label')}</label>
        </div>
        <details className="relative" open={isDetectionOpen}>
          <summary
            className="list-none cursor-pointer flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setIsDetectionOpen(!isDetectionOpen);
            }}
          >
            <span>
              {useDetectorLocalModel
                ? `${detectionOptions[0].label} +1 ${t('popover_more')}`
                : detectionOptions[0].label}
            </span>
            <span className="text-gray-400 text-xs">{isDetectionOpen ? '▲' : '▼'}</span>
          </summary>

          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
            <label className="flex items-center gap-2 p-1 cursor-not-allowed rounded opacity-80">
              <input type="checkbox" checked={true} disabled className="accent-teal-500" />
              <span className="text-sm text-gray-700">
                {detectionOptions[0].label}
                <span className="text-gray-400 text-[11px] font-normal block">{detectionOptions[0].desc}</span>
              </span>
            </label>
            <label className="flex items-center gap-2 p-1 cursor-pointer hover:bg-gray-50 rounded mt-1">
              <input
                type="checkbox"
                checked={useDetectorLocalModel}
                onChange={(e) => handleToggleLocalModel(e.target.checked)}
                className="accent-teal-500"
              />
              <span className="text-sm text-gray-700">
                {detectionOptions[1].label}
                <span className="text-gray-400 text-[11px] font-normal block">{detectionOptions[1].desc}</span>
              </span>
            </label>
          </div>
        </details>
      </div>

      {/* Footer menu */}
      <div className="bg-gray-50 -mx-6 -mb-6 p-4 border-t border-gray-200">
        <div className="flex flex-col gap-1">
          <button
            onClick={handleAddHost}
            disabled={!currentHost || currentHostWhitelisted}
            className="group flex items-center gap-3 w-full px-2 py-1 text-sm text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuListPlus size={16} className="text-gray-700 group-hover:text-gray-500 transition-colors" />
            <span className="font-medium text-gray-700 group-hover:text-gray-500 transition-colors">
              {t('popover_add_exception')}
            </span>
          </button>
          <button
            onClick={() => {
              browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
            }}
            className="group flex items-center gap-3 w-full px-2 py-1 text-sm text-gray-700 transition-colors"
          >
            <LuSettings size={16} className="text-gray-700 group-hover:text-gray-500 transition-colors" />
            <span className="font-medium text-gray-700 group-hover:text-gray-500 transition-colors">
              {t('popover_settings')}
            </span>
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-4 mb-1 tracking-wide">
          {t('popover_stats_part1')}{formatNumber(0)}{t('popover_stats_part2')}{formatNumber(0)}{t('popover_stats_part3')}
        </p>
      </div>

    </div>
  );
}

export default App;