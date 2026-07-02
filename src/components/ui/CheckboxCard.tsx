interface CheckboxCardProps {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
  onChange: (id: string) => void;
}

export function CheckboxCard({
  id,
  title,
  description,
  checked,
  onChange,
}: CheckboxCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-4 rounded-md border p-3 transition-colors ${
        checked
          ? 'border-teal-500 bg-teal-50/30'
          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(id)}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-teal-600 accent-teal-500 focus:ring-teal-500"
      />
      <div className="flex flex-col">
        <strong className="mb-0.5 block text-sm text-gray-800">{title}</strong>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>
    </label>
  );
}