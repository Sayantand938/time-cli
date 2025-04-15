import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises'; // Use promise-based fs
import path from 'path';
import dayjs from 'dayjs';
import { getDb } from '../lib/db';
import {
    generateUUID,
    calculateDuration,
    formatTime,
    shortenUUID
} from '../lib/utils';

// Define a type for the log entries we expect in the JSON file
// Allow id and duration to be potentially missing/null
interface ImportLogEntry {
    id?: string | null; // ID from import file will be ignored
    start_time: string;
    end_time: string | null; // Allow null initially, but should be set for completed
    duration?: number | null;
    // Allow other potential fields from export? Decide if needed.
}

// Type for overlap check
interface PotentialOverlap {
    id: string;
    start_time: string;
    end_time: string;
}

export function registerImportCommand(program: Command) {
    program
        .command('import <filepath>')
        .description('📥 Import logged sessions from a JSON file (checks for overlaps).')
        .option('--skip-overlaps', 'Skip importing entries that overlap with existing ones, otherwise abort.')
        .action(async (filepath: string, options) => { // Action needs to be async
            const skipOverlaps = options.skipOverlaps as boolean ?? false;
            let importedCount = 0;
            let skippedOverlapCount = 0;
            let skippedInvalidCount = 0;
            const skippedDetails: string[] = [];

            try {
                const db = getDb();
                const absolutePath = path.resolve(filepath);

                // --- Read and Parse File ---
                let fileContent: string;
                try {
                    fileContent = await fs.readFile(absolutePath, 'utf8');
                } catch (readError: any) {
                    if (readError.code === 'ENOENT') {
                        console.error(chalk.red(`Error: File not found at "${absolutePath}".`));
                    } else {
                        console.error(chalk.red(`Error reading file "${absolutePath}":`), readError);
                    }
                    process.exit(1);
                }

                let entriesToImport: ImportLogEntry[];
                try {
                    entriesToImport = JSON.parse(fileContent);
                    if (!Array.isArray(entriesToImport)) {
                        throw new Error("JSON data is not an array.");
                    }
                } catch (parseError) {
                    console.error(chalk.red('Error: Failed to parse JSON file.'), parseError);
                    process.exit(1);
                }

                if (entriesToImport.length === 0) {
                    console.log(chalk.yellow('Import file is empty. No entries to import.'));
                    return;
                }

                // --- Prepare Statements (inside try for DB errors) ---
                const overlapCheckStmt = db.prepare<[string, string], PotentialOverlap>(`
                    SELECT id, start_time, end_time
                    FROM logs
                    WHERE end_time > ? AND start_time < ?
                `);

                const insertStmt = db.prepare(`
                    INSERT INTO logs (id, start_time, end_time, duration)
                    VALUES (?, ?, ?, ?)
                `);

                // --- Process Entries with Transaction ---
                console.log(`Attempting to import ${entriesToImport.length} entries...`);

                // Define the transaction function
                const importTransaction = db.transaction(() => {
                    for (const entry of entriesToImport) {
                        // 1. Validate Basic Structure & Times
                        if (!entry.start_time || !entry.end_time) {
                            skippedInvalidCount++;
                            skippedDetails.push(`Missing start/end time: ${JSON.stringify(entry)}`);
                            continue;
                        }
                        const startTime = dayjs(entry.start_time);
                        const endTime = dayjs(entry.end_time);
                        if (!startTime.isValid() || !endTime.isValid()) {
                            skippedInvalidCount++;
                            skippedDetails.push(`Invalid start/end time format: ${entry.start_time} / ${entry.end_time}`);
                            continue;
                        }

                        // 2. Calculate Duration (important!)
                        const durationSeconds = calculateDuration(startTime.toISOString(), endTime.toISOString());
                        if (durationSeconds <= 0) {
                            skippedInvalidCount++;
                             skippedDetails.push(`Non-positive duration: ${entry.start_time} - ${entry.end_time}`);
                            continue;
                        }

                        // 3. Check for Overlaps
                        const overlapping = overlapCheckStmt.all(startTime.toISOString(), endTime.toISOString());
                        if (overlapping.length > 0) {
                            const conflictDetails = overlapping.map(o => `${shortenUUID(o.id)} (${formatTime(o.start_time)}-${formatTime(o.end_time)})`).join(', ');
                            skippedDetails.push(`Overlap with existing (${conflictDetails}) for entry: ${formatTime(entry.start_time)} - ${formatTime(entry.end_time)}`);

                            if (skipOverlaps) {
                                skippedOverlapCount++;
                                continue; // Skip this entry
                            } else {
                                // Abort the entire transaction
                                throw new Error(`Overlap detected with session(s): ${conflictDetails}. Aborting import. Use --skip-overlaps to ignore.`);
                            }
                        }

                        // 4. Generate New ID and Insert
                        const newId = generateUUID();
                        insertStmt.run(
                            newId,
                            startTime.toISOString(),
                            endTime.toISOString(),
                            durationSeconds
                        );
                        importedCount++;
                    } // end for loop
                }); // end transaction definition

                // Execute the transaction
                importTransaction(); // Execute transaction for all entries

                // --- Report Summary ---
                console.log(chalk.green(`✅ Import finished!`));
                console.log(`   Successfully imported: ${chalk.greenBright(importedCount)}`);
                if (skippedOverlapCount > 0) {
                     console.log(`   Skipped (Overlap):   ${chalk.yellow(skippedOverlapCount)}`);
                }
                if (skippedInvalidCount > 0) {
                     console.log(`   Skipped (Invalid):   ${chalk.red(skippedInvalidCount)}`);
                }
                 if (skippedDetails.length > 0) {
                    console.log(chalk.gray('\nSkipped Entry Details:'));
                    skippedDetails.forEach(detail => console.log(chalk.gray(`  - ${detail}`)));
                 }

            } catch (error: any) { // Catch potential transaction errors
                console.error(chalk.red('\nImport failed:'), error.message || error);
                process.exit(1);
            }
        });
}