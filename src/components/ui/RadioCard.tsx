interface RadioCardProps {
  id: string;
  name: string;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (id: string) => void;
}

export function RadioCard({
  id,
  name,
  title,
  description,
  checked,
  disabled = false,
  disabledReason,
  onChange,
}: RadioCardProps) {
  return (
    <label
      className={`relative group flex items-center gap-4 rounded-md border p-3 transition-colors ${
        disabled 
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 grayscale' 
          : 'cursor-pointer ' + (checked ? 'border-teal-500 bg-teal-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')
      }`}
    >
      <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={() => {
            if (!disabled) onChange(id);
          }}
          className={`peer h-5 w-5 shrink-0 appearance-none rounded-full border-2 focus:outline-none ${
            disabled ? 'cursor-not-allowed border-gray-300' : 'cursor-pointer border-gray-300 checked:border-teal-600'
          }`}
        />
        <div className={`pointer-events-none absolute h-2.5 w-2.5 scale-0 rounded-full transition-transform duration-200 peer-checked:scale-100 ${
          disabled ? 'bg-gray-400' : 'bg-teal-600'
        }`} />
      </div>

      <div className="flex flex-col">
        <strong className="mb-0.5 block text-sm text-gray-800">{title}</strong>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>

      {disabled && disabledReason && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 w-max max-w-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded py-1.5 px-3 shadow-lg text-center">
          {disabledReason}
          <div className="absolute top-full left-1/2 -mt-px -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </label>
  );
}