interface ProgressRingProps {
  /** 0-100 score. */
  score: number;
  /** When true the ring + value render red (score crossed the category threshold). */
  alert: boolean;
  size?: number;
  /** When true the ring shows an indeterminate spinning arc (e.g. while verifying). */
  spinning?: boolean;
}

/** A circular progress ring whose arc fills with the score; red past the threshold, or spins while pending. */
export function ProgressRing({ score, alert, size = 56, spinning = false }: ProgressRingProps) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (spinning) {
    const arc = circumference * 0.25;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 animate-spin">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="text-teal-500"
        />
      </svg>
    );
  }

  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - pct / 100);
  const arcColor = alert ? 'text-red-500' : 'text-teal-500';
  const textColor = alert ? 'text-red-500' : 'text-gray-700 dark:text-gray-200';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-gray-200 dark:stroke-gray-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={`${arcColor} transition-[stroke-dashoffset] duration-300`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={`fill-current text-xs font-semibold ${textColor}`}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
