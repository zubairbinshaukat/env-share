import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Relative time for dashboard cards (now / Xm / Xh / Xd / Xw / locale date). */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const sec = Math.floor((now - timestamp) / 1000)
  if (sec < 10) return "just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const week = Math.floor(day / 7)
  if (week < 5) return `${week}w ago`
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "—"
  }
}
