import type { ReactNode } from "react"

export interface SettingsSectionProps {
  title: string
  action?: ReactNode
  children: ReactNode
  isDanger?: boolean
}

export default function SettingsSection({
  title,
  action,
  children,
  isDanger,
}: SettingsSectionProps) {
  return (
    <div
      className={`flex flex-col rounded-lg border shadow-sm bg-white mb-2 ${
        isDanger ? "border-red-200" : "border-gray-200"
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-5 py-2.5">
        <h2
          className={`text-base font-semibold tracking-tight ${
            isDanger ? "text-red-600" : "text-gray-900"
          }`}
        >
          {title}
        </h2>
        <div>{action}</div>
      </div>

      {/* Section Body */}
      <div
        className={`px-5 py-2 border-t ${
          isDanger ? "border-red-200" : "border-gray-200"
        }`}
      >
        {children}
      </div>
    </div>
  )
}