// src/commands/report.ts

import { Command } from 'commander';
import chalk from 'chalk';
import boxen, { Options as BoxenOptions } from 'boxen';
import dayjs from 'dayjs';
import { getDb } from '../lib/db';
import {
    formatDuration,
    DAILY_GOAL_SECONDS,
    formatDate // Use formatDate for consistency
} from '../lib/utils';

// --- Interfaces ---

// For raw data fetched from DB
interface RawReportLog {
    start_time: string;
    duration: number;
}

// For aggregated data per LOCAL day
interface AggregatedReportDay {
    local_date: string; // YYYY-MM-DD
    total_duration: number;
    goal_met: boolean;
}

// Define the allowed Chalk color keys used in this specific report's addLine function
type FocusedReportChalkColor = 'yellowBright' | 'gray' | 'blueBright' | 'green' | 'yellow';


// --- Main Command Registration ---

export function registerReportCommand(program: Command) {
    program
        .command('report')
        .description('📈 Shows focused statistics on goals, streaks, and consistency (based on local time).') // Updated description
        .action(() => {
            try {
                const db = getDb();

                // --- Query 1: Fetch all necessary raw log data ---
                // No date filtering here, report covers all time
                const rawLogsSql = `
                    SELECT
                        start_time,
                        duration
                    FROM logs
                    WHERE duration IS NOT NULL
                    ORDER BY start_time ASC
                `;
                const fetchLogsStmt = db.prepare<[], RawReportLog>(rawLogsSql);
                const rawLogs = fetchLogsStmt.all();

                if (rawLogs.length === 0) {
                    console.log(chalk.yellow('\n🟡 No study sessions logged yet. Nothing to report.\n'));
                    return;
                }

                // --- Aggregate Data per LOCAL Day ---
                const dailyAggregates: Record<string, { total_duration: number }> = {};

                rawLogs.forEach(log => {
                    const localDate = dayjs(log.start_time).format('YYYY-MM-DD');
                    if (!dailyAggregates[localDate]) {
                        dailyAggregates[localDate] = { total_duration: 0 };
                    }
                    dailyAggregates[localDate].total_duration += log.duration;
                });

                // Convert to sorted array and calculate goal status
                const sortedDays: AggregatedReportDay[] = Object.entries(dailyAggregates)
                    .map(([date, data]) => ({
                        local_date: date,
                        total_duration: data.total_duration,
                        goal_met: data.total_duration >= DAILY_GOAL_SECONDS,
                    }))
                    .sort((a, b) => a.local_date.localeCompare(b.local_date)); // Sort by local date ASC


                // --- Perform Calculations based on Local Day Aggregates ---
                const totalDaysWithRecords = sortedDays.length;
                const firstEntry = sortedDays[0].local_date; // Already formatted YYYY-MM-DD
                const lastEntry = sortedDays[sortedDays.length - 1].local_date; // Already formatted YYYY-MM-DD

                let daysMeetingGoal = 0;
                let currentStreak = 0;
                let longestStreak = 0;
                let tempCurrentStreak = 0;

                sortedDays.forEach(day => {
                    if (day.goal_met) {
                        daysMeetingGoal++;
                        tempCurrentStreak++;
                    } else {
                        longestStreak = Math.max(longestStreak, tempCurrentStreak);
                        tempCurrentStreak = 0;
                    }
                });
                longestStreak = Math.max(longestStreak, tempCurrentStreak); // Final check

                // Determine current streak accurately based on LOCAL dates
                const lastLogDay = sortedDays[sortedDays.length - 1];
                const lastLogDateObj = dayjs(lastLogDay.local_date); // Already local date
                const today = dayjs().startOf('day');
                const yesterday = dayjs().subtract(1, 'day').startOf('day');

                // Check if the last recorded LOCAL day was today or yesterday AND the goal was met
                if (lastLogDay.goal_met && (lastLogDateObj.isSame(today) || lastLogDateObj.isSame(yesterday))) {
                    // To correctly calculate the current streak, we need to check continuity backwards from the last valid day
                    currentStreak = 0;
                    for (let i = sortedDays.length - 1; i >= 0; i--) {
                        const day = sortedDays[i];
                        const dayDateObj = dayjs(day.local_date);
                        // Check if it's contiguous with the previous day in the streak OR the start of the streak
                        const expectedPreviousDate = dayjs(sortedDays[i + 1]?.local_date).subtract(1, 'day');
                         if (day.goal_met && (i === sortedDays.length - 1 || dayDateObj.isSame(expectedPreviousDate))) {
                             currentStreak++;
                         } else {
                             break; // Streak broken
                         }
                    }
                } else {
                    currentStreak = 0; // Streak is not current if last day goal wasn't met or it wasn't today/yesterday
                }


                // Goal Percentage
                const percentageMeetingGoal = totalDaysWithRecords > 0
                    ? (daysMeetingGoal / totalDaysWithRecords) * 100
                    : 0;

                // --- Consistency Calculation (based on local date range) ---
                let consistencyText = 'N/A';
                let totalDaysInRange = 0;
                const firstD = dayjs(firstEntry); // Already local
                const lastD = dayjs(lastEntry);   // Already local
                totalDaysInRange = lastD.diff(firstD, 'day') + 1; // Inclusive range
                if (totalDaysInRange > 0) {
                    consistencyText = `${totalDaysWithRecords} / ${totalDaysInRange} days`;
                }

                // --- Format Output (using addLine function) ---
                const lines: string[] = [];
                const sectionSpacer = ''; // Blank line between sections

                const addLine = (label: string, value: string | number, valueColor: FocusedReportChalkColor = 'yellowBright') => {
                    const maxLabelLength = 20;
                    const formattedValue = typeof value === 'number'
                       ? (value % 1 === 0 ? value.toString() : value.toFixed(1))
                       : value;
                    lines.push(`${label.padEnd(maxLabelLength)} : ${chalk[valueColor](formattedValue)}`);
                };

                // --- Build Report Sections ---
                lines.push(chalk.cyan.bold('🗓️ Tracking Period'));
                addLine('First Log (Local)', firstEntry, 'gray');
                addLine('Last Log (Local)', lastEntry, 'gray');
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('🎯 Daily Goal Pursuit'));
                addLine('Goal Success Rate', `${percentageMeetingGoal}%`); // Removed .toFixed(1) if percentage is calculated precisely
                addLine('Days Goal Met', `${daysMeetingGoal} / ${totalDaysWithRecords} (Active)`);
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('🔥 Goal Streaks'));
                addLine('Current Streak', `${currentStreak} Day(s)`, 'blueBright');
                addLine('Longest Streak', `${longestStreak} Day(s)`, 'blueBright');
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('🏃 Consistency'));
                addLine('Active Days / Range', consistencyText, 'gray');


                // --- Display Report ---
                const boxenOptions: BoxenOptions = {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: '📊 Study Habits Report (Local Time) 📊', // Updated title
                    titleAlignment: 'center'
                };

                console.log(boxen(lines.join('\n'), boxenOptions));

            } catch (error) {
                console.error(chalk.red('\n❌ Failed to generate focused report:'), error);
                process.exit(1);
            }
        });
}