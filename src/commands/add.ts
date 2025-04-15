// src/commands/add.ts

import { Command } from 'commander';
import chalk from 'chalk';
import dayjs from 'dayjs';
// Import isBetween plugin from dayjs if needed for alternative overlap check (optional)
// import isBetween from 'dayjs/plugin/isBetween';
// dayjs.extend(isBetween);
import { getDb } from '../lib/db'; // LogEntry type might not be needed directly
import {
    generateUUID,
    calculateDuration,
    formatTime,
    formatDate,
    formatDuration,
    parseTimeAndCombineWithDate,
    parseDurationToSeconds, // Need this parser now
    shortenUUID
} from '../lib/utils';

// Define a simple type for the overlap query result
interface PotentialOverlap {
    id: string;
    start_time: string;
    end_time: string;
}

export function registerAddCommand(program: Command) {
    program
        // Remove positional argument, add options
        .command('add')
        .description('➕ Add a completed session using a time range OR a duration ending now.')
        .option('-r, --range <range_string>', 'Specify the time range (e.g., "09:00 - 10:30", "8:00 AM - 1:15 PM")')
        .option('-L, --duration <duration_string>', 'Specify the duration ending now (e.g., "45m", "1h 30m")') // Using -L to avoid conflicts
        .option('-d, --date <YYYY-MM-DD|today|yesterday>', 'Date for the session (only applicable with --range, defaults to today)')
        .action((options) => {
            const rangeInput = options.range as string | undefined;
            const durationInput = options.duration as string | undefined;
            const dateInput = options.date as string | undefined;

            // --- Input Validation ---
            if ((!rangeInput && !durationInput) || (rangeInput && durationInput)) {
                console.error(chalk.red('Error: You must specify exactly one of --range OR --duration.'));
                process.exit(1);
            }
            if (durationInput && dateInput) {
                 console.error(chalk.red('Error: The --date option cannot be used with --duration.'));
                 console.error(chalk.yellow('--duration always logs a session ending now. Use --range to add to a specific date.'));
                 process.exit(1);
            }

            try {
                const db = getDb();

                let newStartTimeISO: string;
                let newEndTimeISO: string;
                let durationSeconds: number;
                let displayDateStr: string; // For success message

                // --- Logic Path: --range ---
                if (rangeInput) {
                    // Determine Target Date for range
                    let targetDateObj: dayjs.Dayjs;
                    if (!dateInput || dateInput.toLowerCase() === 'today') {
                        targetDateObj = dayjs().startOf('day');
                    } else if (dateInput.toLowerCase() === 'yesterday') {
                        targetDateObj = dayjs().subtract(1, 'day').startOf('day');
                    } else if (dayjs(dateInput, 'YYYY-MM-DD', true).isValid()) {
                        targetDateObj = dayjs(dateInput, 'YYYY-MM-DD', true);
                    } else {
                        console.error(chalk.red(`Error: Invalid date "${dateInput}". Use YYYY-MM-DD, 'today', or 'yesterday'.`));
                        process.exit(1);
                    }
                    displayDateStr = targetDateObj.format('YYYY-MM-DD');

                    // Parse Time Range String
                    const parts = rangeInput.split('-').map(part => part.trim());
                    if (parts.length !== 2 || !parts[0] || !parts[1]) {
                        console.error(chalk.red('Error: Invalid time range format for --range.'));
                        console.error(chalk.yellow(`Expected format: "HH:mm[ AM/PM] - HH:mm[ AM/PM]"`));
                        process.exit(1);
                    }
                    const startTimeStr = parts[0];
                    const endTimeStr = parts[1];

                    // Parse Start and End Times using the target date
                    let startTime = parseTimeAndCombineWithDate(startTimeStr, targetDateObj);
                    let endTime = parseTimeAndCombineWithDate(endTimeStr, targetDateObj);
                    if (!startTime) {
                        console.error(chalk.red(`Error: Could not parse start time "${startTimeStr}". Use HH:mm or hh:mm AM/PM.`));
                        process.exit(1);
                    }
                    if (!endTime) {
                        console.error(chalk.red(`Error: Could not parse end time "${endTimeStr}". Use HH:mm or hh:mm AM/PM.`));
                        process.exit(1);
                    }

                    // Handle Midnight Crossing
                    if (endTime.isBefore(startTime)) {
                        endTime = endTime.add(1, 'day');
                    }

                    // Calculate and Validate Duration
                    const calculatedDuration = calculateDuration(startTime.toISOString(), endTime.toISOString());
                    if (calculatedDuration <= 0) {
                        console.error(chalk.red('Error: Calculated duration is not positive. End time must be after start time.'));
                        process.exit(1);
                    }
                    durationSeconds = calculatedDuration;
                    newStartTimeISO = startTime.toISOString();
                    newEndTimeISO = endTime.toISOString();

                }
                // --- Logic Path: --duration ---
                else if (durationInput) {
                    const parsedDuration = parseDurationToSeconds(durationInput);
                    if (parsedDuration === null || parsedDuration <= 0) {
                        console.error(chalk.red(`Error: Invalid duration format "${durationInput}" for --duration.`));
                        console.error(chalk.yellow('Use formats like "45m", "1h", "2h 30m". Duration must be positive.'));
                        process.exit(1);
                    }
                    durationSeconds = parsedDuration;

                    // Calculate Times ending now
                    const endTime = dayjs();
                    const startTime = endTime.subtract(durationSeconds, 'second');
                    newStartTimeISO = startTime.toISOString();
                    newEndTimeISO = endTime.toISOString();
                    displayDateStr = startTime.format('YYYY-MM-DD'); // Date the session started
                }
                 else {
                     // This case should be caught by the initial validation, but good for safety
                     console.error(chalk.red('Internal Error: No valid input option determined.'));
                     process.exit(1);
                 }


                // --- OVERLAP CHECK (Common Logic) ---
                const overlapCheckStmt = db.prepare<[string, string], PotentialOverlap>(`
                    SELECT id, start_time, end_time
                    FROM logs
                    WHERE end_time > ? AND start_time < ?
                `);
                const overlappingSessions = overlapCheckStmt.all(newStartTimeISO, newEndTimeISO);

                if (overlappingSessions.length > 0) {
                    console.error(chalk.red('Error: The new session overlaps with existing session(s):'));
                     console.error(chalk.yellow(`  Proposed: ${formatTime(newStartTimeISO)} - ${formatTime(newEndTimeISO)} (${formatDate(newStartTimeISO)})`));
                    overlappingSessions.forEach(conflict => {
                        console.log(
                            `  - Conflict: ID ${chalk.gray(shortenUUID(conflict.id))}, ` +
                            `Time ${chalk.yellow(formatTime(conflict.start_time))} - ${chalk.yellow(formatTime(conflict.end_time))} (${formatDate(conflict.start_time)})`
                        );
                    });
                    console.error(chalk.yellow('Session not added.'));
                    process.exit(1);
                }


                // --- Prepare and Insert into DB (Common Logic) ---
                const newId = generateUUID();
                const insertStmt = db.prepare(`
                    INSERT INTO logs (id, start_time, end_time, duration)
                    VALUES (?, ?, ?, ?)
                `);
                const info = insertStmt.run(newId, newStartTimeISO, newEndTimeISO, durationSeconds);

                if (info.changes === 1) {
                    console.log(chalk.green('✅ Session added successfully!'));
                    console.log(`   Date:     ${chalk.blue(displayDateStr)}`); // Use display date
                    console.log(`   Start:    ${chalk.yellow(formatTime(newStartTimeISO))}`);
                    console.log(`   End:      ${chalk.yellow(formatTime(newEndTimeISO))}`);
                    console.log(`   Duration: ${chalk.magenta(formatDuration(durationSeconds))}`);
                } else {
                    console.error(chalk.red('Error: Failed to insert session into the database.'));
                    process.exit(1);
                }

            } catch (error) {
                console.error(chalk.red('Failed to add session:'), error);
                process.exit(1);
            }
        });
}