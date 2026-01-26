'use client';

type ProgressBarProps = {
  current: number;
  total: number;
  label?: string;
};

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label || `Paso ${current} de ${total}`}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200">
        <div
          className="h-2 rounded-full bg-purple-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
