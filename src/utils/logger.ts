// src/utils/logger.ts
import chalk from 'chalk';

export const logger = {
  log: (message: string) => console.log(message),
  info: (message: string) => console.log(chalk.blue(message)),
  success: (message: string) => console.log(chalk.green(message)),
  warn: (message: string) => console.log(chalk.yellow(message)),
  error: (message: string) => console.error(chalk.red(message)),
};