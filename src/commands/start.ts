import { Command } from 'commander';
import chalk from 'chalk';
import { findActiveSession, startSession } from '../lib/db';
import { formatTimestamp } from '../lib/utils';

export function registerStartCommand(program: Command) {
    program
        .command('start')
        .description('Start a new session')
        .action(() => { // Keep action synchronous unless awaiting inside
            const activeSession = findActiveSession();

            if (activeSession) {
                console.error(
                    chalk.red('Error: A session is already active, started at:'),
                    chalk.yellow(formatTimestamp(activeSession.start_time))
                );
                console.error(chalk.blue('Run "time-cli stop" to end the current session first.'));
                process.exitCode = 1; // Set exit code for error
                return; // Exit the action
            }

            const newSessionId = startSession();

            if (newSessionId) {
                const now = Math.floor(Date.now() / 1000);
                console.log(chalk.green('🚀 Session started successfully at:'), chalk.cyan(formatTimestamp(now)));
                console.log(chalk.dim(`   Session ID: ${newSessionId}`));
            } else {
                // This condition is now explicitly handled by the check above,
                // but keep a generic error for unexpected DB issues.
                console.error(chalk.red('Error: Could not start session. Please check database status.'));
                process.exitCode = 1;
            }
        });
}