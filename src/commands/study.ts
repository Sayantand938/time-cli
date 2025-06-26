// src/commands/study.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { initDb, logStudyAndManageBank, getSlotDurationForDate, getTimeBankBalance } from '../utils/db.js';
import { TIME_SLOTS_CONFIG, SHIFT_DEFINITIONS, getSlotConfigByStoreValue, SLOT_TARGET_MINUTES } from '../utils/constants.js';

// Reusable chalk styles
const color = {
  title: chalk.bold.blue,
  prompt: chalk.bold.blue,
  option: chalk.white,
  selectedOption: chalk.green,
  current: chalk.cyan.bold,
  warning: chalk.yellow,
  error: chalk.red.bold,
  success: chalk.green.bold,
  info: chalk.magenta,
  value: chalk.bold.cyan,
};

// Format hours like 08 AM, 04 PM
function formatHour(hour: number): string {
  const isPM = hour >= 12;
  const hr12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr12.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

// Format shift label like "08 AM – 12 PM"
function formatShiftLabel(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} – ${formatHour(endHour)}`;
}

// Prompt user to pick a shift, then a slot within that shift
async function promptShiftAndSlot(): Promise<{ selectedSlotValue: string }> {
  const shiftChoices = SHIFT_DEFINITIONS.map(shift => ({
    name: color.option(formatShiftLabel(shift.startHour, shift.endHour)),
    value: shift,
  }));

  const { selectedShift } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedShift',
      message: color.prompt('Select a shift:'),
      choices: shiftChoices,
      pageSize: 5,
    }
  ]);

  const currentHour = new Date().getHours();

  const timeSlotsInShift = TIME_SLOTS_CONFIG
    .filter(slot =>
      slot.startHour24 >= selectedShift.startHour &&
      slot.startHour24 < selectedShift.endHour
    )
    .map(slot => {
      const isCurrent = currentHour === slot.startHour24;
      return {
        name: isCurrent
          ? color.current(slot.displayName)
          : color.option(slot.displayName),
        value: slot.storeValue,
      };
    });

  // Find default slot based on current hour
  const defaultSlot = timeSlotsInShift.find(slotChoice => {
    const originalSlot = getSlotConfigByStoreValue(slotChoice.value);
    return originalSlot?.startHour24 === currentHour;
  });
  const defaultIndex = defaultSlot ? timeSlotsInShift.indexOf(defaultSlot) : 0;

  const { selectedSlotValue } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedSlotValue',
      message: `Select a time slot from ${color.selectedOption(
        formatShiftLabel(selectedShift.startHour, selectedShift.endHour)
      )}:`,
      choices: timeSlotsInShift,
      default: defaultIndex,
      loop: false,
      pageSize: 10,
    }
  ]);

  return { selectedSlotValue };
}

const studyCmd = new Command('study')
  .description(color.info(`Log study time. Max ${SLOT_TARGET_MINUTES}m logged to slot, excess goes to bank.`))
  .action(async () => {
    try {
      await initDb();

      const { selectedSlotValue } = await promptShiftAndSlot();
      const slotConfig = getSlotConfigByStoreValue(selectedSlotValue);

      if (!slotConfig) {
        logger.error(color.error(`Could not find configuration for selected slot: ${selectedSlotValue}`));
        return;
      }

      const displaySlotName = slotConfig.displayName;
      const currentDate = new Date().toISOString().split('T')[0];

      const { userInputMinutes } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInputMinutes',
          message: `Enter study time in minutes for ${color.value(displaySlotName)} (0-${SLOT_TARGET_MINUTES}):`,
          validate: (input: string) => {
            const minutes = parseInt(input, 10);
            if (isNaN(minutes)) return color.warning('Please enter a valid number.');
            if (minutes < 0) return color.warning('Study time cannot be negative.');
            if (minutes > 60) return color.warning(`Please enter a value between 0 and 60.`);
            return true;
          },
          filter: (input: string) => parseInt(input, 10),
        },
      ]);

      const existingDurationInSlot = getSlotDurationForDate(currentDate, slotConfig.storeValue);
      let proceedWithSave = true;

      const minutesToLogForSlot = Math.min(userInputMinutes, SLOT_TARGET_MINUTES);
      const minutesToBank = Math.max(0, userInputMinutes - SLOT_TARGET_MINUTES);

      if (
        existingDurationInSlot !== null &&
        existingDurationInSlot > 0 &&
        existingDurationInSlot !== minutesToLogForSlot
      ) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Slot ${color.value(displaySlotName)} currently has ${existingDurationInSlot}m. Your input of ${userInputMinutes}m will set slot to ${minutesToLogForSlot}m (and bank ${minutesToBank}m if any). Overwrite?`,
            default: false,
          },
        ]);
        if (!overwrite) {
          proceedWithSave = false;
        }
      } else if (existingDurationInSlot === minutesToLogForSlot && minutesToBank === 0) {
        logger.info(
          color.info(
            `No change needed. ${minutesToLogForSlot}m already logged for ${displaySlotName}, and no new time to bank.`
          )
        );
        proceedWithSave = false;
      }

      if (proceedWithSave) {
        let bankAction: { type: 'deposit', minutes: number } | undefined = undefined;
        if (minutesToBank > 0) {
          bankAction = { type: 'deposit', minutes: minutesToBank };
        }

        logStudyAndManageBank(currentDate, slotConfig.storeValue, minutesToLogForSlot, bankAction);

        let successMessage = color.success(
          `Successfully logged ${minutesToLogForSlot} minutes for ${displaySlotName} on ${currentDate}.`
        );
        if (minutesToBank > 0) {
          successMessage += ` ${color.warning(minutesToBank + ' minutes added to your time bank.')}`;
        }
        logger.success(successMessage);

        // Only show bank balance if user exceeded the limit
        if (minutesToBank > 0) {
          const updatedBankBalance = getTimeBankBalance();
          logger.info(color.info(`Current time bank balance: ${color.value(updatedBankBalance + ' minutes')}`));
        }
      } else if (!(existingDurationInSlot === minutesToLogForSlot && minutesToBank === 0)) {
        logger.info(color.info('Operation cancelled.'));
      }

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        console.error('An unexpected error object was thrown:', error);
        throw new Error('An unexpected error occurred while logging study time.');
      }
    }
  });

export default studyCmd;