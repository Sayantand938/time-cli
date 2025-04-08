// src/commands/summary.ts

import { Command, Option } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllSessions, Session } from '../lib/db';
// Import the new duration formatter and keep formatDate
import { formatDurationAsHHMM, formatDate, parseFilterString, ParsedFilter } from '../lib/utils';

interface DailySummary {
    dateStr: string;
    totalSeconds: number;
    sessionCount: number;
    firstTimestamp: number;
    avgSeconds: number;
    status: '✅' | '❌';
}

const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60;

export function registerSummaryCommand(program: Command) {
    program
        .command('summary')
        .description('Show a daily summary of recorded sessions with optional filtering')
        .addOption(new Option('-f, --filter <expression...>', 'Filter output (e.g., "date=YYYY-MM-DD", "total>=8h", "status=✅")'))
        .action((options: { filter?: string[] }) => {
            const sessions = getAllSessions();

            if (sessions.length === 0) {
                console.log(chalk.yellow('No sessions recorded yet to summarize.'));
                return;
            }

            const dailySummariesMap = new Map<string, Omit<DailySummary, 'avgSeconds' | 'status'>>();

            sessions.forEach((session: Session) => {
                // Only include completed sessions in summary calculations
                if (session.end_time === null) {
                    return; // Skip active sessions for summary
                }

                const dateStr = formatDate(session.start_time);
                let summary = dailySummariesMap.get(dateStr);
                if (!summary) {
                    summary = { dateStr: dateStr, totalSeconds: 0, sessionCount: 0, firstTimestamp: session.start_time };
                    dailySummariesMap.set(dateStr, summary);
                }

                const duration = session.end_time - session.start_time;
                // Ensure duration is valid before adding
                if (duration >= 0 && !isNaN(duration)) {
                    summary.totalSeconds += duration;
                    summary.sessionCount += 1;
                } else {
                     console.warn(chalk.yellow(`Skipping session ${session.id.substring(0,8)} due to invalid duration calculation.`));
                }
            });

            let summariesArray: DailySummary[] = Array.from(dailySummariesMap.values()).map(s => {
                const avgSeconds = s.sessionCount > 0 ? s.totalSeconds / s.sessionCount : 0;
                const status = s.totalSeconds >= EIGHT_HOURS_IN_SECONDS ? '✅' : '❌';
                // Make sure avgSeconds is not NaN before creating the object
                return { ...s, avgSeconds: isNaN(avgSeconds) ? 0 : avgSeconds, status };
            });

            summariesArray.sort((a, b) => b.firstTimestamp - a.firstTimestamp);

            // --- Apply Filters ---
            const parsedFilters: ParsedFilter[] = [];
            if (options.filter && options.filter.length > 0) {
                options.filter.forEach(fStr => {
                    const parsed = parseFilterString(fStr);
                    if (parsed) {
                        if (!['date', 'total', 'avg', 'status'].includes(parsed.key)) {
                            console.error(chalk.red(`Invalid filter key "${parsed.key}" for summary command. Allowed keys: date, total, avg, status`));
                            process.exitCode = 1;
                        } else {
                            if (parsed.key === 'status' && !['✅', '❌'].includes(parsed.value)) {
                                console.error(chalk.red(`Invalid value "${parsed.value}" for status filter. Use ✅ or ❌.`));
                                process.exitCode = 1;
                            } // Check for duration parsing success on total/avg filters
                            else if (['total', 'avg'].includes(parsed.key) && parsed.valueSeconds === null) {
                                // Error already printed by parseFilterString
                                process.exitCode = 1;
                            } else {
                                parsedFilters.push(parsed);
                            }
                        }
                    } else {
                        process.exitCode = 1;
                    }
                });
                if (process.exitCode === 1) return;
            }


            if (parsedFilters.length > 0) {
                console.log(chalk.dim(`Applying ${parsedFilters.length} filter(s)...`));
                summariesArray = summariesArray.filter(summary => {
                    return parsedFilters.every(filter => {
                        switch (filter.key) {
                            case 'date':
                                if (filter.operator === '=') {
                                    return summary.dateStr === filter.value;
                                } else {
                                    console.warn(chalk.yellow(`Operator "${filter.operator}" ignored for 'date' filter (only '=' is supported). Using '='.`));
                                    return summary.dateStr === filter.value;
                                }

                            case 'total':
                            case 'avg': {
                                // **Explicitly check if valueSeconds is a number BEFORE using it**
                                if (typeof filter.valueSeconds !== 'number') {
                                    // This case should ideally not be reached due to prior parsing checks
                                    console.warn(chalk.yellow(`Skipping ${filter.key} filter due to unexpected missing valueSeconds for filter: ${filter.key}${filter.operator}${filter.value}`));
                                    return false; // Skip this filter check if valueSeconds isn't a number
                                }

                                const valueSeconds = filter.key === 'total' ? summary.totalSeconds : summary.avgSeconds;
                                const filterSeconds = filter.valueSeconds; // Now TS knows it's a number

                                switch (filter.operator) {
                                    case '=': return Math.floor(valueSeconds) === filterSeconds; // Use floor for avg comparison
                                    case '>': return valueSeconds > filterSeconds;
                                    case '>=': return valueSeconds >= filterSeconds;
                                    // Add other operators here if parseFilterString supports them
                                    default: return false;
                                }
                            }

                            case 'status':
                                if (filter.operator === '=') {
                                    return summary.status === filter.value;
                                } else {
                                    console.warn(chalk.yellow(`Operator "${filter.operator}" ignored for 'status' filter (only '=' is supported). Using '='.`));
                                    return summary.status === filter.value;
                                }

                            default:
                                return true; // Ignore unknown filter keys (already validated)
                        }
                    });
                });
            }
            // --- End Apply Filters ---

            if (summariesArray.length === 0) {
                if (parsedFilters.length > 0) {
                    console.log(chalk.yellow('No daily summaries match the specified filters.'));
                } else {
                    // Check if the original sessions array was empty or only contained active sessions
                    const hasCompletedSessions = sessions.some(s => s.end_time !== null);
                     if (!hasCompletedSessions && sessions.length > 0) {
                        console.log(chalk.yellow('No completed sessions found to summarize. Only active sessions exist.'));
                     } else if (!hasCompletedSessions) { // Implies sessions.length === 0
                         console.log(chalk.yellow('No sessions recorded yet to summarize.'));
                     }
                }
                return;
            }


            const table = new Table({
                head: [ chalk.blue.bold('SL'), chalk.blue.bold('Date'), chalk.blue.bold('Avg (hh:mm)'), chalk.blue.bold('Total (hh:mm)'), chalk.blue.bold('Status') ],
                // Adjusted widths for hh:mm format (shorter than Xh Ym Zs)
                colWidths: [5, 15, 15, 15, 8],
                colAligns: ['center', 'center', 'center', 'center', 'center'],
                style: {
                    head: [], border: ['white'], 'padding-left': 1, 'padding-right': 1
                },
                chars: {
                    'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
                    'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
                    'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
                    'right': '║', 'right-mid': '╢', 'middle': '│'
                }
            });

            summariesArray.forEach((summary, index) => {
                 // Use formatDurationAsHHMM for total and average duration
                const totalStr = formatDurationAsHHMM(summary.totalSeconds);
                const avgStr = formatDurationAsHHMM(summary.avgSeconds);

                table.push([
                    index + 1,
                    summary.dateStr,
                    avgStr,
                    totalStr,
                    summary.status
                ]);
            });

            console.log();
            console.log(table.toString());
            console.log();
        });
}