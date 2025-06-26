// src/commands/summary.ts
import { Command } from "commander";
import Table from "cli-table3";
import chalk from "chalk";
import { getDb, initDb } from "../utils/db.js";
import { logger } from "../utils/logger.js";
// UPDATED IMPORT: Added TIME_SLOTS_CONFIG (specifically its length) and SLOT_TARGET_MINUTES
import { ALL_SLOT_DB_COLUMNS, TIME_SLOTS_CONFIG, SLOT_TARGET_MINUTES } from "../utils/constants.js";
import type { HorizontalTableRow } from "cli-table3";

interface StudySummaryRow {
  session_date: string;
  total_minutes: number;
}

// Calculate the target for a full day
const TARGET_DAILY_TOTAL_MINUTES = TIME_SLOTS_CONFIG.length * SLOT_TARGET_MINUTES;

const summaryCmd = new Command("summary")
  .description("Show total study time per day")
  .action(async () => {
    try {
      initDb();
      const db = getDb();

      // Construct the sum of all slot columns dynamically
      const sumOfSlotsExpression = ALL_SLOT_DB_COLUMNS.join(' + ');

      const stmt = db.prepare(`
        SELECT session_date, (${sumOfSlotsExpression}) as total_minutes
        FROM daily_study_logs
        WHERE total_minutes > 0 -- Only show days with actual study time
        ORDER BY session_date DESC
      `);

      const rows = stmt.all() as StudySummaryRow[];

      if (rows.length === 0) {
        logger.info(
          'No study sessions logged yet, or all logged days have zero total minutes. Use "time-cli study" to add some!'
        );
        return;
      }

      const table = new Table({
        head: [chalk.cyan("Date"), chalk.cyan("Total (mins)")],
        colWidths: [16, 25],
        chars: {
          top: "═", "top-mid": "╦", "top-left": "╔", "top-right": "╗",
          bottom: "═", "bottom-mid": "╩", "bottom-left": "╚", "bottom-right": "╝",
          left: "║", "left-mid": "╠", mid: "═", "mid-mid": "╬",
          right: "║", "right-mid": "╣", middle: "║",
        },
        style: { head: ["cyan"], border: ["white"] },
      });

      rows.forEach((row) => {
        // UPDATED LINE: Using TARGET_DAILY_TOTAL_MINUTES
        const displayTotalMinutes = row.total_minutes === TARGET_DAILY_TOTAL_MINUTES ? '✅' : row.total_minutes.toString();
        table.push([row.session_date, displayTotalMinutes] as HorizontalTableRow);
      });

      console.log(table.toString());
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          "An unexpected error occurred while fetching the summary."
        );
      }
    }
  });

export default summaryCmd;