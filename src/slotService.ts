// src/slotService.ts

import { initDB } from './db';
import { getTodayDateString, generateEmptySlots } from './utils';
import { TimeSlot, SlotStats } from './types';
import { Database } from 'better-sqlite3';

const TOTAL_SLOTS = 16;
const db: Database = initDB();

/**
 * Ensures today's date exists in the 'days' table and initializes 16 slots
 * in the 'slots' table if they don't exist yet for the current date.
 * @param dateStr - The current date in YYYY-MM-DD format.
 */
function ensureTodaySlotsInitialized(dateStr: string): void {
  // Check if the date exists in the 'days' table
  const dayExists = db.prepare('SELECT 1 FROM days WHERE date = ?').get(dateStr);

  if (!dayExists) {
    // Start a transaction for atomic insertion
    const transaction = db.transaction(() => {
      // 1. Insert the new day
      db.prepare('INSERT INTO days (date) VALUES (?)').run(dateStr);

      // 2. Insert the 16 empty slots for the new day
      const emptySlots = generateEmptySlots();
      const insertSlot = db.prepare(
        'INSERT INTO slots (date, slot, completed) VALUES (?, ?, ?)'
      );

      for (const slot of emptySlots) {
        insertSlot.run(dateStr, slot.slot, slot.completed);
      }
    });

    transaction();
  }
}

/**
 * Reads all 16 slots for the current day from the database.
 * If the day is new, it initializes the slots first.
 * @returns A promise that resolves to an array of 16 TimeSlot objects.
 */
export function getTodaySlots(): TimeSlot[] {
  const dateStr = getTodayDateString();
  ensureTodaySlotsInitialized(dateStr);

  // Fetch the completed status from the database
  const dbSlots = db.prepare('SELECT slot, completed FROM slots WHERE date = ? ORDER BY slot').all(dateStr) as { slot: number, completed: 0 | 1 }[];

  // Combine with the time range information from utils to create the final TimeSlot array
  const emptySlots = generateEmptySlots();
  
  const todaySlots: TimeSlot[] = emptySlots.map(emptySlot => {
    const dbSlot = dbSlots.find(s => s.slot === emptySlot.slot);
    return {
      ...emptySlot,
      completed: dbSlot ? dbSlot.completed : 0, // Should always find it, but handles edge case
    };
  });

  return todaySlots;
}

/**
 * Calculates the statistics (completed, remaining, progress) for the given slots.
 * @param slots - The array of TimeSlot objects.
 * @returns The SlotStats object.
 */
export function calculateStats(slots: TimeSlot[]): SlotStats {
  const completed = slots.filter(s => s.completed === 1).length;
  const total = TOTAL_SLOTS;
  const remaining = total - completed;
  const progressPercent = parseFloat(((completed / total) * 100).toFixed(1));

  return { completed, total, remaining, progressPercent };
}

/**
 * Updates the 'completed' status of a specific slot.
 * @param slotNumber - The 1-based index of the slot to mark/unmark.
 * @param isCompleted - 1 for completed (mark), 0 for not completed (unmark).
 * @returns A status message indicating success or failure.
 */
function updateSlotStatus(slotNumber: number, isCompleted: 1 | 0): string {
  if (slotNumber < 1 || slotNumber > TOTAL_SLOTS) {
    return `❌ Error: Slot number must be between 1 and ${TOTAL_SLOTS}.`;
  }

  const dateStr = getTodayDateString();
  ensureTodaySlotsInitialized(dateStr); // Ensure data integrity before updating

  // 1. Check current status
  const currentSlot = db.prepare(
    'SELECT completed FROM slots WHERE date = ? AND slot = ?'
  ).get(dateStr, slotNumber) as { completed: 0 | 1 } | undefined;

  if (!currentSlot) {
    return `❌ Error: Slot ${slotNumber} not found for today. (This should not happen)`;
  }

  if (isCompleted === 1) {
    // MARK
    if (currentSlot.completed === 1) {
      return `⚠️ Slot ${slotNumber} is already marked as completed.`;
    }
    db.prepare('UPDATE slots SET completed = 1 WHERE date = ? AND slot = ?').run(dateStr, slotNumber);
    return `✅ Slot ${slotNumber} marked as completed`;
  } else {
    // UNMARK
    if (currentSlot.completed === 0) {
      return `⚠️ Slot ${slotNumber} is already unmarked.`;
    }
    db.prepare('UPDATE slots SET completed = 0 WHERE date = ? AND slot = ?').run(dateStr, slotNumber);
    return `❌ Slot ${slotNumber} unmarked`;
  }
}

/**
 * Marks a slot as completed.
 * @param slotNumber - The slot index (1-16).
 */
export function markSlot(slotNumber: number): string {
  return updateSlotStatus(slotNumber, 1);
}

/**
 * Unmarks a slot (sets it to pending).
 * @param slotNumber - The slot index (1-16).
 */
export function unmarkSlot(slotNumber: number): string {
  return updateSlotStatus(slotNumber, 0);
}

/**
 * Clears all slots for the current day.
 * @returns A success message.
 */
export function resetToday(): string {
  const dateStr = getTodayDateString();
  ensureTodaySlotsInitialized(dateStr); // Ensure the day exists to avoid errors

  db.prepare('UPDATE slots SET completed = 0 WHERE date = ?').run(dateStr);

  return `🔥 All slots for ${dateStr} have been reset.`;
}