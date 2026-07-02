import type { ReactNode } from "react"

export interface SettingsRowProps {
  label: ReactNode
  description?: ReactNode
  value: ReactNode
  stackOnMobile?: boolean
}

export default function SettingsRow({
  label,
  description,
  value,
  stackOnMobile = false
}: SettingsRowProps) {
  return (
    <div
      className={`flex py-3 gap-2 sm:gap-4 w-full ${
        stackOnMobile 
          ? "flex-col sm:flex-row sm:items-center" 
          : "flex-row items-center"
      }`}
    >
      <div
        className={`flex flex-col flex-1 ${
          stackOnMobile ? "sm:pr-4" : "pr-2 sm:pr-4"
        }`}
      >
        <span className="text-sm text-gray-900">
          {label}
        </span>
        {description && (
          <span className="text-xs text-gray-600 mt-0.5 leading-tight">
            {description}
          </span>
        )}
      </div>
      <div
        className={`text-sm font-medium text-gray-900 flex items-center shrink-0 ${
          stackOnMobile 
            ? "sm:justify-end w-full sm:w-auto" 
            : "justify-end w-auto"
        }`}
      >
        {value}
      </div>
    </div>
  )
}