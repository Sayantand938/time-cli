import { Command, Option } from 'commander';
import chalk from 'chalk';
import { findSessionsByShortId, updateSession, findOverlappingSessionsForEdit } from '../lib/db';
import { parseTimeAndCombineWithDate, formatTimestamp, formatDurationAsHHMM } from '../lib/utils';

const SHORT_ID_LENGTH = 8;

export function registerEditCommand(program: Command) {
    program
        .command('edit')
        .description('Edit the start or end time of an existing session')
        .argument('<shortId>', `The first ${SHORT_ID_LENGTH} characters of the session ID to edit`)
        .addOption(new Option('-s, --startTime <time>', 'New start time (e.g., "09:00 AM", "14:30")'))
        .addOption(new Option('-e, --endTime <time>', 'New end time (e.g., "05:00 PM", "17:00")'))
        .action(async (shortId: string, options: { startTime?: string; endTime?: string }) => {

            if (shortId.length !== SHORT_ID_LENGTH) {
                console.error(chalk.red(`Error: Invalid short ID length. Expected ${SHORT_ID_LENGTH} characters.`));
                process.exitCode = 1;
                return;
            }
            if (!options.startTime && !options.endTime) {
                console.error(chalk.red('Error: You must provide at least --startTime or --endTime to edit.'));
                process.exitCode = 1;
                return;
            }

            const matchingSessions = findSessionsByShortId(shortId);

            if (matchingSessions.length === 0) {
                console.error(chalk.red(`Error: No session found with short ID starting with ${chalk.bold(shortId)}.`));
                process.exitCode = 1;
                return;
            }
            if (matchingSessions.length > 1) {
                console.error(chalk.red(`Error: Ambiguous short ID "${chalk.bold(shortId)}". Multiple sessions found:`));
                matchingSessions.forEach(s => console.error(chalk.yellow(`  - ${s.id}`)));
                process.exitCode = 1;
                return;
            }

            const originalSession = matchingSessions[0];
            const originalDate = new Date(originalSession.start_time * 1000);

            if (isNaN(originalDate.getTime())) {
                 console.error(chalk.red(`Error: Could not parse original date for session ${chalk.bold(shortId)}.`));
                 process.exitCode = 1;
                 return;
            }

            let newStartTimeStamp: number = originalSession.start_time;
            let newEndTimeStamp: number | null = originalSession.end_time;

            if (options.startTime) {
                const parsedStartDate = parseTimeAndCombineWithDate(options.startTime, originalDate);
                if (!parsedStartDate) {
                    process.exitCode = 1;
                    return;
                }
                newStartTimeStamp = Math.floor(parsedStartDate.getTime() / 1000);
            }

            if (options.endTime) {
                const parsedEndDate = parseTimeAndCombineWithDate(options.endTime, originalDate);
                 if (!parsedEndDate) {
                    process.exitCode = 1;
                    return;
                }
                newEndTimeStamp = Math.floor(parsedEndDate.getTime() / 1000);
            }

            if (newEndTimeStamp !== null && newStartTimeStamp >= newEndTimeStamp) {
                console.error(chalk.red('Error: New start time must be strictly before the new end time.'));
                console.error(`  ${chalk.cyan('Attempted Start:')} ${formatTimestamp(newStartTimeStamp)}`);
                console.error(`  ${chalk.cyan('Attempted End:')}   ${formatTimestamp(newEndTimeStamp)}`);
                process.exitCode = 1;
                return;
            }

            const overlaps = findOverlappingSessionsForEdit(newStartTimeStamp, newEndTimeStamp, originalSession.id);
            if (overlaps.length > 0) {
                console.error(chalk.red('Error: The edited time range would overlap with other existing session(s):'));
                 overlaps.forEach(ov => {
                     console.error(chalk.yellow(`  - ID: ${ov.id.substring(0,8)}, Start: ${formatTimestamp(ov.start_time)}, End: ${formatTimestamp(ov.end_time)}`));
                 });
                 process.exitCode = 1;
                 return;
            }

            const success = updateSession(originalSession.id, newStartTimeStamp, newEndTimeStamp);

            if (success) {
                console.log(chalk.green('✅ Session updated successfully!'));
                console.log(chalk.dim(`   Session ID: ${originalSession.id}`));

                const originalStartTimeStr = formatTimestamp(originalSession.start_time);
                const newStartTimeStr = formatTimestamp(newStartTimeStamp);
                if (originalStartTimeStr !== newStartTimeStr) {
                     console.log(`   ${chalk.cyan('Start Time:')} ${chalk.red(originalStartTimeStr)} -> ${chalk.green(newStartTimeStr)}`);
                } else {
                     console.log(`   ${chalk.cyan('Start Time:')} ${originalStartTimeStr}`);
                }

                const originalEndTimeStr = formatTimestamp(originalSession.end_time);
                const newEndTimeStr = formatTimestamp(newEndTimeStamp);
                 if (originalEndTimeStr !== newEndTimeStr) {
                     console.log(`   ${chalk.cyan('End Time:')}   ${chalk.red(originalEndTimeStr)} -> ${chalk.green(newEndTimeStr)}`);
                 } else {
                     console.log(`   ${chalk.cyan('End Time:')}   ${originalEndTimeStr}`);
                 }

                 if (newEndTimeStamp !== null) {
                    const newDurationStr = formatDurationAsHHMM(newEndTimeStamp - newStartTimeStamp);
                    console.log(`   ${chalk.magenta('New Duration:')} ${chalk.bold(newDurationStr)}`);
                } else {
                     console.log(`   ${chalk.magenta('New Duration:')} ${chalk.yellow('Active')}`);
                }

            } else {
                console.error(chalk.red('Error: Failed to update session in the database.'));
                process.exitCode = 1;
            }
        });
}