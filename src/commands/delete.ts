import { Command } from 'commander';
import chalk from 'chalk';
import { deleteSessionByShortId } from '../lib/db';

// Define the expected length for a short ID
const SHORT_ID_LENGTH = 8;

export function registerDeleteCommand(program: Command) {
    program
        .command('delete')
        .description('Delete a session using its short ID (first 8 characters)')
        .argument('<shortId>', `The first ${SHORT_ID_LENGTH} characters of the session ID to delete`)
        .action((shortId: string) => {
            // Validate the input short ID length
            if (shortId.length !== SHORT_ID_LENGTH) {
                console.error(chalk.red(`Error: Invalid short ID length. Expected ${SHORT_ID_LENGTH} characters.`));
                console.error(chalk.yellow(`Example: time-cli delete ${'abcdef12'}`)); // Provide example
                process.exitCode = 1; // Indicate failure
                return;
            }

            // Call the database function to perform deletion
            const deletedCount = deleteSessionByShortId(shortId);

            // Handle the result based on the number of rows deleted
            if (deletedCount === 1) {
                // Success: Exactly one session was deleted
                console.log(chalk.green(`✅ Session starting with ID ${chalk.bold(shortId)} deleted successfully.`));
            } else if (deletedCount === 0) {
                // Not Found: No session matched the provided short ID prefix
                console.error(chalk.red(`Error: No session found with short ID starting with ${chalk.bold(shortId)}.`));
                process.exitCode = 1;
            } else if (deletedCount > 1) {
                // Ambiguity Warning: More than one session deleted (unexpected but possible)
                console.warn(chalk.yellow(`⚠️ Warning: Deleted ${deletedCount} sessions starting with ID ${chalk.bold(shortId)}.`));
                console.warn(chalk.yellow('   This indicates a potential short ID collision. Consider using full IDs if this persists.'));
            } else {
                // Error: deletedCount is likely -1, indicating a database error occurred
                console.error(chalk.red('Error: Failed to delete session due to a database error. Check previous logs.'));
                process.exitCode = 1;
            }
        });
}