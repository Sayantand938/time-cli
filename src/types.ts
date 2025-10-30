// src/types.ts

/**
 * Represents a single daily slot (1-16) for tracking.
 */
export interface TimeSlot {
  slot: number; // 1 to 16
  startTime: string; // e.g., "08:00 AM"
  endTime: string; // e.g., "09:00 AM"
  completed: 0 | 1; // 0 for ❌, 1 for ✅
}

/**
 * The structure for the summary statistics.
 */
export interface SlotStats {
  completed: number;
  total: number; // always 16
  remaining: number;
  progressPercent: number;
}