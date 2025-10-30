// src/tableRenderer.ts

import Table from 'cli-table3';
import { TimeSlot, SlotStats } from './types';
import { getTodayDateString } from './utils'; // Import the utility function

/**
 * Displays the current slots and summary statistics using cli-table3.
 * @param slots - The array of 16 TimeSlot objects.
 * @param stats - The SlotStats object.
 */
export function renderSlotsTable(slots: TimeSlot[], stats: SlotStats): void {
  const table = new Table({
    head: ['#', 'Start Time', 'End Time', 'Status'],
    colAligns: ['right', 'center', 'center', 'center'],
    style: { head: ['cyan'], border: ['white'] },
    chars: { // Double border characters
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    }
  });

  // Get and display the current date before the table
  const dateStr = getTodayDateString();
  console.log(`\n📅 Tracking Slots for: ${dateStr}\n`);

  // Populate table rows
  slots.forEach(slot => {
    const statusIcon = slot.completed === 1 ? '✅' : '❌';
    table.push([
      slot.slot.toString(),
      slot.startTime,
      slot.endTime,
      statusIcon
    ]);
  });

  console.log(table.toString());

  // Output summary stats
  console.log(`\nCompleted: ${stats.completed} / ${stats.total}`);
  console.log(`Remaining: ${stats.remaining}`);
  console.log(`Progress: ${stats.progressPercent}%`);
}

/**
 * Renders the short stats view for the 'stats' command.
 * @param stats - The SlotStats object.
 */
export function renderStats(stats: SlotStats): void {
  console.log(`\n✅ Completed: ${stats.completed} / ${stats.total}`);
  console.log(`⏳ Remaining: ${stats.remaining}`);
  console.log(`🔥 ${stats.progressPercent}% done`);
}