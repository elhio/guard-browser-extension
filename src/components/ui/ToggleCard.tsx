interface ToggleCardProps {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (id: string) => void;
}

export function ToggleCard({
  id,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleCardProps) {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(id);
      }}
      className={`flex items-center justify-between gap-4 rounded-md border p-3 transition-colors ${
        disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
      } ${
        checked
          ? 'border-teal-500 bg-teal-50/30 dark:bg-gray-50'
          : disabled
            ? 'border-gray-200 bg-gray-50' 
            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex flex-col">
        <strong className="mb-0.5 block text-sm text-gray-800">{title}</strong>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
          checked ? (disabled ? 'bg-teal-500/70' : 'bg-teal-600') : 'bg-gray-200'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}