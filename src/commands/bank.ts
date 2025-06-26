// src/commands/bank.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { 
    initDb, 
    getTimeBankBalance, 
    redeemTimeFromBank, 
    getBankTransactionHistory, 
    BankTransaction           
} from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { TIME_SLOTS_CONFIG, findSlotConfig, SLOT_TARGET_MINUTES, getSlotConfigByStoreValue } from '../utils/constants.js';

const bankCmd = new Command('bank')
  .description('Manage and view your time bank.');

bankCmd
  .command('balance')
  .alias('view')
  .description('View your current time bank balance.')
  .action(async () => {
    // ... (balance command remains the same)
    try {
      initDb();
      const balance = getTimeBankBalance();
      logger.info(`Your current time bank balance is: ${chalk.green.bold(balance + ' minutes')}`);
      if (balance > 0) {
        logger.log(chalk.gray(`Use 'time-cli bank redeem' to use this banked time to fill slots up to ${SLOT_TARGET_MINUTES}m.`));
      } else if (balance === 0) {
        logger.log(chalk.gray(`Log more than ${SLOT_TARGET_MINUTES}m in a slot via 'time-cli study' to add to your bank.`));
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An unexpected error occurred while fetching time bank balance.');
    }
  });

bankCmd
  .command('redeem')
  .description(`Redeem time from bank to top up a slot to ${SLOT_TARGET_MINUTES}m.`)
  .option('-d, --date <YYYY-MM-DD>', 'The date of the study slot (e.g., "2023-10-28").')
  .option('-s, --slot <slot_identifier>', 'Slot identifier (e.g., "08:00 AM - 09:00 AM", "08:00 - 09:00", or "S08_09").')
  .option('-m, --minutes <amount>', 'The number of minutes to redeem.', parseInt)
  .action(async (options) => {
    // ... (redeem command remains the same)
    try {
      initDb();

      let { date, slot: slotIdentifier, minutes: minutesToAttemptRedeem } = options;

      if (!date) {
        const { promptDate } = await inquirer.prompt([
          {
            name: 'promptDate',
            message: 'Enter date (YYYY-MM-DD):',
            validate: d => /^\d{4}-\d{2}-\d{2}$/.test(d) || "Invalid format! Use YYYY-MM-DD.",
            default: new Date().toISOString().split('T')[0], 
          }
        ]);
        date = promptDate;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        logger.error('Invalid date format provided via option. Please use YYYY-MM-DD.');
        return;
      }

      let slotConfig;
      if (slotIdentifier) {
        slotConfig = findSlotConfig(slotIdentifier);
      }

      if (!slotConfig) {
        if (slotIdentifier) {
            logger.warn(`Slot identifier "${slotIdentifier}" not found. Please choose from the list.`);
        }
        const { promptedSlotStoreValue } = await inquirer.prompt([
            {
                type: 'list',
                name: 'promptedSlotStoreValue',
                message: 'Select a time slot to redeem for:',
                choices: TIME_SLOTS_CONFIG.map(s => ({ name: s.displayName, value: s.storeValue })),
                pageSize: 10,
            }
        ]);
        slotConfig = findSlotConfig(promptedSlotStoreValue)!; 
      }
      
      if (minutesToAttemptRedeem === undefined || isNaN(minutesToAttemptRedeem) || minutesToAttemptRedeem <= 0) {
          const { promptedMinutes } = await inquirer.prompt([
            {
              name: 'promptedMinutes',
              message: `Enter minutes to redeem for ${slotConfig.displayName} (e.g., 10):`,
              filter: Number,
              validate: m => (Number.isInteger(m) && m > 0) || "Must be a positive number!"
            }
          ]);
          minutesToAttemptRedeem = promptedMinutes;
      }


      const result = redeemTimeFromBank(date, slotConfig, minutesToAttemptRedeem);

      if (result.success) {
        logger.success(`${result.message} New slot value for ${slotConfig.displayName} on ${date}: ${chalk.cyan(result.newSlotValue + 'm')}.`);
        const newBankBalance = getTimeBankBalance();
        logger.info(`Updated time bank balance: ${chalk.green.bold(newBankBalance + ' minutes')}`);
      } else {
        logger.warn(result.message); 
        const currentBankBalance = getTimeBankBalance();
        logger.info(`Current time bank balance: ${chalk.yellow(currentBankBalance + ' minutes')}`);
      }

    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An unexpected error occurred during redemption process.');
    }
  });

bankCmd
  .command('statement')
  .description('View the statement of time bank transactions.')
  .option('-n, --count <number>', 'Number of recent transactions to show.', parseInt)
  .action(async (options) => {
    try {
      initDb();
      const limit = options.count || 20;
      const transactions = getBankTransactionHistory(limit); 

      if (transactions.length === 0) {
        logger.info('No time bank transactions found.');
        return;
      }

      const table = new Table({
        // REORDERED COLUMNS in head
        head: [ 
          chalk.cyan('Timestamp'),
          chalk.cyan('Source Date'),
          chalk.cyan('Source Slot'),
          chalk.cyan('Type'),
          chalk.cyan('Mins'),
        ],
        // ADJUSTED colWidths for the new order
        colWidths: [22, 13, 30, 12, 7], 
        chars: { 
            top: '═', 'top-mid': '╦', 'top-left': '╔', 'top-right': '╗',
            bottom: '═', 'bottom-mid': '╩', 'bottom-left': '╚', 'bottom-right': '╝',
            left: '║', 'left-mid': '╠', mid: '═', 'mid-mid': '╬',
            right: '║', 'right-mid': '╣', middle: '║',
        },
        style: { head: ['cyan'], border: ['grey'] },
      });

      transactions.forEach((tx: BankTransaction) => {
        const slotDisplayName = tx.source_slot_key ? getSlotConfigByStoreValue(tx.source_slot_key)?.displayName || tx.source_slot_key : 'N/A';
        const typeDisplay = tx.type === 'deposit' ? chalk.green(tx.type) : chalk.yellow(tx.type);
        const minutesDisplay = tx.type === 'deposit' ? chalk.green(`+${tx.minutes}`) : chalk.yellow(`-${tx.minutes}`);

        // REORDERED data in pushed array
        table.push([ 
          new Date(tx.transaction_timestamp).toLocaleString(),
          tx.source_session_date || 'N/A',
          slotDisplayName,
          typeDisplay,
          minutesDisplay,
        ]);
      });

      console.log(table.toString());
      if (transactions.length === limit) {
          logger.info(chalk.gray(`Showing last ${limit} transactions. Use --count <number> to see more/less.`));
      }

    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('An unexpected error occurred while fetching bank statement.');
    }
  });

export default bankCmd;