'use client';

import { useState, useRef, useEffect } from 'react';

type MondayDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  advanceNoticeDays?: number;
  className?: string;
};

// Get all Mondays for a given month
function getMondaysInMonth(year: number, month: number): Date[] {
  const mondays: Date[] = [];
  const date = new Date(year, month, 1);
  
  // Find first Monday
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  
  // Get all Mondays in the month
  while (date.getMonth() === month) {
    mondays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  
  return mondays;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Parse date string as local date
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function MondayDatePicker({ value, onChange, minDate, advanceNoticeDays = 0, className }: MondayDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      return parseLocalDate(value);
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const mondays = getMondaysInMonth(year, month);

  // Get today for minimum date check
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate minimum date based on advance notice days
  const minByAdvanceNotice = new Date(today);
  if (advanceNoticeDays > 0) {
    minByAdvanceNotice.setDate(minByAdvanceNotice.getDate() + advanceNoticeDays);
  }
  
  // Use the later of minDate, today, or advance notice date
  let minDateObj = minDate ? parseLocalDate(minDate) : today;
  if (minByAdvanceNotice > minDateObj) {
    minDateObj = minByAdvanceNotice;
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function selectDate(date: Date) {
    onChange(formatDate(date));
    setIsOpen(false);
  }

  function isDisabled(date: Date): boolean {
    return date < minDateObj;
  }

  function isSelected(date: Date): boolean {
    if (!value) return false;
    return formatDate(date) === value;
  }

  const displayValue = value 
    ? parseLocalDate(value).toLocaleDateString('es-AR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
      })
    : '';

  return (
    <div ref={containerRef} className="relative">
      {/* Input display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white ${className}`}
      >
        {displayValue || <span className="text-zinc-400">Selecciona un lunes</span>}
      </button>

      {/* Dropdown calendar */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded p-1 hover:bg-zinc-100"
            >
              <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-medium text-zinc-900">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded p-1 hover:bg-zinc-100"
            >
              <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Monday list */}
          <div className="space-y-1">
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase">Lunes disponibles</p>
            {mondays.length === 0 ? (
              <p className="text-sm text-zinc-400 py-2">No hay lunes en este mes</p>
            ) : (
              mondays.map((monday) => {
                const disabled = isDisabled(monday);
                const selected = isSelected(monday);
                
                return (
                  <button
                    key={formatDate(monday)}
                    type="button"
                    onClick={() => !disabled && selectDate(monday)}
                    disabled={disabled}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : disabled
                        ? 'text-zinc-300 cursor-not-allowed'
                        : 'hover:bg-emerald-50 text-zinc-700'
                    }`}
                  >
                    <span className="font-medium">
                      Lunes {monday.getDate()}
                    </span>
                    <span className="ml-2 text-xs opacity-75">
                      {monday.toLocaleDateString('es-AR', { month: 'long' })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
