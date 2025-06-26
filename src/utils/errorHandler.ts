// src/utils/errorHandler.ts
import chalk from 'chalk';

export function handleError(error: unknown): void {
  if (error instanceof Error) {
    // If it's a known error type, show the message
    console.error(chalk.red('Error:'), error.message);
  } else {
    // For unknown errors
    console.error(chalk.red('An unexpected error occurred.'));
  }
  // Exit with a failure code
  process.exit(1);
}