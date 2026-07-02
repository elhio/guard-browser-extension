import { useEffect, useState, type SyntheticEvent } from 'react';
import { LuListPlus, LuSettings } from 'react-icons/lu';

import GuardLogo from '@/assets/guard.svg?react';
import {
  addToWhitelist,
  getWhitelist,
  isAiCheckEnabled,
  isBlurEnabled,
  isGuardEnabled,
  isHoverUnblurEnabled,
  normalizeHost,
  setGuardEnabled,
} from '@/lib/settings';
import { formatNumber, t } from '@/lib/i18n';

type ModelType = 'local' | 'remote';

function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [blurEnabled, setBlurEnabledState] = useState<boolean | null>(null);
  const [hoverUnblurEnabled, setHoverUnblurEnabledState] = useState<boolean | null>(null);
  const [aiCheckEnabled, setAiCheckEnabledState] = useState<boolean | null>(null);

  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(['AI-Generiert']);
  const [isHandlingOpen, setIsHandlingOpen] = useState(false);
  const [handling, setHandling] = useState('Blur');
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(['Metadata']);

  const [modelType, setModelTypeState] = useState<ModelType | null>(null);

  const [whitelist, setWhitelistState] = useState<string[] | null>(null);
  const [newHost, setNewHost] = useState('');
  const [currentHost, setCurrentHost] = useState<string | null>(null);

  const [version] = useState(() => browser.runtime.getManifest().version);

  useEffect(() => {
    void isGuardEnabled().then(setEnabled);
    void isBlurEnabled().then(setBlurEnabledState);
    void isHoverUnblurEnabled().then(setHoverUnblurEnabledState);
    void isAiCheckEnabled().then(setAiCheckEnabledState);

    void getWhitelist().then(setWhitelistState);
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setCurrentHost(tab?.url ? normalizeHost(tab.url) : null))
      .catch(() => setCurrentHost(null));
  }, []);

  // Define options with their translated labels
  const taskOptions = [
    { id: 'AI-Generiert', label: t('popover_task_ai') },
    { id: 'NSFW', label: t('popover_task_nsfw') },
    { id: 'Gewalt', label: t('popover_task_violent') }
  ];

  const handlingOptions = [
    { id: 'Blur', label: t('popover_handling_blur') },
    { id: 'Hide', label: t('popover_handling_hide') }
  ];

  const verificationOptions = [
    { id: 'Metadata', label: t('popover_verification_metadata'), desc: '' },
    { id: 'Lens Mobile', label: 'Lens Mobile', desc: t('popover_verification_lens_desc') }
  ];

  const getTaskSummary = () => {
    if (selectedTasks.length === 0) return t('popover_tasks_none');
    const firstId = selectedTasks[0];
    const firstLabel = taskOptions.find(tObj => tObj.id === firstId)?.label || firstId;
    return selectedTasks.length > 1
      ? `${firstLabel} +${selectedTasks.length - 1} ${t('popover_more')}`
      : firstLabel;
  };

  async function toggleEnabled(): Promise<void> {
    const next = !enabled;
    setEnabled(next);
    await setGuardEnabled(next);
  }

  async function handleAddHost(host: string): Promise<void> {
    const normalized = normalizeHost(host);
    if (!normalized) return;
    await addToWhitelist(normalized);
    setWhitelistState(await getWhitelist());
  }

  const currentHostWhitelisted = currentHost !== null && (whitelist?.includes(currentHost) ?? false);

  const totalImages = 0;
  const aiImages = 0;

  const currentHandlingLabel = handlingOptions.find(h => h.id === handling)?.label || handling;

  return (
    <div className="w-[360px] p-6 bg-white text-gray-800 font-sans shadow-lg">

      {/* Header Section (Centered) */}
      <div className="flex flex-col items-center mb-6">
        <GuardLogo className="w-16 h-16 text-teal-500 mb-3" title={t('popover_logo_title')} />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-none mb-1">Guard</h1>
        <span className="text-xs text-gray-400 mt-1 font-mono">v{version}</span>
      </div>

      <div className="mb-2">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_status_label')}</label>
        </div>

        <button
          type="button"
          onClick={toggleEnabled}
          disabled={enabled === null}
          className={`w-full flex justify-between items-center p-2 bg-gray-50 border rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? 'border-teal-500' : 'border-gray-200'
          }`}
        >
          <span className="font-medium text-sm text-gray-700">
            {enabled === null ? t('popover_status_loading') : enabled ? t('popover_status_active') : t('popover_status_disabled')}
          </span>

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full transition-colors ${enabled ? 'bg-teal-500' : 'bg-gray-400'}`} />
          </div>
        </button>
      </div>

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
                  checked={selectedTasks.includes(task.id)}
                  disabled={selectedTasks.length === 1 && selectedTasks.includes(task.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTasks([...selectedTasks, task.id]);
                    else setSelectedTasks(selectedTasks.filter(t => t !== task.id));
                  }}
                  className="accent-teal-500"
                />
                <span className="text-sm text-gray-700">{task.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="mb-2">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_handling_label')}</label>
        </div>

        <details
          className="relative"
          open={isHandlingOpen}
        >
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
                  name="darstellung"
                  checked={handling === option.id}
                  onChange={() => {
                    setHandling(option.id);
                    setIsHandlingOpen(false);
                  }}
                  className="accent-teal-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="mb-6">
        <div className="mb-1">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">{t('popover_verification_label')}</label>
        </div>

        <details
          className="relative"
          open={isVerificationOpen}
        >
          <summary
            className="list-none cursor-pointer flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setIsVerificationOpen(!isVerificationOpen);
            }}
          >
            <span>
              {selectedVerification.length === 0
                ? t('popover_verification_none')
                : `${verificationOptions.find(v => v.id === selectedVerification[0])?.label || selectedVerification[0]}${selectedVerification.length > 1 ? ` +${selectedVerification.length - 1} ${t('popover_more')}` : ''}`}
            </span>
            <span className="text-gray-400 text-xs">{isVerificationOpen ? '▲' : '▼'}</span>
          </summary>

          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
            {verificationOptions.map(item => (
              <label key={item.id} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={selectedVerification.includes(item.id)}
                  disabled={selectedVerification.length === 1 && selectedVerification.includes(item.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedVerification([...selectedVerification, item.id]);
                    else setSelectedVerification(selectedVerification.filter(t => t !== item.id));
                  }}
                  className="accent-teal-500"
                />
                <span className="text-sm text-gray-700">
                  {item.label}
                  <span className="text-gray-400 text-[11px] font-normal">{item.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="bg-gray-50 -mx-6 -mb-6 p-4 border-t border-gray-200">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => currentHost && handleAddHost(currentHost)}
            disabled={currentHostWhitelisted}
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
          {t('popover_stats_part1')}{formatNumber(totalImages)}{t('popover_stats_part2')}{formatNumber(aiImages)}{t('popover_stats_part3')}
        </p>
      </div>

    </div>
  );
}

export default App;