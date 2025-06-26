// src/commands/log.ts
import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import { getDb, initDb } from '../utils/db.js';
import { logger } from '../utils/logger.js';
// UPDATED IMPORT: Added SLOT_TARGET_MINUTES
import { TIME_SLOTS_CONFIG, SHIFT_DEFINITIONS, SLOT_TARGET_MINUTES } from '../utils/constants.js';
import type { HorizontalTableRow } from 'cli-table3';

type DailyLogData = {
  session_date: string;
  id: number;
} & {
  [K in typeof TIME_SLOTS_CONFIG[number]['dbColumn']]: number;
};

// Define how many slots are typically in a shift for target calculation
// This assumes shifts are generally 4 hours / 4 slots. Adjust if this assumption is wrong.
const SLOTS_PER_SHIFT = 4; // Or derive dynamically if shift definitions can vary slot counts more complexly
const TARGET_SHIFT_TOTAL_MINUTES = SLOTS_PER_SHIFT * SLOT_TARGET_MINUTES;

const logCmd = new Command('log')
  .description('View logged study sessions for a specific date.')
  .option('-d, --date <YYYY-MM-DD>', 'Filter logs by a specific date (e.g., 2023-10-27). Defaults to today.')
  .action(async (options) => {
    try {
      initDb();
      const db = getDb();

      const date = options.date || new Date().toISOString().split('T')[0];

      if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD.');
      }

      const dayLog = db.prepare('SELECT * FROM daily_study_logs WHERE session_date = ?').get(date) as DailyLogData | undefined;

      if (!dayLog) {
        logger.info(`No study sessions found for date: ${date}. Use "time-cli study" to add some.`);
        return;
      }

      let hasAnyData = false;
      let currentShiftIndex = 0;

      // Helper function to capture arrow key presses
      const waitForKeyPress = (): Promise<'left' | 'right' | 'exit'> => {
        return new Promise((resolve) => {
          const onData = (buffer: Buffer) => {
            const key = buffer.toString('utf-8');

            // Arrow keys and exit keys escape sequences:
            if (key === '\u001b[D') { // left arrow
              cleanup();
              resolve('left');
            } else if (key === '\u001b[C') { // right arrow
              cleanup();
              resolve('right');
            } else if (key === '\u0003' || key === '\u001b') { // Ctrl+C or Esc to exit
              cleanup();
              resolve('exit');
            }
          };

          const cleanup = () => {
            process.stdin.off('data', onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
          };

          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.on('data', onData);
        });
      };

      while (true) {
        const shift = SHIFT_DEFINITIONS[currentShiftIndex];

        const table = new Table({
          head: [chalk.cyan('Time Slot'), chalk.cyan('Minutes')],
          colWidths: [30, 15],
          chars: {
            top: '═', 'top-mid': '╦', 'top-left': '╔', 'top-right': '╗',
            bottom: '═', 'bottom-mid': '╩', 'bottom-left': '╚', 'bottom-right': '╝',
            left: '║', 'left-mid': '╠', mid: '═', 'mid-mid': '╬',
            right: '║', 'right-mid': '╣', middle: '║',
          },
          style: { head: ['cyan'], border: ['white'] },
        });

        let shiftTotal = 0;
        let slotsInThisShift = 0; // Count slots actually in this shift definition

        for (const slotConfig of TIME_SLOTS_CONFIG) {
          if (slotConfig.startHour24 >= shift.startHour && slotConfig.startHour24 < shift.endHour) {
            slotsInThisShift++; // Increment count for this specific shift
            const minutes = dayLog[slotConfig.dbColumn] ?? 0;
            shiftTotal += minutes;
            if (minutes > 0) hasAnyData = true;

            // UPDATED LINE: Using SLOT_TARGET_MINUTES
            const displayMinutes = minutes === SLOT_TARGET_MINUTES ? '✅' : `${minutes}`;
            table.push([slotConfig.displayName, displayMinutes] as HorizontalTableRow);
          }
        }
        
        // Dynamically calculate target for THIS specific shift
        const targetMinutesForThisShift = slotsInThisShift * SLOT_TARGET_MINUTES;

        // UPDATED SECTION for Shift Total display
        // Using the dynamically calculated target for the current shift
        const displayShiftTotal = shiftTotal === targetMinutesForThisShift ? '✅' : `${shiftTotal}`;
        table.push([
          chalk.bold('Shift Total'),
          chalk.bold(displayShiftTotal),
        ] as HorizontalTableRow);

        console.clear();
        console.log(`\n${chalk.yellow.bold(shift.name)} — ${chalk.gray(date)}\n`);
        console.log(table.toString());
        console.log(chalk.gray('Use ← and → arrow keys to navigate shifts, Esc or Ctrl+C to exit.'));

        const action = await waitForKeyPress();

        if (action === 'left' && currentShiftIndex > 0) {
          currentShiftIndex--;
        } else if (action === 'right' && currentShiftIndex < SHIFT_DEFINITIONS.length - 1) {
          currentShiftIndex++;
        } else if (action === 'exit') {
          break;
        }
      }

      if (!hasAnyData) {
        logger.info(`All study slots are 0 minutes for date: ${date}.`);
      }

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred while fetching study logs.');
      }
    }
  });

export default logCmd;