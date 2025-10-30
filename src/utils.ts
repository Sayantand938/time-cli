// D:/Coding/time-cli/src/utils.ts

import * as os from 'os';
import * as path from 'path';
import dayjs from 'dayjs';
import { TimeSlot } from './types';

// --- Configuration ---
const START_HOUR = 8; // 08:00 AM
const TOTAL_SLOTS = 16;
const SLOT_DURATION_MINUTES = 60; // 1 hour

/**
 * Determines the OS-specific directory for application data, respecting XDG Base Directory specification.
 * @returns The full path to the time-cli data directory.
 */
export function getDataDirectory(): string {
  const appName = 'time-cli';
  const homeDir = os.homedir();
  let dataDir: string;

  switch (os.platform()) {
    case 'win32':
      // Windows: C:\Users\<user>\AppData\Local\time-cli (using %LOCALAPPDATA%)
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        dataDir = path.join(localAppData, appName);
      } else {
        // Fallback for extreme cases (should not happen on modern Windows)
        dataDir = path.join(homeDir, 'AppData', 'Local', appName);
      }
      break;
      
    case 'darwin':
      // macOS: ~/Library/Application Support/time-cli (standard)
      dataDir = path.join(homeDir, 'Library', 'Application Support', appName);
      break;

    case 'linux':
    default:
      // Linux/Other (XDG Base Directory): $XDG_DATA_HOME/time-cli or ~/.local/share/time-cli
      const xdgDataHome = process.env.XDG_DATA_HOME;
      if (xdgDataHome) {
        dataDir = path.join(xdgDataHome, appName);
      } else {
        // Default XDG path
        dataDir = path.join(homeDir, '.local', 'share', appName);
      }
      break;
  }

  return dataDir;
}

/**
 * Determines the full path to the SQLite database file.
 * @returns The full path to data.db.
 */
export function getDatabasePath(): string {
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'data.db');
}

/**
 * Gets the current date formatted as YYYY-MM-DD.
 * @returns The current date string.
 */
export function getTodayDateString(): string {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * Calculates the start and end time strings for a given slot number.
 * @param slotNumber - The 1-based slot index (1 to 16).
 * @returns An object with startTime and endTime strings (e.g., { startTime: "08:00 AM", endTime: "09:00 AM" }).
 */
function calculateSlotTimes(slotNumber: number): { startTime: string, endTime: string } {
  const startMoment = dayjs().hour(START_HOUR).minute(0).second(0).millisecond(0);

  // Calculate the start time of the slot
  const slotStartTime = startMoment.add((slotNumber - 1) * SLOT_DURATION_MINUTES, 'minute');

  // Calculate the end time of the slot (exclusive, as the start of the next period)
  const slotEndTime = slotStartTime.add(SLOT_DURATION_MINUTES, 'minute'); 

  // Format the times (using double-digit padded 12-hour format)
  const formatStr = 'hh:mm A';
  const startTime = slotStartTime.format(formatStr);
  const endTime = slotEndTime.format(formatStr);

  return { startTime, endTime };
}

/**
 * Generates an array of 16 empty (uncompleted) TimeSlot objects.
 * This is used for a new day's initial state.
 * @returns An array of 16 TimeSlot objects.
 */
export function generateEmptySlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const { startTime, endTime } = calculateSlotTimes(i); // Use the new function
    slots.push({
      slot: i,
      startTime: startTime,
      endTime: endTime,
      completed: 0,
    });
  }
  return slots;
}