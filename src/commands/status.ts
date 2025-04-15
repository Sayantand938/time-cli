import { Command } from 'commander';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { getDb, StatusEntry } from '../lib/db';
import { formatTime, formatDuration, calculateDuration } from '../lib/utils';

export function registerStatusCommand(program: Command) {
    program
        .command('status')
        .description('ℹ️ Shows the status of the current study session.')
        .action(() => {
            try {
                const db = getDb();

                // Prepare statement to get the current session status
                const getStatusStmt = db.prepare<[], StatusEntry>(
                    "SELECT * FROM status WHERE key = 'current_session'"
                );

                const currentSession = getStatusStmt.get(); // Get the current session status

                if (currentSession) {
                    // Session is running
                    const startTime = currentSession.start_time;
                    const now = dayjs(); // Get the current time
                    const durationSeconds = calculateDuration(startTime, now.toISOString()); // Use calculateDuration

                    const formattedStartTime = formatTime(startTime);
                    const formattedDuration = formatDuration(durationSeconds);

                    console.log(chalk.green('\n--- Session Active ---'));
                    console.log(`   Started:  ${chalk.yellow(formattedStartTime)}`);
                    console.log(`   Elapsed:  ${chalk.magenta.bold(formattedDuration)}`);
                    console.log(); // Add a blank line for spacing

                } else {
                    // No session is running
                    console.log(chalk.yellow('\n No active session\n'));
                    console.log(`   Use ${chalk.cyan('time-cli start')} to begin a new session.`);
                    console.log();
                }

            } catch (error) {
                console.error(chalk.red('Failed to get session status:'), error);
                process.exit(1);
            }
        });
}