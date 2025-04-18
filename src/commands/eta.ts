// src/commands/eta.ts

import { Command } from 'commander';
import boxen, { Options as BoxenOptions } from 'boxen';
import chalk from 'chalk';
import dayjs from 'dayjs'; // Import dayjs
import { getDb } from '../lib/db';
import {
    DAILY_GOAL_SECONDS,
    formatDuration,
} from '../lib/utils';

// Interface for the raw data needed
interface LogDuration {
    duration: number;
}

export function registerEtaCommand(program: Command) {
    program
        .command('eta')
        .description('🎯 Calculates remaining time to reach the daily goal (based on local time).') // Updated description
        .action(() => {
            try {
                const db = getDb();

                // --- Calculate UTC boundaries for the current LOCAL day ---
                const nowLocal = dayjs();
                const startOfTodayLocal = nowLocal.startOf('day');
                const startOfTomorrowLocal = startOfTodayLocal.add(1, 'day');

                const startUTC = startOfTodayLocal.toISOString();
                const endUTC = startOfTomorrowLocal.toISOString();

                // --- Query logs that started within the local day's UTC boundaries ---
                const sumDurationStmt = db.prepare<[string, string], { total: number | null }>(`
                    SELECT SUM(duration) as total
                     FROM logs
                     WHERE start_time >= ? AND start_time < ?
                       AND duration IS NOT NULL
                `);

                const result = sumDurationStmt.get(startUTC, endUTC); // Use the calculated UTC boundaries

                const totalDurationToday = result?.total ?? 0;
                const remainingSeconds = Math.max(0, DAILY_GOAL_SECONDS - totalDurationToday);
                const goalAchieved = remainingSeconds <= 0;

                // --- Formatting and Display (remains the same) ---
                const goalStr = formatDuration(DAILY_GOAL_SECONDS);
                const totalStr = formatDuration(totalDurationToday);
                const remainingStr = formatDuration(remainingSeconds);

                const labelGoal = "Daily Goal:";
                const labelTotal = "Total Time Today:";
                const labelRemaining = "Time Remaining:";

                const maxLength = Math.max(labelGoal.length, labelTotal.length, labelRemaining.length);

                const lines = [
                    `${labelGoal.padEnd(maxLength)}        ${goalStr}`,
                    `${labelTotal.padEnd(maxLength)}        ${totalStr}`,
                    `${labelRemaining.padEnd(maxLength)}        ${chalk.bold(remainingStr)}`
                ];

                if (goalAchieved) {
                    lines.push('');
                    lines.push(chalk.green('Goal achieved for today! 🎉'));
                }

                const boxenOptions: BoxenOptions = {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: goalAchieved ? 'green' : 'yellow',
                    title: `Daily Progress (${startOfTodayLocal.format('YYYY-MM-DD')})`, // Add date to title
                    titleAlignment: 'center',
                };

                console.log(boxen(lines.join('\n'), boxenOptions));

            } catch (error) {
                console.error(chalk.red('Failed to calculate ETA:'), error);
                process.exit(1);
            }
        });
}