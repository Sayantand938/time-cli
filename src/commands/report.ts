// src/commands/report.ts

import { Command } from 'commander';
import chalk from 'chalk';
import boxen, { Options as BoxenOptions } from 'boxen';
import dayjs from 'dayjs';
import { getDb } from '../lib/db';
import {
    formatDuration,
    DAILY_GOAL_SECONDS,
    // formatDate // No longer needed here if only using dayjs formats
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
type FocusedReportChalkColor =
    | 'yellowBright'
    | 'gray'
    | 'blueBright'
    | 'green'
    | 'yellow'
    | 'magenta'
    | 'red';

// --- Main Command Registration ---

export function registerReportCommand(program: Command) {
    program
        .command('report')
        .description('📈 Shows statistics on study habits and patterns (based on local time).') // Updated description
        .action(() => {
            try {
                const db = getDb();

                // --- Query 1: Fetch all necessary raw log data ---
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
                    console.log(chalk.yellow('\n🟡 No completed study sessions logged yet. Nothing to report.\n'));
                    return; // Exit if no data
                }

                // --- Aggregate Data per LOCAL Day ---
                const dailyAggregates: Record<string, { total_duration: number }> = {};
                rawLogs.forEach(log => {
                    const localDate = dayjs(log.start_time).format('YYYY-MM-DD');
                    dailyAggregates[localDate] = dailyAggregates[localDate] || { total_duration: 0 };
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

                // --- Perform Calculations ---
                // Note: We already checked rawLogs.length > 0, so sortedDays is guaranteed non-empty here.
                const totalDaysWithRecords = sortedDays.length;
                const firstEntry = sortedDays[0].local_date;
                const lastEntry = sortedDays[sortedDays.length - 1].local_date;

                let daysMeetingGoal = 0;
                let bestDay: AggregatedReportDay | null = null; // Initialize as potentially null
                let worstDay: AggregatedReportDay | null = null; // Initialize as potentially null

                // Use a for...of loop for clearer type analysis by TS
                for (const day of sortedDays) {
                    if (day.goal_met) {
                        daysMeetingGoal++;
                    }
                    // Find best/worst days
                    // Check !bestDay first to handle the initial null case safely
                    if (!bestDay || day.total_duration > bestDay.total_duration) {
                        bestDay = day;
                    }
                     // Check !worstDay first to handle the initial null case safely
                    if (!worstDay || day.total_duration < worstDay.total_duration) {
                        worstDay = day;
                    }
                }
                // After this loop, if sortedDays was non-empty, bestDay and worstDay *should* be assigned AggregatedReportDay

                // Goal Percentage
                const percentageMeetingGoal = totalDaysWithRecords > 0
                    ? (daysMeetingGoal / totalDaysWithRecords) * 100
                    : 0;

                // Overall Totals and Averages
                const totalDurationAllTime = rawLogs.reduce((sum, log) => sum + log.duration, 0);
                const averageDurationPerActiveDay = totalDaysWithRecords > 0 ? totalDurationAllTime / totalDaysWithRecords : 0;

                // Day of the Week Analysis
                const timeByDayOfWeek: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
                const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                rawLogs.forEach(log => {
                    const dayName = dayjs(log.start_time).format('ddd');
                    if (dayName in timeByDayOfWeek) {
                        timeByDayOfWeek[dayName] += log.duration;
                    }
                });

                // Consistency Calculation (based on local date range)
                let consistencyText = 'N/A';
                let totalDaysInRange = 0;
                // firstEntry and lastEntry are guaranteed to exist here because sortedDays is non-empty
                const firstD = dayjs(firstEntry);
                const lastD = dayjs(lastEntry);
                totalDaysInRange = lastD.diff(firstD, 'day') + 1; // Inclusive range
                consistencyText = `${totalDaysWithRecords} / ${totalDaysInRange} days`;


                // --- Format Output ---
                const lines: string[] = [];
                const sectionSpacer = ''; // Blank line between sections

                // Helper to add lines, ensuring alignment
                const addLine = (label: string, value: string | number, valueColor: FocusedReportChalkColor = 'yellowBright') => {
                    const maxLabelLength = 22; // Adjusted length for new labels
                    const formattedValue = typeof value === 'number'
                       ? (value % 1 === 0 ? value.toString() : value.toFixed(1)) // Keep decimal for percentage
                       : value;
                    lines.push(`${label.padEnd(maxLabelLength)} : ${chalk[valueColor](formattedValue)}`);
                };

                // --- Build Report Sections ---
                lines.push(chalk.cyan.bold('🗓️ Overview & Totals'));
                addLine('Tracking Period', `${firstEntry} to ${lastEntry}`, 'gray');
                addLine('Total Active Days', totalDaysWithRecords, 'yellowBright');
                addLine('Total Study Time', formatDuration(totalDurationAllTime), 'magenta');
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('📊 Daily Performance'));
                addLine('Avg. Time / Active Day', formatDuration(averageDurationPerActiveDay));
                addLine('Goal Success Rate', `${percentageMeetingGoal.toFixed(1)}%`); // Use toFixed for consistency
                addLine('Days Goal Met', `${daysMeetingGoal} / ${totalDaysWithRecords} (Active)`);
                // Use explicit checks for null here - TS should now correctly narrow the types
                if (bestDay) {
                    addLine('Most Productive Day', `${bestDay.local_date} (${formatDuration(bestDay.total_duration)})`, 'green');
                }
                if (worstDay && totalDaysWithRecords > 1) { // Avoid showing worst if only one day exists
                    addLine('Least Productive Day', `${worstDay.local_date} (${formatDuration(worstDay.total_duration)})`, 'red');
                }
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('📅 Weekly Patterns'));
                let foundDowData = false;
                dayOrder.forEach(day => {
                    if (timeByDayOfWeek[day] > 0) {
                        addLine(day, formatDuration(timeByDayOfWeek[day]), 'blueBright');
                        foundDowData = true;
                    }
                });
                if (!foundDowData) lines.push(chalk.gray('  (No data for specific days yet)'));
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('🏃 Consistency'));
                addLine('Active Days / Range', consistencyText, 'gray');

                // --- Display Report ---
                const boxenOptions: BoxenOptions = {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: '📊 Study Habits Report (Local Time) 📊',
                    titleAlignment: 'center'
                };

                console.log(boxen(lines.join('\n'), boxenOptions));

            } catch (error) {
                console.error(chalk.red('\n❌ Failed to generate study report:'), error);
                process.exit(1);
            }
        });
}