import { Command, Option } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllSessions, Session } from '../lib/db';
import { formatTime, formatDuration, formatDate, parseFilterString, ParsedFilter } from '../lib/utils';

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
                            parsedFilters.push(parsed);
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
                                // Check for null/undefined values first
                                if (session.end_time === null || filter.valueSeconds === null || filter.valueSeconds === undefined) {
                                    return false;
                                }
                                const sessionDuration = session.end_time - session.start_time;
                                const filterSeconds = filter.valueSeconds;

                                switch (filter.operator) {
                                    case '=': return sessionDuration === filterSeconds;
                                    case '>': return sessionDuration > filterSeconds;
                                    case '>=': return sessionDuration >= filterSeconds;
                                    default: return false;
                                }
                            }
                            default:
                                return true;
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
                colWidths: [12, 15, 15, 18, 15],
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
                const startTimeStr = formatTime(session.start_time);
                const endTimeStr = session.end_time === null
                    ? chalk.yellow('Active')
                    : formatTime(session.end_time);
                const durationStr = session.end_time !== null
                    ? formatDuration(session.end_time - session.start_time)
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