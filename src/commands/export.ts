import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises'; // Use promise-based fs
import path from 'path';
import dayjs from 'dayjs';
import envPaths from 'env-paths'; // Import envPaths
import { getDb, LogEntry } from '../lib/db';
import { isValidDate } from '../lib/utils';

// Get application-specific paths (consistent with db.ts)
const appPaths = envPaths('time-cli', { suffix: '' });
const defaultExportDir = path.join(appPaths.data, 'exports'); // Define default export directory

export function registerExportCommand(program: Command) {
    program
        .command('export')
        .description('📤 Export logged sessions to a JSON file.')
        .option('-o, --output <filepath>', `Output file path (defaults to DATA_DIR/exports/time-cli-export-TIMESTAMP.json)`) // Updated help text
        .option('-s, --start <YYYY-MM-DD>', 'Start date for export range')
        .option('-e, --end <YYYY-MM-DD>', 'End date for export range (inclusive)')
        .action(async (options) => {
            try {
                const db = getDb();
                const startDateInput = options.start as string | undefined;
                const endDateInput = options.end as string | undefined;
                let outputPath = options.output as string | undefined;

                // --- Validate Dates ---
                let startDate: string | null = null;
                let endDate: string | null = null;

                if (startDateInput) {
                    if (!isValidDate(startDateInput)) {
                        console.error(chalk.red(`Error: Invalid start date format "${startDateInput}". Please use YYYY-MM-DD.`));
                        process.exit(1);
                    }
                    startDate = startDateInput;
                }
                if (endDateInput) {
                     if (!isValidDate(endDateInput)) {
                        console.error(chalk.red(`Error: Invalid end date format "${endDateInput}". Please use YYYY-MM-DD.`));
                        process.exit(1);
                     }
                    endDate = endDateInput;
                }
                if (startDate && endDate && dayjs(endDate).isBefore(dayjs(startDate))) {
                     console.error(chalk.red(`Error: End date (${endDate}) cannot be before start date (${startDate}).`));
                     process.exit(1);
                }

                // --- Determine Output Path ---
                if (!outputPath) {
                    // Default to XDG data directory subfolder
                    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
                    const defaultFilename = `time-cli-export-${timestamp}.json`;
                    // Construct the default path within the designated export directory
                    outputPath = path.join(defaultExportDir, defaultFilename);
                    console.log(chalk.gray(`No output path specified, using default: ${defaultExportDir}`));
                }

                // --- Ensure Output Directory Exists ---
                // This needs to happen *before* writing the file, regardless of default or specified path.
                const outputDir = path.dirname(outputPath);
                try {
                    // Use await here as fs.mkdir returns a promise
                    await fs.mkdir(outputDir, { recursive: true });
                } catch (mkdirError: any) {
                    // Check if the error is something other than the directory already existing
                    if (mkdirError.code !== 'EEXIST') {
                        console.error(chalk.red(`Error creating directory "${outputDir}":`), mkdirError);
                        process.exit(1);
                    }
                    // If the error code is EEXIST, it means the directory exists, which is fine.
                }


                // --- Build Query ---
                let sql = `SELECT * FROM logs WHERE duration IS NOT NULL`;
                const params: string[] = [];

                if (startDate) {
                    sql += ` AND date(start_time) >= ?`;
                    params.push(startDate);
                }
                if (endDate) {
                    sql += ` AND date(start_time) <= ?`;
                    params.push(endDate);
                }
                sql += ` ORDER BY start_time ASC`;

                // --- Fetch Data ---
                const exportStmt = db.prepare<string[], LogEntry>(sql);
                const logsToExport = exportStmt.all(...params);

                // --- Write File ---
                const jsonData = JSON.stringify(logsToExport, null, 2);
                await fs.writeFile(outputPath, jsonData, 'utf8');

                // --- Report Success ---
                console.log(chalk.green(`✅ Successfully exported ${logsToExport.length} log entries to:`));
                // Ensure we print the resolved, absolute path
                console.log(chalk.blue(path.resolve(outputPath)));

            } catch (error) {
                console.error(chalk.red('Failed to export data:'), error);
                process.exit(1);
            }
        });
}