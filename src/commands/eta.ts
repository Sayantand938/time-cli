import { Command } from 'commander';
import boxen, { Options as BoxenOptions } from 'boxen';
import chalk from 'chalk';
import dayjs from 'dayjs'; // Import dayjs
import { getDb } from '../lib/db';
import {
    DAILY_GOAL_SECONDS,
    formatDuration,
    // Remove getCurrentISODate from imports
} from '../lib/utils';

export function registerEtaCommand(program: Command) {
    program
        .command('eta')
        .description('🎯 Calculates remaining time to reach the daily goal (8 hours).') // Added emoji
        .action(() => {
            try {
                const db = getDb();
                // Get today's date directly using dayjs
                const today = dayjs().format('YYYY-MM-DD');

                const sumDurationStmt = db.prepare<[string], { total: number | null }>(`
                    SELECT SUM(duration) as total
                     FROM logs
                     WHERE DATE(start_time) = ? AND duration IS NOT NULL
                `);

                const result = sumDurationStmt.get(today); // Use the generated date

                const totalDurationToday = result?.total ?? 0;
                const remainingSeconds = Math.max(0, DAILY_GOAL_SECONDS - totalDurationToday);
                const goalAchieved = remainingSeconds <= 0;

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
                    title: 'Daily Progress',
                    titleAlignment: 'center',
                };

                console.log(boxen(lines.join('\n'), boxenOptions));

            } catch (error) {
                console.error(chalk.red('Failed to calculate ETA:'), error);
                process.exit(1);
            }
        });
}