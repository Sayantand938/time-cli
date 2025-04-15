import { Command } from 'commander';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { getDb, LogEntry } from '../lib/db'; // Import LogEntry
import {
    calculateDuration,
    formatTime,
    formatDate,
    formatDuration,
    parseTimeAndCombineWithDate,
    parseRelativeTimeAdjustment, // Import new helper
    shortenUUID
} from '../lib/utils';

// Type for potentially overlapping session check (excluding self)
interface PotentialOverlap {
    id: string;
    start_time: string;
    end_time: string;
}

export function registerEditCommand(program: Command) {
    program
        .command('edit <id>')
        .description('✏️ Edit the start and/or end time of an existing session.')
        .option('-s, --start <time|adjustment>', 'New start time (e.g., "09:00 AM", "14:00", "+15m", "-1h")')
        .option('-e, --end <time|adjustment>', 'New end time (e.g., "11:30 AM", "16:00", "+30m", "-45m")')
        .action(async (id: string, options) => { // Mark action as async if needed (it isn't here)
            const newStartInput = options.start as string | undefined;
            const newEndInput = options.end as string | undefined;

            if (!newStartInput && !newEndInput) {
                console.error(chalk.red('Error: You must provide at least --start or --end to edit.'));
                process.exit(1);
            }

            if (!id || id.length !== 6) {
                console.error(chalk.red('Error: Please provide the short ID (first 6 characters) of the session to edit.'));
                process.exit(1);
            }

            try {
                const db = getDb();

                // --- 1. Find the original session ---
                const findLogStmt = db.prepare<{ id_pattern: string }, LogEntry>(
                    "SELECT id, start_time, end_time, duration FROM logs WHERE id LIKE :id_pattern"
                );
                const matchingLogs = findLogStmt.all({ id_pattern: `${id}%` });

                if (matchingLogs.length === 0) {
                    console.error(chalk.red(`Error: No session found with ID starting with "${id}".`));
                    process.exit(1);
                }
                if (matchingLogs.length > 1) {
                    console.error(chalk.red(`Error: Multiple sessions found starting with "${id}". Edit aborted for safety.`));
                    matchingLogs.forEach(log => console.error(`  - ${log.id}`));
                    process.exit(1);
                }

                const originalSession = matchingLogs[0];
                const originalStartTime = dayjs(originalSession.start_time);
                const originalEndTime = dayjs(originalSession.end_time); // Assuming end_time is never null here

                // --- 2. Calculate New Start Time ---
                let newStartTime = originalStartTime; // Default to original
                if (newStartInput) {
                    const adjustment = parseRelativeTimeAdjustment(newStartInput);
                    if (adjustment) {
                        // Apply relative adjustment
                        newStartTime = originalStartTime.add(adjustment.amount, adjustment.unit);
                    } else {
                        // Parse as absolute time, using original date as reference
                        const parsedAbsolute = parseTimeAndCombineWithDate(newStartInput, originalStartTime);
                        if (!parsedAbsolute) {
                             console.error(chalk.red(`Error: Invalid format for --start "${newStartInput}".`));
                             console.error(chalk.yellow('Use time (HH:mm, hh:mm A) or adjustment (+15m, -1h).'));
                             process.exit(1);
                        }
                        newStartTime = parsedAbsolute;
                    }
                }

                // --- 3. Calculate New End Time ---
                let newEndTime = originalEndTime; // Default to original
                 if (newEndInput) {
                    const adjustment = parseRelativeTimeAdjustment(newEndInput);
                    if (adjustment) {
                        // Apply relative adjustment
                        newEndTime = originalEndTime.add(adjustment.amount, adjustment.unit);
                    } else {
                         // Parse as absolute time, using original date as reference
                         // IMPORTANT: Use original *end* time's date if adjusting end time absolutely,
                         // in case the original session crossed midnight.
                         const parsedAbsolute = parseTimeAndCombineWithDate(newEndInput, originalEndTime);
                         if (!parsedAbsolute) {
                              console.error(chalk.red(`Error: Invalid format for --end "${newEndInput}".`));
                              console.error(chalk.yellow('Use time (HH:mm, hh:mm A) or adjustment (+30m, -45m).'));
                              process.exit(1);
                         }
                         newEndTime = parsedAbsolute;
                     }
                 }

                // --- 4. Validate New Time Range ---
                // Handle potential date shifts if adjustment crossed midnight (relative to original)
                // Note: Absolute times preserve the original date explicitly via parseTimeAndCombineWithDate.
                // If the *new* end time is before the *new* start time after all calculations,
                // assume it should be on the next day (this is a simplification).
                if (newEndTime.isBefore(newStartTime)) {
                   // This condition might be overly simple if complex multi-day edits were intended,
                   // but for simple adjustments or setting times on the original day, it might suffice.
                   // A more robust solution might involve explicitly asking the user if it crosses midnight.
                   // For now, let's assume it means next day if end < start *after* adjustments/setting.
                   newEndTime = newEndTime.add(1, 'day');
                   console.warn(chalk.yellow("Warning: Calculated end time is before start time; assuming it crosses midnight to the next day."));
                }

                const newDurationSeconds = calculateDuration(newStartTime.toISOString(), newEndTime.toISOString());
                if (newDurationSeconds <= 0) {
                    console.error(chalk.red('Error: Calculated duration after edits is not positive.'));
                     console.error(chalk.yellow(`Resulting range: ${formatTime(newStartTime.toISOString())} - ${formatTime(newEndTime.toISOString())}`));
                    process.exit(1);
                }

                // --- 5. Check Overlaps (Excluding Self) ---
                const newStartTimeISO = newStartTime.toISOString();
                const newEndTimeISO = newEndTime.toISOString();
                const overlapCheckStmt = db.prepare<[string, string, string], PotentialOverlap>(`
                    SELECT id, start_time, end_time
                    FROM logs
                    WHERE end_time > ? AND start_time < ? AND id != ? -- Exclude self
                `);
                const overlappingSessions = overlapCheckStmt.all(newStartTimeISO, newEndTimeISO, originalSession.id);

                if (overlappingSessions.length > 0) {
                    console.error(chalk.red(`Error: The edited session time (${formatTime(newStartTimeISO)} - ${formatTime(newEndTimeISO)}) overlaps with other session(s):`));
                    overlappingSessions.forEach(conflict => {
                        console.log(
                            `  - ID: ${chalk.gray(shortenUUID(conflict.id))}, ` +
                            `Time: ${chalk.yellow(formatTime(conflict.start_time))} - ${chalk.yellow(formatTime(conflict.end_time))}`
                        );
                    });
                    console.error(chalk.yellow('Edit aborted.'));
                    process.exit(1);
                }

                // --- 6. Update Database ---
                const updateStmt = db.prepare(`
                    UPDATE logs
                    SET start_time = ?, end_time = ?, duration = ?
                    WHERE id = ?
                `);
                const info = updateStmt.run(newStartTimeISO, newEndTimeISO, newDurationSeconds, originalSession.id);

                if (info.changes === 1) {
                     console.log(chalk.green(`✅ Session ${shortenUUID(originalSession.id)} updated successfully!`));
                     console.log(`   New Start:    ${chalk.yellow(formatTime(newStartTimeISO))}`);
                     console.log(`   New End:      ${chalk.yellow(formatTime(newEndTimeISO))}`);
                     console.log(`   New Duration: ${chalk.magenta(formatDuration(newDurationSeconds))}`);
                 } else {
                      console.error(chalk.red(`Error: Failed to update session ${shortenUUID(originalSession.id)} in the database.`));
                      process.exit(1);
                 }

            } catch (error) {
                 console.error(chalk.red('Failed to edit session:'), error);
                 process.exit(1);
            }
        });
}