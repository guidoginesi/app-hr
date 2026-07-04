import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Util interno del DS — sin dependencias de la app, así el paquete es portable.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: string | Date,
  locale = "es-AR",
  opts?: Intl.DateTimeFormatOptions
): string {
  let d: Date;
  if (typeof date === "string") {
    d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00") : new Date(date);
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  }).format(d);
}
