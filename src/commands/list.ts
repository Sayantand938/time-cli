import { Command } from 'commander';
import Table from 'cli-table3';
import dayjs from 'dayjs'; // Ensure dayjs is imported
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
                const params: string[] = [];
                let listTitle = "All Time"; // Default title for --all

                if (showAll) {
                    // If --all is used, ignore any --date option
                    if (inputDate) {
                        console.warn(chalk.yellow("Warning: --date option ignored because --all was specified."));
                    }
                    // No additional WHERE clause needed for date filtering
                } else {
                    // --- Determine Target Date (Only if --all is NOT specified) ---
                    let targetDate: string;

                    if (!inputDate || inputDate.toLowerCase() === 'today') {
                        targetDate = dayjs().format('YYYY-MM-DD');
                        listTitle = `Today (${targetDate})`;
                    } else if (inputDate.toLowerCase() === 'yesterday') {
                        targetDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
                        listTitle = `Yesterday (${targetDate})`;
                    } else if (inputDate.toLowerCase() === 'tomorrow') {
                        // Although listing future logs might be rare, handle it consistently
                        targetDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
                        listTitle = `Tomorrow (${targetDate})`;
                    } else if (isValidDate(inputDate)) {
                        targetDate = inputDate;
                        listTitle = targetDate; // Use the specific date as the title
                    } else {
                        // Invalid date format/keyword
                        console.error(chalk.red(`Error: Invalid date format or keyword "${inputDate}".`));
                        console.error(chalk.yellow("Use YYYY-MM-DD, 'today', 'yesterday', 'tomorrow', or omit for today."));
                        process.exit(1);
                    }

                    // Append date filter to SQL query
                    sql += ` AND DATE(start_time) = ?`;
                    params.push(targetDate);
                }

                // --- Add Ordering (applies to both all and filtered) ---
                sql += ` ORDER BY start_time ASC`;

                // --- Execute Query ---
                const selectLogsStmt = db.prepare<string[], LogQueryResult>(sql);
                const logs = selectLogsStmt.all(...params); // Pass parameters (empty if --all)

                // --- Render Table ---
                if (logs.length === 0) {
                    console.log();
                    if (showAll) {
                        console.log('No completed sessions found in the database.');
                    } else {
                        console.log(`No completed sessions found for ${listTitle}.`);
                    }
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
                        formatDate(log.start_time),
                        formatTime(log.start_time),
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