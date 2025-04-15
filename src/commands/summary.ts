import { Command } from 'commander';
import { getDb } from '../lib/db';
import {
    formatDuration,
    DAILY_GOAL_SECONDS,
    isValidMonthFormat,
    isValidYearFormat
} from '../lib/utils';
import Table from 'cli-table3';
import chalk from 'chalk';

interface DailySummary {
    log_date: string;
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
        .description('📊 Shows the total study time for each day and goal status, optionally filtered by month or year.')
        .option('-m, --month <YYYY-MM>', 'Filter summary by specific month (e.g., 2025-04)')
        .option('-y, --year <YYYY>', 'Filter summary by specific year (e.g., 2025)')
        .action((options) => {
            try {
                const db = getDb();
                const filterMonth = options.month as string | undefined;
                const filterYear = options.year as string | undefined;

                // --- Validation ---
                if (filterMonth && filterYear) {
                    console.error(chalk.red('Error: Cannot use --month and --year options together.'));
                    console.error(chalk.yellow('Please specify only one filter period.'));
                    process.exit(1);
                }

                let filterType: 'month' | 'year' | null = null;
                let filterValue: string | null = null;
                // filterDescription is no longer needed for output header
                // let filterDescription = "all time";

                if (filterMonth) {
                    if (!isValidMonthFormat(filterMonth)) {
                        console.error(chalk.red(`Error: Invalid month format "${filterMonth}". Please use YYYY-MM.`));
                        process.exit(1);
                    }
                    filterType = 'month';
                    filterValue = filterMonth;
                    // filterDescription = `month ${filterValue}`;
                } else if (filterYear) {
                    if (!isValidYearFormat(filterYear)) {
                         console.error(chalk.red(`Error: Invalid year format "${filterYear}". Please use YYYY.`));
                         process.exit(1);
                    }
                    filterType = 'year';
                    filterValue = filterYear;
                    // filterDescription = `year ${filterValue}`;
                }

                // --- Build SQL Query ---
                let sql = `
                    SELECT
                        DATE(start_time) as log_date,
                        SUM(duration) as total_duration
                    FROM logs
                    WHERE duration IS NOT NULL
                `;
                const params: string[] = [];

                if (filterType === 'month' && filterValue) {
                    sql += ` AND strftime('%Y-%m', start_time) = ?`;
                    params.push(filterValue);
                } else if (filterType === 'year' && filterValue) {
                    sql += ` AND strftime('%Y', start_time) = ?`;
                    params.push(filterValue);
                }

                sql += ` GROUP BY log_date ORDER BY log_date ASC`;

                // --- Execute Query ---
                const summaryStmt = db.prepare<string[], DailySummary>(sql);
                const summaries = summaryStmt.all(...params);

                // --- Render Table ---
                if (summaries.length === 0) {
                    console.log();
                    // Simplified message - no longer mentions specific filter period
                    console.log('No completed sessions found matching the criteria.');
                    console.log();
                    return;
                }

                const table = new Table({
                    head: ['SL', 'Date', 'Total Time', 'Status'],
                    colWidths: [5, 15, 15, 8],
                    colAligns: ['center', 'center', 'center', 'center'],
                    chars: tableChars,
                    style: { head: ['cyan'], border: ['white'] }
                });

                summaries.forEach((summary, index) => {
                    const goalReached = summary.total_duration >= DAILY_GOAL_SECONDS;
                    const statusEmoji = goalReached ? '✅' : '❌';

                    table.push([
                        (index + 1).toString(),
                        summary.log_date,
                        formatDuration(summary.total_duration),
                        statusEmoji
                    ]);
                });

                console.log();
                // Remove the contextual header line
                // console.log(chalk.blue(`Summary for: ${filterDescription}`));
                console.log(table.toString());
                console.log();

            } catch (error) {
                console.error(chalk.red('Failed to generate summary:'), error);
                process.exit(1);
            }
        });
}