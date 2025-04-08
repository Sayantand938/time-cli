import { Command, Option } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllSessions, Session } from '../lib/db';
// Import the new formatters and keep formatDate
import { formatTimeAmPm, formatDurationAsHHMM, formatDate, parseFilterString, ParsedFilter } from '../lib/utils';

export function registerListCommand(program: Command) {
    program
        .command('list')
        .description('List sessions (most recent first) with optional filtering')
        .addOption(new Option('-f, --filter <expression...>', 'Filter output (e.g., "date=YYYY-MM-DD", "duration>=1h30m")'))
        .action((options: { filter?: string[] }) => {
            let sessions = getAllSessions();

            // --- Apply Filters ---
            const parsedFilters: ParsedFilter[] = [];
            if (options.filter && options.filter.length > 0) {
                options.filter.forEach(fStr => {
                    const parsed = parseFilterString(fStr);
                    if (parsed) {
                        if (!['date', 'duration'].includes(parsed.key)) {
                            console.error(chalk.red(`Invalid filter key "${parsed.key}" for list command. Allowed keys: date, duration`));
                            process.exitCode = 1;
                        } else {
                             // Added specific check for duration value parsing success
                            if (parsed.key === 'duration' && parsed.valueSeconds === null) {
                                // Error already printed by parseFilterString or parseDurationToSeconds
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
                sessions = sessions.filter(session => {
                    return parsedFilters.every(filter => {
                        switch (filter.key) {
                            case 'date': {
                                const sessionDate = formatDate(session.start_time);
                                if (filter.operator === '=') {
                                    return sessionDate === filter.value;
                                } else {
                                    console.warn(chalk.yellow(`Operator "${filter.operator}" ignored for 'date' filter (only '=' is supported). Using '='.`));
                                    return sessionDate === filter.value;
                                }
                            }

                            case 'duration': {
                                // Check if session is active first
                                if (session.end_time === null) {
                                    return false;
                                }
                                // **Explicitly check if valueSeconds is a number BEFORE using it**
                                if (typeof filter.valueSeconds !== 'number') {
                                    // This case should ideally not be reached due to prior parsing checks,
                                    // but it satisfies TypeScript and adds robustness.
                                    console.warn(chalk.yellow(`Skipping duration filter due to unexpected missing valueSeconds for filter: ${filter.key}${filter.operator}${filter.value}`));
                                    return false; // Skip this filter check if valueSeconds isn't a number
                                }

                                const sessionDuration = session.end_time - session.start_time;
                                const filterSeconds = filter.valueSeconds; // Now TS knows it's a number

                                switch (filter.operator) {
                                    case '=': return sessionDuration === filterSeconds;
                                    case '>': return sessionDuration > filterSeconds;
                                    case '>=': return sessionDuration >= filterSeconds;
                                    // Add other operators here if parseFilterString supports them
                                    default: return false;
                                }
                            }
                            default:
                                return true; // Ignore unknown filter keys (already validated)
                        }
                    });
                });
            }
            // --- End Apply Filters ---

            if (sessions.length === 0) {
                if (parsedFilters.length > 0) {
                    console.log(chalk.yellow('No sessions match the specified filters.'));
                } else {
                    console.log(chalk.yellow('No sessions recorded yet.'));
                    console.log(chalk.blue('Run "time-cli start" to begin tracking!'));
                }
                return;
            }

            const table = new Table({
                head: [
                    chalk.blue.bold('ID'), chalk.blue.bold('Date'), chalk.blue.bold('Start Time'),
                    chalk.blue.bold('End Time'), chalk.blue.bold('Duration')
                ],
                // Adjusted widths slightly for hh:mm AM/PM format
                colWidths: [12, 15, 18, 18, 12],
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

            sessions.forEach((session: Session) => {
                const shortId = session.id.substring(0, 8);
                const dateStr = formatDate(session.start_time);
                // Use formatTimeAmPm for start time
                const startTimeStr = formatTimeAmPm(session.start_time);
                // Handle end time: Active or formatted using formatTimeAmPm
                const endTimeStr = session.end_time === null
                    ? chalk.yellow('Active')
                    : formatTimeAmPm(session.end_time);
                // Handle duration: --- or formatted using formatDurationAsHHMM
                const durationStr = session.end_time !== null
                    ? formatDurationAsHHMM(session.end_time - session.start_time)
                    : chalk.gray('---');

                table.push([
                    chalk.dim(shortId), dateStr, startTimeStr, endTimeStr, durationStr
                ]);
            });

            console.log();
            console.log(table.toString());
            console.log();
        });
}