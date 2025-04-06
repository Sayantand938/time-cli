import { Command } from 'commander';
import chalk from 'chalk';
import { findActiveSession, stopSession } from '../lib/db';
import { formatTimestamp, formatDuration } from '../lib/utils';

export function registerStopCommand(program: Command) {
    program
        .command('stop')
        .description('Stop the currently active session')
        .action(() => { // Keep action synchronous unless awaiting inside
            const activeSession = findActiveSession();

            if (!activeSession) {
                console.error(chalk.red('Error: No active session found to stop.'));
                console.error(chalk.blue('Run "time-cli start" to begin a new session.'));
                process.exitCode = 1; // Set exit code for error
                return; // Exit the action
            }

            const stopped = stopSession(activeSession.id);

            if (stopped) {
                const endTime = Math.floor(Date.now() / 1000);
                // Recalculate duration accurately using the session start time
                const durationSeconds = endTime - activeSession.start_time;
                console.log(chalk.green('✅ Session stopped successfully at:'), chalk.cyan(formatTimestamp(endTime)));
                console.log(chalk.magenta('   Duration:'), chalk.bold(formatDuration(durationSeconds)));
                console.log(chalk.dim(`   Session ID: ${activeSession.id}`));
            } else {
                // This might happen if the session was stopped between findActiveSession and stopSession call,
                // or if there was a DB error during the update.
                console.error(chalk.red('Error: Could not stop the active session. It might have been stopped already, or a database error occurred.'));
                process.exitCode = 1;
            }
        });
}