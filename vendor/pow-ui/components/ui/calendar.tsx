"use client";

import { useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
}

const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const today = new Date();

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className={cn("w-64 select-none", className)}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonth(subMonths(month, 1))} className="h-7 w-7 grid place-items-center rounded-[var(--radius)] text-muted-foreground hover:bg-secondary" aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize">{format(month, "MMMM yyyy", { locale: es })}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} className="h-7 w-7 grid place-items-center rounded-[var(--radius)] text-muted-foreground hover:bg-secondary" aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="h-7 grid place-items-center type-micro text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isSelected = selected && isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect?.(day)}
              className={cn(
                "h-8 grid place-items-center rounded-[var(--radius)] text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !isSelected && "hover:bg-secondary",
                isSelected && "bg-primary text-primary-foreground font-semibold",
                isToday && !isSelected && "ring-1 ring-brand text-foreground font-semibold"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
