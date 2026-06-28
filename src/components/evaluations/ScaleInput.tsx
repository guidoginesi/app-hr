'use client';

import { useState } from 'react';
import { SCALE_DEFINITIONS, getScaleLabel } from '@/types/evaluation';

type ScaleInputProps = {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function ScaleInput({ value, onChange, disabled }: ScaleInputProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);

  const displayValue = hoveredValue || value;
  const scaleLabel = displayValue ? getScaleLabel(displayValue) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const def = SCALE_DEFINITIONS.find(d => num >= d.min && num <= d.max);
          const isSelected = value === num;
          const isHovered = hoveredValue === num;
          
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              onMouseEnter={() => setHoveredValue(num)}
              onMouseLeave={() => setHoveredValue(null)}
              disabled={disabled}
              className={`
                relative w-9 h-9 rounded-full text-sm font-medium transition-all
                ${isSelected
                  ? 'bg-cat-violet text-white shadow-md ring-2 ring-cat-violet ring-offset-2'
                  : isHovered
                  ? 'bg-cat-violet-subtle text-cat-violet'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={def?.label}
            >
              {num}
            </button>
          );
        })}
      </div>
      
      {/* Label to the right */}
      <div className="min-w-[120px]">
        {scaleLabel && (
          <span className={`text-xs font-medium ${
            displayValue && displayValue <= 2 ? 'text-[var(--red-600)]' :
            displayValue && displayValue <= 4 ? 'text-accent-foreground' :
            displayValue && displayValue <= 6 ? 'text-[var(--amber-600)]' :
            displayValue && displayValue <= 8 ? 'text-[var(--green-700)]' :
            'text-[var(--green-700)]'
          }`}>
            {scaleLabel}
          </span>
        )}
      </div>
    </div>
  );
}
