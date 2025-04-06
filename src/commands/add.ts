import { Command } from 'commander';
import chalk from 'chalk';
import { addManualSession } from '../lib/db';
import { formatTimestamp, formatDuration } from '../lib/utils'; // Assuming formatDuration exists

// --- Time Parsing Logic ---

/**
 * Parses a time string like "HH:MM AM/PM" or "HH:MM" (24-hour)
 * and combines it with the current date to create a Date object.
 * Returns null if parsing fails.
 */
function parseTimeAndCombineWithToday(timeStr: string): Date | null {
    const trimmedTime = timeStr.trim();
    const now = new Date(); // Get current date

    // Regex to match HH:MM (optional space) AM/PM or HH:MM (24h)
    // Supports 1-2 digits for hour, requires 2 for minutes
    const match = trimmedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

    if (!match) {
        return null; // Invalid format
    }

    let [, hourStr, minuteStr, ampm] = match;
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute) || minute < 0 || minute > 59) {
        return null; // Invalid numbers
    }

    // Adjust hour for AM/PM
    if (ampm) {
        ampm = ampm.toUpperCase();
        if (hour < 1 || hour > 12) return null; // Invalid 12-hour format hour

        if (ampm === 'PM' && hour !== 12) {
            hour += 12;
        } else if (ampm === 'AM' && hour === 12) {
            hour = 0; // Midnight case
        }
    } else {
        // 24-hour format validation
        if (hour < 0 || hour > 23) return null;
    }

    // Create Date object with today's date and the parsed time
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    return targetDate;
}


export function registerAddCommand(program: Command) {
    program
        .command('add')
        .description('Manually add a completed session for today (e.g., "8:00 AM - 10:30 PM")')
        .argument('<range>', 'Time range string (Format: "HH:MM AM/PM - HH:MM AM/PM" or "HH:MM - HH:MM")')
        .action((rangeStr: string) => {
            const parts = rangeStr.split('-').map(s => s.trim());
            if (parts.length !== 2) {
                console.error(chalk.red('Error: Invalid range format. Use "StartTime - EndTime".'));
                process.exitCode = 1;
                return;
            }

            const startTimeStr = parts[0];
            const endTimeStr = parts[1];

            const startDate = parseTimeAndCombineWithToday(startTimeStr);
            const endDate = parseTimeAndCombineWithToday(endTimeStr);

            if (!startDate || !endDate) {
                console.error(chalk.red('Error: Invalid time format in range. Use HH:MM AM/PM or HH:MM (24h).'));
                console.error(chalk.yellow(`  Examples: "8:00 AM - 10:30 AM", "14:00 - 15:30"`));
                process.exitCode = 1;
                return;
            }

            // Convert valid Dates to Unix timestamps (seconds)
            const startTimestamp = Math.floor(startDate.getTime() / 1000);
            const endTimestamp = Math.floor(endDate.getTime() / 1000);

            // Basic check: End time must be after start time
            if (startTimestamp >= endTimestamp) {
                 console.error(chalk.red('Error: Start time must be strictly before the end time.'));
                 process.exitCode = 1;
                 return;
            }

            // Attempt to add the session (overlap check is inside addManualSession)
            const newSessionId = addManualSession(startTimestamp, endTimestamp);

            if (newSessionId) {
                console.log(chalk.green('✅ Session added successfully!'));
                console.log(`   ${chalk.cyan('Start:')} ${formatTimestamp(startTimestamp)}`);
                console.log(`   ${chalk.cyan('End:')}   ${formatTimestamp(endTimestamp)}`);
                console.log(`   ${chalk.magenta('Duration:')} ${chalk.bold(formatDuration(endTimestamp - startTimestamp))}`);
                console.log(chalk.dim(`   Session ID: ${newSessionId}`));
            } else {
                // Specific error message should have been printed by addManualSession
                console.error(chalk.red('Failed to add session. See details above.'));
                process.exitCode = 1;
            }
        });
}