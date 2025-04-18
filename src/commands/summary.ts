// src/commands/summary.ts

import { Command } from 'commander';
import { getDb, LogEntry } from '../lib/db'; // Import LogEntry
import {
    formatDuration,
    DAILY_GOAL_SECONDS,
    isValidMonthFormat,
    isValidYearFormat,
    formatDate // Import formatDate for consistency
} from '../lib/utils';
import Table from 'cli-table3';
import chalk from 'chalk';
import dayjs from 'dayjs'; // Import dayjs

// Interface for the raw data fetched from DB
interface RawLogData {
    start_time: string;
    duration: number; // Only fetch completed logs with duration
}

// Interface for the aggregated data (based on LOCAL date)
interface AggregatedDailySummary {
    local_date: string; // YYYY-MM-DD based on local time
    total_duration: number;
}

const tableChars = {
    'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
    'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
    'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
    'right': '║', 'right-mid': '╢', 'middle': '│'
};

export function registerSummaryCommand(program: Command) {
    program
        .command('summary')
        .description('📊 Shows the total study time for each LOCAL day and goal status, optionally filtered by month or year.') // Updated description
        .option('-m, --month <YYYY-MM>', 'Filter summary by specific month (e.g., 2025-04)')
        .option('-y, --year <YYYY>', 'Filter summary by specific year (e.g., 2025)')
        .action((options) => {
            try {
                const db = getDb();
                const filterMonth = options.month as string | undefined;
                const filterYear = options.year as string | undefined;

                // --- Validation (remains the same) ---
                if (filterMonth && filterYear) {
                    console.error(chalk.red('Error: Cannot use --month and --year options together.'));
                    console.error(chalk.yellow('Please specify only one filter period.'));
                    process.exit(1);
                }

                let filterType: 'month' | 'year' | null = null;
                let filterValue: string | null = null;
                let filterDescription = "all time"; // For potential future use or logging

                if (filterMonth) {
                    if (!isValidMonthFormat(filterMonth)) {
                        console.error(chalk.red(`Error: Invalid month format "${filterMonth}". Please use YYYY-MM.`));
                        process.exit(1);
                    }
                    filterType = 'month';
                    filterValue = filterMonth;
                    filterDescription = `month ${filterValue}`;
                } else if (filterYear) {
                    if (!isValidYearFormat(filterYear)) {
                         console.error(chalk.red(`Error: Invalid year format "${filterYear}". Please use YYYY.`));
                         process.exit(1);
                    }
                    filterType = 'year';
                    filterValue = filterYear;
                    filterDescription = `year ${filterValue}`;
                }

                // --- Build SQL Query to fetch RAW data ---
                // Select only necessary columns for aggregation
                // Keep the broad WHERE clauses for filtering
                let sql = `
                    SELECT
                        start_time,
                        duration
                    FROM logs
                    WHERE duration IS NOT NULL -- Only completed sessions
                `;
                const params: string[] = [];

                if (filterType === 'month' && filterValue) {
                    // This filter is approximate (based on UTC month) but helps reduce data fetched
                    sql += ` AND strftime('%Y-%m', start_time) = ?`;
                    params.push(filterValue);
                } else if (filterType === 'year' && filterValue) {
                    // This filter is approximate (based on UTC year)
                    sql += ` AND strftime('%Y', start_time) = ?`;
                    params.push(filterValue);
                }

                // Order by start_time helps slightly if we process sequentially, but not strictly required for aggregation
                sql += ` ORDER BY start_time ASC`;

                // --- Execute Query to get raw logs ---
                const fetchLogsStmt = db.prepare<string[], RawLogData>(sql);
                const rawLogs = fetchLogsStmt.all(...params);

                // --- Aggregate in TypeScript based on LOCAL Date ---
                const dailyTotals: Record<string, number> = {}; // Map<LocalDateString, TotalSeconds>

                rawLogs.forEach(log => {
                    // Determine the LOCAL date for the start_time
                    const localDate = dayjs(log.start_time).format('YYYY-MM-DD');

                    // Add duration to the correct local date bucket
                    dailyTotals[localDate] = (dailyTotals[localDate] || 0) + log.duration;
                });

                // Convert aggregated data into an array suitable for sorting and display
                const aggregatedSummaries: AggregatedDailySummary[] = Object.entries(dailyTotals)
                    .map(([date, duration]) => ({
                        local_date: date,
                        total_duration: duration,
                    }))
                    .sort((a, b) => a.local_date.localeCompare(b.local_date)); // Sort by date string ASC

                // --- Render Table ---
                if (aggregatedSummaries.length === 0) {
                    console.log();
                    console.log('No completed sessions found matching the criteria.');
                    console.log();
                    return;
                }

                const table = new Table({
                    head: ['SL', 'Date (Local)', 'Total Time', 'Status'], // Updated header
                    colWidths: [5, 15, 15, 8],
                    colAligns: ['center', 'center', 'center', 'center'],
                    chars: tableChars,
                    style: { head: ['cyan'], border: ['white'] }
                });

                aggregatedSummaries.forEach((summary, index) => {
                    const goalReached = summary.total_duration >= DAILY_GOAL_SECONDS;
                    const statusEmoji = goalReached ? '✅' : '❌';

                    table.push([
                        (index + 1).toString(),
                        summary.local_date, // Display the calculated local date
                        formatDuration(summary.total_duration),
                        statusEmoji
                    ]);
                });

                console.log();
                // Optional: Add a title indicating the filter applied, if any
                // if (filterValue) {
                //     console.log(chalk.blue(`Summary filtered for: ${filterDescription}`));
                // }
                console.log(table.toString());
                console.log();

            } catch (error) {
                console.error(chalk.red('Failed to generate summary:'), error);
                process.exit(1);
            }
        });
}