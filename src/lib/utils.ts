import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generates a short random string suitable as a request correlation ID. */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
