// src/commands/reset.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import envPaths from 'env-paths';
// chalk might not be strictly needed for these very simple messages, but can be kept for consistency
// import chalk from 'chalk'; 
import { logger } from '../utils/logger.js';
import { closeDb } from '../utils/db.js';

const resetCmd = new Command('reset')
  .description('Permanently deletes all time-cli data and resets the database.')
  .action(async () => {
    try {
      const { confirmReset } = await inquirer.prompt([
        {
          type: 'confirm', // 'confirm' type inherently gives (Y/n) or similar based on Inquirer's defaults
          name: 'confirmReset',
          // --- REVISED MINIMALIST MESSAGE ---
          message: 'Do you want to reset all data and start fresh?', 
          default: false, // Default to 'no' for safety
        },
      ]);

      if (confirmReset) {
        const paths = envPaths('time-cli', { suffix: '' });
        const dbPath = path.join(paths.data, 'study_log.db');

        // Optional: logger.info('Closing any active database connections...');
        closeDb();

        try {
          await fs.stat(dbPath); // Check if file exists before trying to delete
          // Optional: logger.info(`Deleting database file: ${dbPath}`);
          await fs.unlink(dbPath);
          // --- REVISED SUCCESS MESSAGE ---
          logger.success('Data has been successfully reset.'); 
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // File didn't exist, which is fine for a reset.
            // Consider if you want to tell the user "No data to reset" or just "Data successfully reset" (as if it was cleared)
            logger.success('Data has been successfully reset (no existing data found).'); 
          } else {
            // For other errors during deletion
            logger.error(`Failed to reset data. Error: ${error.message}`);
            // logger.warn('Check file permissions or whether the file is currently in use by another process.');
            throw error; // Re-throw for global error handler if it's unexpected
          }
        }
      } else {
        // --- REVISED CANCELLATION MESSAGE ---
        logger.info('No data has been reset.');
      }

    } catch (error) {
      // This outer catch is for errors during prompt, path generation, or re-thrown fs errors
      // Avoid re-throwing if it's a known non-issue like ENOENT that was already handled.
      // However, if an unexpected error occurs, it should be handled by the global error handler.
      // The `throw error` in the inner catch for non-ENOENT fs errors will be caught here.
      if (!(error instanceof Error && error.message.includes('No existing data found'))) { // Adjust if needed
          // logger.error('An unexpected error occurred during the reset process.'); // Already handled by global handler
          throw error;
      }
    }
  });

export default resetCmd;