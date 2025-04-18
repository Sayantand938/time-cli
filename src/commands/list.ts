// src/commands/list.ts

import { Command } from 'commander';
import Table from 'cli-table3';
import dayjs from 'dayjs'; // Ensure dayjs is imported
// Make sure utc plugin is available if needed, but toISOString handles UTC conversion
// import utc from 'dayjs/plugin/utc';
// dayjs.extend(utc);
import chalk from 'chalk';
import { getDb, LogEntry } from '../lib/db';
import {
    formatTime,
    formatDuration,
    shortenUUID,
    isValidDate,
    formatDate
} from '../lib/utils';

// Interface for query result remains the same
interface LogQueryResult extends Omit<LogEntry, 'duration' | 'end_time'> {
    duration: number | null;
    end_time: string | null;
}

// Table characters remain the same
const tableChars = {
    'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
    'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
    'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
    'right': '║', 'right-mid': '╢', 'middle': '│'
};

export function registerListCommand(program: Command) {
    program
        .command('list')
        .description('📜 Lists completed study sessions.')
        .option('-d, --date <YYYY-MM-DD|today|yesterday|tomorrow>', 'Date to list sessions for (defaults to today, ignored if --all is used)')
        .option('-a, --all', 'List all recorded sessions, ignoring date filters') // Add the --all option
        .action((options) => {
            try {
                const db = getDb();
                const showAll = options.all as boolean ?? false;
                const inputDate = options.date as string | undefined;

                let sql = `
                    SELECT id, start_time, end_time, duration
                    FROM logs
                    WHERE end_time IS NOT NULL -- Always list completed sessions
                `;
                const params: string[] = []; // Only string parameters for ISO timestamps
                let listTitle = "All Time"; // Default title for --all

                if (showAll) {
                    // If --all is used, ignore any --date option
                    if (inputDate) {
                        console.warn(chalk.yellow("Warning: --date option ignored because --all was specified."));
                    }
                    // No additional WHERE clause needed for date filtering
                } else {
                    // --- Determine Target LOCAL Day Object (Only if --all is NOT specified) ---
                    let targetDayLocal: dayjs.Dayjs;
                    let displayKeyword = ''; // To store 'Today', 'Yesterday', etc.

                    if (!inputDate || inputDate.toLowerCase() === 'today') {
                        targetDayLocal = dayjs().startOf('day');
                        displayKeyword = 'Today';
                    } else if (inputDate.toLowerCase() === 'yesterday') {
                        targetDayLocal = dayjs().subtract(1, 'day').startOf('day');
                        displayKeyword = 'Yesterday';
                    } else if (inputDate.toLowerCase() === 'tomorrow') {
                        targetDayLocal = dayjs().add(1, 'day').startOf('day');
                        displayKeyword = 'Tomorrow';
                    } else if (isValidDate(inputDate)) {
                        // Use startOf('day') to ensure we capture the full 24 hours regardless of input time part (if any was accidentally included)
                        targetDayLocal = dayjs(inputDate).startOf('day');
                        // No specific keyword for custom dates
                    } else {
                        // Invalid date format/keyword
                        console.error(chalk.red(`Error: Invalid date format or keyword "${inputDate}".`));
                        console.error(chalk.yellow("Use YYYY-MM-DD, 'today', 'yesterday', 'tomorrow', or omit for today."));
                        process.exit(1);
                    }

                    // --- Calculate UTC Boundaries for the Local Day ---
                    const startUTC = targetDayLocal.toISOString(); // Start of the local day in UTC
                    const endUTC = targetDayLocal.add(1, 'day').toISOString(); // Start of the *next* local day in UTC

                    // Append date range filter to SQL query
                    // We want entries where start_time is ON or AFTER startUTC
                    // AND strictly BEFORE endUTC
                    sql += ` AND start_time >= ? AND start_time < ?`;
                    params.push(startUTC, endUTC);

                    // Set the title based on the local date
                    const formattedDate = targetDayLocal.format('YYYY-MM-DD');
                    listTitle = displayKeyword ? `${displayKeyword} (${formattedDate})` : formattedDate;
                }

                // --- Add Ordering (applies to both all and filtered) ---
                sql += ` ORDER BY start_time ASC`;

                // --- Execute Query ---
                const selectLogsStmt = db.prepare<string[], LogQueryResult>(sql);
                const logs = selectLogsStmt.all(...params); // Pass parameters

                // --- Render Table ---
                if (logs.length === 0) {
                    console.log();
                    console.log(`No completed sessions found for ${listTitle}.`);
                    console.log();
                    return;
                }

                // Setup table options
                const table = new Table({
                    head: ['ID', 'Date', 'Start Time', 'End Time', 'Duration'],
                    colWidths: [8, 12, 12, 12, 10],
                    colAligns: ['center', 'center', 'center', 'center', 'center'],
                    chars: tableChars,
                    style: {
                        head: ['cyan'],
                        border: ['white']
                    }
                });

                // Populate table
                logs.forEach(log => {
                    // Safely format, though end_time should not be null due to WHERE clause
                    const endTimeFormatted = log.end_time ? formatTime(log.end_time) : 'N/A';
                    const durationFormatted = log.duration !== null ? formatDuration(log.duration) : 'N/A';

                    table.push([
                        chalk.gray(shortenUUID(log.id)),
                        formatDate(log.start_time), // Display uses local date correctly
                        formatTime(log.start_time), // Display uses local time correctly
                        endTimeFormatted,
                        durationFormatted
                    ]);
                });

                // Print the title and table
                console.log(chalk.blue(`\n📅 Listing Sessions for: ${listTitle}\n`)); // Informative title
                console.log(table.toString());
                console.log();

            } catch (error) {
                console.error(chalk.red('Failed to list sessions:'), error);
                process.exit(1);
            }
        });
}