// src/index.ts
import { program } from 'commander';
import { registerStartCommand } from './commands/start';
import { registerStopCommand } from './commands/stop';
import { registerListCommand } from './commands/list';
import { registerDeleteCommand } from './commands/delete';
import { registerEtaCommand } from './commands/eta';
import { registerSummaryCommand } from './commands/summary';
import { registerReportCommand } from './commands/report';
import { registerAddCommand } from './commands/add';
import { registerEditCommand } from './commands/edit';
import { registerExportCommand } from './commands/export';
import { registerImportCommand } from './commands/import';
// import { registerHelloCommand } from './commands/hello';
import { registerStatusCommand } from './commands/status';
// import { registerLogCommand } from './commands/log'; // <-- REMOVE THIS LINE
import { initDb } from './lib/db';
import { version } from '../package.json';
import chalk from 'chalk';

async function main() {
    // Initialize database connection first
    try {
        await initDb();
    } catch (dbError) {
        console.error(chalk.red("Database initialization failed during startup:"), dbError);
        process.exit(1);
    }

    program
        .version(version)
        .name("time-cli")
        .description('Time CLI - A simple command-line time tracker.');

    // Register all commands
    registerStartCommand(program);
    registerStopCommand(program);
    registerStatusCommand(program);
    registerListCommand(program);
    registerAddCommand(program); // Keep this
    registerEditCommand(program);
    registerDeleteCommand(program);
    // registerLogCommand(program); // <-- ENSURE THIS IS REMOVED OR COMMENTED OUT
    registerEtaCommand(program);
    registerSummaryCommand(program);
    registerReportCommand(program);
    registerExportCommand(program);
    registerImportCommand(program);
    // registerHelloCommand(program);


    // Add default behavior or help if no command is specified
    program.on('command:*', () => {
        const availableCommands = program.commands.map(cmd => cmd.name());
        console.error(chalk.red('Invalid command: %s\n'), program.args.join(' '));
        console.error(chalk.yellow('Available commands:'), availableCommands.join(', '));
        console.error(`See ${chalk.green('--help')} for more information.`);
        process.exit(1);
    });

    // Parse arguments and execute corresponding command action
    await program.parseAsync(process.argv);

    // If no command was provided, show standard help
    if (!process.argv.slice(2).length) {
        program.outputHelp();
    }
}

main().catch(error => {
    console.error(chalk.red("\nAn unexpected error occurred:"), error.message || error);
    // console.error(error.stack); // Uncomment for detailed debugging
    process.exit(1);
});