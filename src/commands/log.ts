import { Command } from 'commander';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { getDb } from '../lib/db'; // Assuming LogEntry type might be needed later, but not directly for overlap query
import {
    generateUUID,
    // calculateDuration, // We'll use the new parser, but keep calculateDuration for potential validation if needed
    formatTime,
    formatDuration,
    shortenUUID,
    parseDurationToSeconds // Import the new parser
} from '../lib/utils';

// Define a simple type for the overlap query result (same as in add.ts)
interface PotentialOverlap {
    id: string;
    start_time: string;
    end_time: string;
}

export function registerLogCommand(program: Command) {
    program
        .command('log <duration>')
        .description('⚡ Logs a completed session ending now with the specified duration (e.g., "45m", "1h 30m").')
        .action((durationStr: string) => {
            try {
                const db = getDb();

                // --- 1. Parse Duration ---
                const durationSeconds = parseDurationToSeconds(durationStr);
                if (durationSeconds === null || durationSeconds <= 0) {
                    console.error(chalk.red(`Error: Invalid duration format "${durationStr}".`));
                    console.error(chalk.yellow('Use formats like "45m", "1h", "2h 30m". Duration must be positive.'));
                    process.exit(1);
                }

                // --- 2. Calculate Times ---
                const endTime = dayjs(); // Right now
                const startTime = endTime.subtract(durationSeconds, 'second');

                const newStartTimeISO = startTime.toISOString();
                const newEndTimeISO = endTime.toISOString();

                 // --- 3. Check Overlaps ---
                 // Prepare overlap check statement (same as add.ts)
                const overlapCheckStmt = db.prepare<[string, string], PotentialOverlap>(`
                    SELECT id, start_time, end_time
                    FROM logs
                    WHERE end_time > ? AND start_time < ?
                `);
                const overlappingSessions = overlapCheckStmt.all(newStartTimeISO, newEndTimeISO);

                if (overlappingSessions.length > 0) {
                    console.error(chalk.red('Error: The calculated session time overlaps with existing session(s):'));
                    console.error(chalk.yellow(`  Calculated: ${formatTime(newStartTimeISO)} - ${formatTime(newEndTimeISO)}`));
                    overlappingSessions.forEach(conflict => {
                        console.log(
                            `  - Conflict: ID ${chalk.gray(shortenUUID(conflict.id))}, ` +
                            `Time ${chalk.yellow(formatTime(conflict.start_time))} - ${chalk.yellow(formatTime(conflict.end_time))}`
                        );
                    });
                    console.error(chalk.yellow('Session not logged.'));
                    process.exit(1);
                }

                // --- 4. Insert into DB ---
                const newId = generateUUID();
                const insertStmt = db.prepare(`
                    INSERT INTO logs (id, start_time, end_time, duration)
                    VALUES (?, ?, ?, ?)
                `);

                const info = insertStmt.run(newId, newStartTimeISO, newEndTimeISO, durationSeconds);

                if (info.changes === 1) {
                    console.log(chalk.green('✅ Session logged successfully!'));
                    console.log(`   Start:    ${chalk.yellow(formatTime(newStartTimeISO))} (${startTime.format('YYYY-MM-DD')})`); // Show date too
                    console.log(`   End:      ${chalk.yellow(formatTime(newEndTimeISO))} (Now)`);
                    console.log(`   Duration: ${chalk.magenta(formatDuration(durationSeconds))}`);
                } else {
                    console.error(chalk.red('Error: Failed to insert session into the database.'));
                    process.exit(1);
                }

            } catch (error) {
                console.error(chalk.red('Failed to log session:'), error);
                process.exit(1);
            }
        });
}