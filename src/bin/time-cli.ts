#!/usr/bin/env node


import { Command } from 'commander';
import { 
  getTodaySlots, 
  calculateStats, 
  markSlot, 
  unmarkSlot, 
  resetToday 
} from '../slotService'; // <-- CRITICAL FIX: Changed from './slotService'
import { renderSlotsTable, renderStats } from '../tableRenderer'; // <-- CRITICAL FIX: Changed from './tableRenderer'
import { closeDB } from '../db'; // <-- CRITICAL FIX: Changed from './db'

const program = new Command();
program.version('1.0.0').description('A daily productivity tracker CLI tool.');

/**
 * time-cli status or time-cli
 * Displays the current status of all slots for today.
 */
program
  .command('status', { isDefault: true })
  .description('Display today\'s time slots and statistics (default command).')
  .alias('ls')
  .action(() => {
    try {
      const slots = getTodaySlots();
      const stats = calculateStats(slots);
      renderSlotsTable(slots, stats);
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      closeDB();
    }
  });

/**
 * time-cli stats
 * Displays only the summary statistics.
 */
program
  .command('stats')
  .description('Display summary statistics for today.')
  .action(() => {
    try {
      const slots = getTodaySlots();
      const stats = calculateStats(slots);
      renderStats(stats);
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      closeDB();
    }
  });

/**
 * time-cli mark <slotNumber>
 * Marks a specific slot as completed.
 */
program
  .command('mark <slotNumber>')
  .description('Mark a slot as completed (e.g., time-cli mark 5).')
  .alias('m')
  .action((slotNumberStr: string) => {
    try {
      const slotNumber = parseInt(slotNumberStr, 10);
      const result = markSlot(slotNumber);
      console.log(result);
      if (result.startsWith('✅')) {
        // Show updated status after a successful mark
        const slots = getTodaySlots();
        const stats = calculateStats(slots);
        renderStats(stats);
      }
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      closeDB();
    }
  });

/**
 * time-cli unmark <slotNumber>
 * Unmarks a specific slot (sets it to pending).
 */
program
  .command('unmark <slotNumber>')
  .description('Unmark a slot (set to pending).')
  .alias('u')
  .action((slotNumberStr: string) => {
    try {
      const slotNumber = parseInt(slotNumberStr, 10);
      const result = unmarkSlot(slotNumber);
      console.log(result);
      if (result.startsWith('❌')) {
        // Show updated status after a successful unmark
        const slots = getTodaySlots();
        const stats = calculateStats(slots);
        renderStats(stats);
      }
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      closeDB();
    }
  });

/**
 * time-cli reset
 * Resets all slots for the current day to uncompleted.
 */
program
  .command('reset')
  .description('Reset all slots for the current day to uncompleted.')
  .action(() => {
    try {
      const result = resetToday();
      console.log(result);
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      closeDB();
    }
  });

program.parse(process.argv);