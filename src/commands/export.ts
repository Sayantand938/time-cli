// src/commands/export.ts

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises'; // Use promise-based fs
import path from 'path';
import dayjs from 'dayjs';
import envPaths from 'env-paths';
import { getDb, LogEntry } from '../lib/db';
import { isValidDate } from '../lib/utils';

const appPaths = envPaths('time-cli', { suffix: '' });
const defaultExportDir = path.join(appPaths.data, 'exports');

export function registerExportCommand(program: Command) {
    program
        .command('export')
        .description('📤 Export logged sessions to a JSON file (filters by local date).') // Updated description
        .option('-o, --output <filepath>', `Output file path (defaults to DATA_DIR/exports/time-cli-export-TIMESTAMP.json)`)
        .option('-s, --start <YYYY-MM-DD>', 'Start date (local) for export range (inclusive)')
        .option('-e, --end <YYYY-MM-DD>', 'End date (local) for export range (inclusive)')
        .action(async (options) => {
            try {
                const db = getDb();
                const startDateInput = options.start as string | undefined;
                const endDateInput = options.end as string | undefined;
                let outputPath = options.output as string | undefined;

                // --- Validate Input Dates ---
                let startDayLocal: dayjs.Dayjs | null = null;
                let endDayLocal: dayjs.Dayjs | null = null;

                if (startDateInput) {
                    if (!isValidDate(startDateInput)) {
                        console.error(chalk.red(`Error: Invalid start date format "${startDateInput}". Please use YYYY-MM-DD.`));
                        process.exit(1);
                    }
                    startDayLocal = dayjs(startDateInput).startOf('day'); // Use start of day
                }
                if (endDateInput) {
                    if (!isValidDate(endDateInput)) {
                        console.error(chalk.red(`Error: Invalid end date format "${endDateInput}". Please use YYYY-MM-DD.`));
                        process.exit(1);
                    }
                    // Use start of day for comparison, but the range includes this whole day
                    endDayLocal = dayjs(endDateInput).startOf('day');
                }
                if (startDayLocal && endDayLocal && endDayLocal.isBefore(startDayLocal)) {
                    console.error(chalk.red(`Error: End date (${endDateInput}) cannot be before start date (${startDateInput}).`));
                    process.exit(1);
                }

                // --- Determine Output Path (remains the same) ---
                if (!outputPath) {
                    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
                    const defaultFilename = `time-cli-export-${timestamp}.json`;
                    outputPath = path.join(defaultExportDir, defaultFilename);
                    console.log(chalk.gray(`No output path specified, using default: ${defaultExportDir}`));
                }

                // --- Ensure Output Directory Exists (remains the same) ---
                const outputDir = path.dirname(outputPath);
                try {
                    await fs.mkdir(outputDir, { recursive: true });
                } catch (mkdirError: any) {
                    if (mkdirError.code !== 'EEXIST') {
                        console.error(chalk.red(`Error creating directory "${outputDir}":`), mkdirError);
                        process.exit(1);
                    }
                }

                // --- Build Query with Corrected Date Filtering ---
                let sql = `SELECT * FROM logs WHERE duration IS NOT NULL`; // Export completed logs
                const params: string[] = [];

                if (startDayLocal) {
                    // Filter >= start of the local start day (UTC)
                    const startUTC = startDayLocal.toISOString();
                    sql += ` AND start_time >= ?`;
                    params.push(startUTC);
                }
                if (endDayLocal) {
                    // Filter < start of the day *after* the local end day (UTC)
                    // This makes the end date inclusive for the whole day
                    const endBoundaryUTC = endDayLocal.add(1, 'day').toISOString();
                    sql += ` AND start_time < ?`;
                    params.push(endBoundaryUTC);
                }
                sql += ` ORDER BY start_time ASC`;

                // --- Fetch Data ---
                const exportStmt = db.prepare<string[], LogEntry>(sql);
                const logsToExport = exportStmt.all(...params);

                // --- Write File (remains the same) ---
                const jsonData = JSON.stringify(logsToExport, null, 2);
                await fs.writeFile(outputPath, jsonData, 'utf8');

                // --- Report Success (remains the same) ---
                console.log(chalk.green(`✅ Successfully exported ${logsToExport.length} log entries to:`));
                console.log(chalk.blue(path.resolve(outputPath)));

            } catch (error) {
                console.error(chalk.red('Failed to export data:'), error);
                process.exit(1);
            }
        });
}