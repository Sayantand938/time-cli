// import { Command } from 'commander';
// import chalk from 'chalk';
// import boxen, { Options as BoxenOptions } from 'boxen';
// import dayjs from 'dayjs';
// import { getDb } from '../lib/db';
// import {
//     formatDuration,
//     DAILY_GOAL_SECONDS,
//     formatDate
// } from '../lib/utils';

// // Type for the daily summary query result
// interface DailySummary {
//     log_date: string;
//     total_duration: number;
// }

// // Type for the overall stats query result
// interface OverallStats {
//     grand_total_duration: number | null;
//     total_sessions: number;
//     first_entry_date: string | null;
//     last_entry_date: string | null;
// }


// export function registerReportCommand(program: Command) {
//     program
//         .command('report')
//         .description('📈 Shows overall statistics including goal streaks.')
//         .action(() => {
//             try {
//                 const db = getDb();

//                 // --- Query 1: Get daily summaries (MUST be ordered by date for streaks) ---
//                 const dailySummarySql = `
//                     SELECT
//                         DATE(start_time) as log_date,
//                         SUM(duration) as total_duration
//                     FROM logs
//                     WHERE duration IS NOT NULL
//                     GROUP BY log_date
//                     ORDER BY log_date ASC
//                 `;
//                 const dailySummaryStmt = db.prepare<[], DailySummary>(dailySummarySql); // Pass SQL here
//                 const dailySummaries = dailySummaryStmt.all();

//                 // --- Query 2: Get overall totals and dates ---
//                 // Define the SQL string first
//                 const overallStatsSql = `
//                     SELECT
//                         SUM(duration) as grand_total_duration,
//                         COUNT(id) as total_sessions,
//                         MIN(start_time) as first_entry_date,
//                         MAX(start_time) as last_entry_date
//                     FROM logs
//                     WHERE duration IS NOT NULL
//                 `;
//                 // Prepare the statement using the defined SQL string
//                 const overallStatsStmt = db.prepare<[], OverallStats>(overallStatsSql);
//                 // Now get the results (should not require arguments)
//                 const overallStats = overallStatsStmt.get(); // This should now be correct


//                 // --- Calculations (Streak logic and others remain the same) ---
//                 const totalDaysWithRecords = dailySummaries.length;
//                 let daysMeetingGoal = 0;
//                 let currentStreak = 0;
//                 let longestStreak = 0;
//                 let tempCurrentStreak = 0;

//                 if (totalDaysWithRecords > 0 && dailySummaries) {
//                     dailySummaries.forEach(summary => {
//                         const goalMet = summary.total_duration >= DAILY_GOAL_SECONDS;
//                         if (goalMet) {
//                             daysMeetingGoal++;
//                             tempCurrentStreak++;
//                         } else {
//                             longestStreak = Math.max(longestStreak, tempCurrentStreak);
//                             tempCurrentStreak = 0;
//                         }
//                     });
//                     longestStreak = Math.max(longestStreak, tempCurrentStreak);

//                     const lastLogEntry = dailySummaries[dailySummaries.length - 1];
//                     const lastLogDate = lastLogEntry.log_date;
//                     const goalMetOnLastDay = lastLogEntry.total_duration >= DAILY_GOAL_SECONDS;
//                     const today = dayjs().format('YYYY-MM-DD');
//                     const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

//                     if (goalMetOnLastDay && (lastLogDate === today || lastLogDate === yesterday)) {
//                          currentStreak = tempCurrentStreak;
//                     } else {
//                          currentStreak = 0;
//                     }
//                }

//                 const percentageMeetingGoal = totalDaysWithRecords > 0
//                     ? (daysMeetingGoal / totalDaysWithRecords) * 100
//                     : 0;

//                 const grandTotalDuration = overallStats?.grand_total_duration ?? 0;
//                 const totalSessions = overallStats?.total_sessions ?? 0;
//                 const averageSessionDuration = totalSessions > 0 ? grandTotalDuration / totalSessions : 0;
//                 const averageDailyDuration = totalDaysWithRecords > 0 ? grandTotalDuration / totalDaysWithRecords : 0;
//                 const firstEntry = overallStats?.first_entry_date ? formatDate(overallStats.first_entry_date) : 'N/A';
//                 const lastEntry = overallStats?.last_entry_date ? formatDate(overallStats.last_entry_date) : 'N/A';


//                 // --- Format Output for Boxen (remains the same) ---
//                 const goalLabel = "Days Goal Met:";
//                 const totalDaysLabel = "Total Active Days:";
//                 const goalPercentLabel = "Goal Success Rate:";
//                 const currentStreakLabel = "Current Goal Streak:";
//                 const longestStreakLabel = "Longest Goal Streak:";
//                 const totalTimeLabel = "Total Time Logged:";
//                 const totalSessionsLabel = "Total Sessions:";
//                 const avgSessionLabel = "Avg. Session Time:";
//                 const avgDailyLabel = "Avg. Daily Time:";
//                 const firstEntryLabel = "First Entry:";
//                 const lastEntryLabel = "Last Entry:";

//                  const maxLength = Math.max(
//                     goalLabel.length, totalDaysLabel.length, goalPercentLabel.length,
//                     currentStreakLabel.length, longestStreakLabel.length,
//                     totalTimeLabel.length, totalSessionsLabel.length,
//                     avgSessionLabel.length, avgDailyLabel.length,
//                     firstEntryLabel.length, lastEntryLabel.length
//                 );

//                 const lines = [
//                     chalk.cyan.bold('--- Goal Performance ---'),
//                     `${goalLabel.padEnd(maxLength)} : ${chalk.green(daysMeetingGoal)}`,
//                     `${totalDaysLabel.padEnd(maxLength)} : ${chalk.yellow(totalDaysWithRecords)}`,
//                     `${goalPercentLabel.padEnd(maxLength)} : ${chalk.yellowBright(percentageMeetingGoal.toFixed(1))}%`,
//                     '',
//                     chalk.cyan.bold('--- Streaks (Days) ---'),
//                     `${currentStreakLabel.padEnd(maxLength)} : ${chalk.blueBright(currentStreak)}`,
//                     `${longestStreakLabel.padEnd(maxLength)} : ${chalk.blueBright(longestStreak)}`,
//                     '',
//                     chalk.cyan.bold('--- Overall Stats ---'),
//                     `${totalTimeLabel.padEnd(maxLength)} : ${chalk.magenta(formatDuration(grandTotalDuration))}`,
//                     `${totalSessionsLabel.padEnd(maxLength)} : ${chalk.magenta(totalSessions)}`,
//                     `${avgSessionLabel.padEnd(maxLength)} : ${chalk.blue(formatDuration(averageSessionDuration))}`,
//                     `${avgDailyLabel.padEnd(maxLength)} : ${chalk.blue(formatDuration(averageDailyDuration))}`,
//                     '',
//                      chalk.cyan.bold('--- Data Range ---'),
//                      `${firstEntryLabel.padEnd(maxLength)} : ${chalk.gray(firstEntry)}`,
//                      `${lastEntryLabel.padEnd(maxLength)} : ${chalk.gray(lastEntry)}`
//                 ];


//                 // --- Display Report (remains the same) ---
//                  if (totalDaysWithRecords === 0 && totalSessions === 0) {
//                     console.log();
//                     console.log(chalk.yellow('No study sessions logged yet. Nothing to report.'));
//                     console.log();
//                     return;
//                 }

//                 const boxenOptions: BoxenOptions = {
//                     padding: 1,
//                     margin: 1,
//                     borderStyle: 'double',
//                     borderColor: 'cyan',
//                     title: 'Study Time Report',
//                     titleAlignment: 'center'
//                 };

//                 console.log(boxen(lines.join('\n'), boxenOptions));

//             } catch (error) {
//                 console.error(chalk.red('Failed to generate report:'), error);
//                 process.exit(1);
//             }
//         });
// }

import { Command } from 'commander';
import chalk from 'chalk';
import boxen, { Options as BoxenOptions } from 'boxen';
import dayjs from 'dayjs';
import { getDb } from '../lib/db';
import {
    formatDuration,
    DAILY_GOAL_SECONDS,
    formatDate
} from '../lib/utils';

// --- Interfaces for Required Query Results ---

interface DailySummary {
    log_date: string;
    goal_met: number; // 1 if goal met, 0 otherwise
    // total_duration is implicitly calculated by goal_met check but not explicitly needed here
}

interface OverallDateRange {
    first_entry_date: string | null;
    last_entry_date: string | null;
}

// Define the allowed Chalk color keys used in this specific report's addLine function
type FocusedReportChalkColor = 'yellowBright' | 'gray' | 'blueBright';

// --- Main Command Registration ---

export function registerReportCommand(program: Command) {
    program
        .command('report')
        .description('📈 Shows focused statistics on goals, streaks, and consistency.')
        .action(() => {
            try {
                const db = getDb();

                // --- Query 1: Daily Summaries (ordered for streaks, check goal status) ---
                // We only need the date and whether the goal was met for these stats
                const dailySummarySql = `
                    SELECT
                        DATE(start_time) as log_date,
                        CASE WHEN SUM(duration) >= ? THEN 1 ELSE 0 END as goal_met
                    FROM logs
                    WHERE duration IS NOT NULL
                    GROUP BY log_date
                    ORDER BY log_date ASC
                `;
                const dailySummaryStmt = db.prepare<[number], DailySummary>(dailySummarySql);
                const dailySummaries = dailySummaryStmt.all(DAILY_GOAL_SECONDS);

                // --- Query 2: Get Overall Date Range ---
                const dateRangeSql = `
                    SELECT
                        MIN(start_time) as first_entry_date,
                        MAX(start_time) as last_entry_date
                    FROM logs
                    WHERE duration IS NOT NULL
                `;
                const dateRangeStmt = db.prepare<[], OverallDateRange>(dateRangeSql);
                const dateRange = dateRangeStmt.get();


                // --- Basic Checks & Initial Calculations ---
                const totalDaysWithRecords = dailySummaries.length; // Total days *with logs*

                if (totalDaysWithRecords === 0) {
                    console.log(chalk.yellow('\n🟡 No study sessions logged yet. Nothing to report.\n'));
                    return;
                }

                const firstEntry = dateRange?.first_entry_date ? formatDate(dateRange.first_entry_date) : 'N/A';
                const lastEntry = dateRange?.last_entry_date ? formatDate(dateRange.last_entry_date) : 'N/A';

                // --- Goal & Streak Calculation ---
                let daysMeetingGoal = 0;
                let currentStreak = 0;
                let longestStreak = 0;
                let tempCurrentStreak = 0;

                dailySummaries.forEach(summary => {
                    if (summary.goal_met) {
                        daysMeetingGoal++;
                        tempCurrentStreak++;
                    } else {
                        longestStreak = Math.max(longestStreak, tempCurrentStreak);
                        tempCurrentStreak = 0;
                    }
                });
                longestStreak = Math.max(longestStreak, tempCurrentStreak); // Check after loop ends

                // Determine current streak accurately
                const lastLogEntry = dailySummaries[dailySummaries.length - 1];
                const lastLogDate = dayjs(lastLogEntry.log_date);
                const today = dayjs().startOf('day');
                const yesterday = dayjs().subtract(1, 'day').startOf('day');

                if (lastLogEntry.goal_met && (lastLogDate.isSame(today) || lastLogDate.isSame(yesterday))) {
                    currentStreak = tempCurrentStreak;
                } else {
                    currentStreak = 0;
                }

                // Goal Percentage
                const percentageMeetingGoal = totalDaysWithRecords > 0
                    ? (daysMeetingGoal / totalDaysWithRecords) * 100
                    : 0;

                // --- Consistency Calculation ---
                let consistencyText = 'N/A';
                let totalDaysInRange = 0;
                if (dateRange?.first_entry_date && dateRange?.last_entry_date) {
                    const firstD = dayjs(dateRange.first_entry_date).startOf('day');
                    const lastD = dayjs(dateRange.last_entry_date).startOf('day');
                    totalDaysInRange = lastD.diff(firstD, 'day') + 1; // Inclusive range
                    if (totalDaysInRange > 0) {
                         // Format as X / Y days
                         consistencyText = `${totalDaysWithRecords} / ${totalDaysInRange} days`;
                    }
                }


                // --- Format Output ---
                const lines: string[] = [];
                const sectionSpacer = ''; // Blank line between sections

                // Function to add aligned key-value pairs
                const addLine = (label: string, value: string | number, valueColor: FocusedReportChalkColor = 'yellowBright') => {
                     const maxLabelLength = 20; // Adjusted max length
                     // Value is typically string or number for formatting here
                     const formattedValue = typeof value === 'number'
                        ? (value % 1 === 0 ? value.toString() : value.toFixed(1)) // Handle percentages/counts
                        : value;
                     lines.push(`${label.padEnd(maxLabelLength)} : ${chalk[valueColor](formattedValue)}`);
                 };

                // --- Build Report Sections ---

                lines.push(chalk.cyan.bold('🗓️ Tracking Period'));
                addLine('First Log Entry', firstEntry, 'gray');
                addLine('Last Log Entry', lastEntry, 'gray');
                lines.push(sectionSpacer);

                lines.push(chalk.cyan.bold('🎯 Daily Goal Pursuit'));
                addLine('Goal Success Rate', `${percentageMeetingGoal.toFixed(1)}%`);
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
                    title: '📊 Study Habits Report 📊',
                    titleAlignment: 'center'
                };

                console.log(boxen(lines.join('\n'), boxenOptions));

            } catch (error) {
                console.error(chalk.red('\n❌ Failed to generate focused report:'), error);
                process.exit(1);
            }
        });
}